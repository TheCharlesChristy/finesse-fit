#!/usr/bin/env python3
"""Polite, resumable scraper for the Muscle & Strength exercise database.

The scraper only follows exercise-library pages on the same host. It does not
attempt to bypass bot protection, log in, submit forms, or scrape comments.
It discovers the site's category pages from /exercises, follows pagination,
then visits each exercise guide to collect the profile metadata exposed there.

The JSON output is accepted directly by scripts/import-exercises.mjs.

Examples:
    python3 scripts/scrape_muscleandstrength.py \
        --output downloads/muscle-and-strength.json

    # Small smoke run before committing to the full crawl:
    python3 scripts/scrape_muscleandstrength.py \
        --max-category-pages 2 --max-exercises 20 --delay 1.5

The default one-request-per-second delay is intentional. Keep a cache and a
normal, descriptive User-Agent when running a full crawl. If the site returns
403/429, stop and use a permitted export or saved HTML rather than trying to
work around the protection.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import time
from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urldefrag, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser


BASE_URL = "https://www.muscleandstrength.com"
ROOT_URL = f"{BASE_URL}/exercises"
SOURCE = "muscle-and-strength"
DEFAULT_USER_AGENT = "FinesseFitExerciseResearch/1.0 (+local catalogue import; contact project owner before crawling)"
DETAIL_RE = re.compile(r"^/exercises/[^/?#]+\.html?$", re.IGNORECASE)
CATEGORY_RE = re.compile(r"^/exercises/[^/?#]+(?:\.html)?$", re.IGNORECASE)
SPACE_RE = re.compile(r"\s+")

# The site uses both /exercises/chest and /exercises/abductors.html for
# category pages. Keeping this allowlist prevents those pages from being
# mistaken for exercise guides, while still allowing detail URLs to be
# discovered from category pages.
CATEGORY_SLUGS = {
    "abductors", "abs", "adductors", "biceps", "calves", "chest", "forearms", "glutes",
    "hamstrings", "hip-flexors", "it-band", "lats", "lower-back", "neck", "obliques",
    "palmar-fascia", "plantar-fascia", "quads", "shoulders", "traps", "triceps", "upper-back",
    "dumbbell", "barbell", "bodyweight", "cable", "machine", "exercise-ball", "ez-bar",
    "compound", "isolation",
}


class ScrapeError(RuntimeError):
    """An actionable crawl error."""


def clean_text(value: str | None) -> str:
    return SPACE_RE.sub(" ", unescape(value or "")).strip()


def absolute_url(href: str, base_url: str) -> str:
    absolute = urljoin(base_url, href)
    absolute, _ = urldefrag(absolute)
    parsed = urlparse(absolute)
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path, "", parsed.query, ""))


def same_host(url: str) -> bool:
    return urlparse(url).netloc.lower() in {"www.muscleandstrength.com", "muscleandstrength.com"}


def exercise_url(url: str) -> bool:
    parsed = urlparse(url)
    slug = parsed.path.rstrip("/").split("/")[-1].removesuffix(".html").removesuffix(".htm").lower()
    return same_host(url) and bool(DETAIL_RE.match(parsed.path)) and slug not in CATEGORY_SLUGS


def category_url(url: str) -> bool:
    return same_host(url) and bool(CATEGORY_RE.match(urlparse(url).path))


def page_number(url: str) -> int:
    values = parse_qs(urlparse(url).query).get("page", ["0"])
    try:
        return int(values[0])
    except ValueError:
        return 0


class LinkParser(HTMLParser):
    """Collect links and their visible labels without third-party packages."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._label: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attributes = dict(attrs)
        self._href = attributes.get("href")
        self._label = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._label.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            self.links.append((self._href, clean_text(" ".join(self._label))))
            self._href = None
            self._label = []


class TextParser(HTMLParser):
    """Extract visible page text and the page's h1 title."""

    SKIP_TAGS = {"script", "style", "noscript", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_parts: list[str] = []
        self.headings: list[str] = []
        self._skip_depth = 0
        self._heading_depth = 0
        self._heading_parts: list[str] = []

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
        if tag == "h1":
            self._heading_depth += 1
            self._heading_parts = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
        if tag == "h1" and self._heading_depth:
            heading = clean_text(" ".join(self._heading_parts))
            if heading:
                self.headings.append(heading)
            self._heading_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        value = clean_text(data)
        if value:
            self.text_parts.append(value)
            if self._heading_depth:
                self._heading_parts.append(value)

    @property
    def text(self) -> str:
        return clean_text(" ".join(self.text_parts))


@dataclass
class CategoryPage:
    url: str
    exercise_links: list[tuple[str, str]]
    pagination_links: list[str]
    category_slug: str


def parse_category_page(html: str, page_url: str) -> CategoryPage:
    parser = LinkParser()
    parser.feed(html)
    exercise_links: list[tuple[str, str]] = []
    pagination_links: list[str] = []
    for href, label in parser.links:
        url = absolute_url(href, page_url)
        if exercise_url(url):
            exercise_links.append((urlunparse((*urlparse(url)[:4], "", "")), label))
        elif category_url(url) and urlparse(url).path == urlparse(page_url).path and parse_qs(urlparse(url).query).get("page"):
            pagination_links.append(url)
    slug = urlparse(page_url).path.rstrip("/").split("/")[-1]
    return CategoryPage(url=page_url, exercise_links=exercise_links, pagination_links=pagination_links, category_slug=slug)


def parse_category_links(html: str, page_url: str) -> list[str]:
    parser = LinkParser()
    parser.feed(html)
    links = []
    for href, _label in parser.links:
        url = absolute_url(href, page_url)
        slug = urlparse(url).path.rstrip("/").split("/")[-1].removesuffix(".html").removesuffix(".htm").lower()
        if category_url(url) and urlparse(url).path != "/exercises" and slug in CATEGORY_SLUGS:
            links.append(url)
    return sorted(set(links))


def first_profile_value(text: str, label: str, next_labels: list[str]) -> str:
    boundary = "|".join(re.escape(item) for item in next_labels)
    match = re.search(rf"{re.escape(label)}\s+(.+?)(?=\s+(?:{boundary})\b|$)", text, re.IGNORECASE)
    return clean_text(match.group(1)) if match else ""


def split_muscles(value: str) -> list[str]:
    if clean_text(value).lower() in {"none", "n/a", "na", "-"}:
        return []
    return [clean_text(item) for item in re.split(r",|/|;|\band\b", value, flags=re.IGNORECASE) if clean_text(item)]


def parse_exercise_page(html: str, url: str, category_slugs: list[str], fallback_name: str) -> dict:
    parser = TextParser()
    parser.feed(html)
    text = parser.text
    heading = parser.headings[0] if parser.headings else fallback_name
    name = re.sub(r"\s+Video Exercise Guide(?:\s*&\s*Tips)?$", "", heading, flags=re.IGNORECASE).strip() or fallback_name
    labels = ["Exercise Type", "Equipment Required", "Mechanics", "Force Type", "Experience Level", "Secondary Muscles", "Target Muscle Group"]
    target_match = re.search(r"Target Muscle Group\s+(.+?)\s+Exercise Type\b", text, re.IGNORECASE)
    target = clean_text(target_match.group(1)) if target_match else ""
    secondary = first_profile_value(text, "Secondary Muscles", ["Target Muscle Group", *labels])
    exercise_type = first_profile_value(text, "Exercise Type", ["Equipment Required", *labels])
    equipment = first_profile_value(text, "Equipment Required", ["Mechanics", *labels])
    mechanics = first_profile_value(text, "Mechanics", ["Force Type", *labels])
    experience = first_profile_value(text, "Experience Level", ["Secondary Muscles", *labels])
    source_categories = [target or slug for slug in category_slugs]
    source_categories = list(dict.fromkeys(item for item in source_categories if item))
    return {
        "id": urlparse(url).path.rstrip("/").split("/")[-1].removesuffix(".html"),
        "name": name,
        "sourceCategory": source_categories[0] if source_categories else None,
        "sourceCategories": source_categories,
        "primaryMuscles": [target] if target else [],
        "secondaryMuscles": split_muscles(secondary),
        "equipment": equipment,
        "type": exercise_type,
        "mechanics": mechanics,
        "difficulty": experience,
        "source": SOURCE,
        "sourceUrl": url,
        "isCustom": False,
    }


class Fetcher:
    def __init__(self, cache_dir: Path, delay: float, timeout: float, user_agent: str, ignore_robots: bool) -> None:
        self.cache_dir = cache_dir
        self.delay = max(delay, 0.0)
        self.timeout = timeout
        self.user_agent = user_agent
        self.ignore_robots = ignore_robots
        self.last_request = 0.0
        self.robots: RobotFileParser | None = None
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def load_robots(self) -> None:
        if self.ignore_robots:
            return
        robots_url = f"{BASE_URL}/robots.txt"
        request = Request(robots_url, headers={"User-Agent": self.user_agent, "Accept": "text/plain"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                contents = response.read().decode("utf-8", errors="replace")
            parser = RobotFileParser()
            parser.set_url(robots_url)
            parser.parse(contents.splitlines())
            self.robots = parser
        except (HTTPError, URLError, TimeoutError) as error:
            raise ScrapeError(f"Could not read robots.txt ({error}). Use a permitted export, or explicitly rerun with --ignore-robots if you have permission.") from error

    def _cache_path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
        return self.cache_dir / f"{digest}.html"

    def fetch(self, url: str) -> str:
        cache_path = self._cache_path(url)
        if cache_path.exists():
            return cache_path.read_text(encoding="utf-8")
        if not same_host(url):
            raise ScrapeError(f"Refusing to leave the Muscle & Strength host: {url}")
        if self.robots and not self.robots.can_fetch(self.user_agent, url):
            raise ScrapeError(f"robots.txt disallows {url}")
        elapsed = time.monotonic() - self.last_request
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        request = Request(url, headers={"User-Agent": self.user_agent, "Accept": "text/html,application/xhtml+xml"})
        self.last_request = time.monotonic()
        try:
            with urlopen(request, timeout=self.timeout) as response:
                html = response.read().decode("utf-8", errors="replace")
        except HTTPError as error:
            if error.code in {403, 429}:
                raise ScrapeError(f"The site returned HTTP {error.code} for {url}; stopping without bypassing protection. Try a permitted export or saved HTML.") from error
            raise ScrapeError(f"HTTP {error.code} while fetching {url}") from error
        except (URLError, TimeoutError) as error:
            raise ScrapeError(f"Could not fetch {url}: {error}") from error
        cache_path.write_text(html, encoding="utf-8")
        return html


def write_json(path: Path, exercises: list[dict], pages: int, categories: list[str]) -> None:
    payload = {
        "source": SOURCE,
        "sourceUrl": ROOT_URL,
        "scrapedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "categoryPages": pages,
        "categories": categories,
        "count": len(exercises),
        "exercises": exercises,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def write_csv(path: Path, exercises: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["id", "name", "sourceCategory", "sourceCategories", "primaryMuscles", "secondaryMuscles", "equipment", "type", "mechanics", "difficulty", "source", "sourceUrl", "isCustom"]
    temporary = path.with_suffix(f"{path.suffix}.tmp")
    with temporary.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for exercise in exercises:
            row = dict(exercise)
            for key in ("sourceCategories", "primaryMuscles", "secondaryMuscles"):
                row[key] = "|".join(row.get(key) or [])
            writer.writerow({key: row.get(key, "") for key in fields})
    temporary.replace(path)


def crawl(args: argparse.Namespace) -> tuple[list[dict], int]:
    fetcher = Fetcher(Path(args.cache_dir), args.delay, args.timeout, args.user_agent, args.ignore_robots)
    fetcher.load_robots()
    root_html = fetcher.fetch(ROOT_URL)
    categories = parse_category_links(root_html, ROOT_URL)
    if args.categories:
        wanted = {item.strip().strip("/").lower() for item in args.categories.split(",") if item.strip()}
        categories = [url for url in categories if urlparse(url).path.rstrip("/").split("/")[-1].lower() in wanted]
    if args.max_categories:
        categories = categories[: args.max_categories]
    if not categories:
        raise ScrapeError("No exercise categories were discovered from the root page.")

    found: dict[str, dict[str, object]] = {}
    category_pages = 0
    for category_url_value in categories:
        pending = [category_url_value]
        visited: set[str] = set()
        while pending and category_pages < args.max_category_pages:
            page_url_value = pending.pop(0)
            if page_url_value in visited:
                continue
            visited.add(page_url_value)
            category_pages += 1
            page = parse_category_page(fetcher.fetch(page_url_value), page_url_value)
            for exercise_url_value, label in page.exercise_links:
                current = found.setdefault(exercise_url_value, {"url": exercise_url_value, "name": label, "categories": []})
                current["categories"] = list(dict.fromkeys([*(current["categories"] or []), page.category_slug]))
            for next_url in sorted(set(page.pagination_links), key=page_number):
                if next_url not in visited and next_url not in pending and page_number(next_url) > page_number(page_url_value):
                    pending.append(next_url)
            if args.max_exercises and len(found) >= args.max_exercises:
                break
        if args.max_exercises and len(found) >= args.max_exercises:
            break

    results: list[dict] = []
    for index, (url, details) in enumerate(found.items(), start=1):
        if args.max_exercises and index > args.max_exercises:
            break
        page_html = fetcher.fetch(url)
        record = parse_exercise_page(page_html, url, details["categories"], details["name"])
        results.append(record)
        if index % 25 == 0 or index == len(found):
            print(f"Fetched {index}/{len(found)} exercise guides", file=sys.stderr)
    print(f"Discovered {len(found)} exercises across {category_pages} category pages", file=sys.stderr)
    return results, category_pages


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="downloads/muscle-and-strength.json", help="JSON output path")
    parser.add_argument("--csv-output", help="Optional CSV output path")
    parser.add_argument("--cache-dir", default=".cache/muscle-and-strength", help="HTML cache directory")
    parser.add_argument("--delay", type=float, default=1.0, help="Minimum seconds between uncached requests (default: 1.0)")
    parser.add_argument("--timeout", type=float, default=30.0, help="Request timeout in seconds")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help="Descriptive User-Agent string")
    parser.add_argument("--categories", help="Comma-separated category slugs to crawl")
    parser.add_argument("--max-categories", type=int, help="Limit category roots for a smoke test")
    parser.add_argument("--max-category-pages", type=int, default=1000, help="Maximum paginated category pages")
    parser.add_argument("--max-exercises", type=int, help="Limit detail pages for a smoke test")
    parser.add_argument("--ignore-robots", action="store_true", help="Skip robots.txt checks only when you have permission")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        exercises, category_pages = crawl(args)
        categories = sorted({category for exercise in exercises for category in exercise.get("sourceCategories", [])})
        write_json(Path(args.output), exercises, category_pages, categories)
        if args.csv_output:
            write_csv(Path(args.csv_output), exercises)
        print(f"Wrote {len(exercises)} exercises to {args.output}")
        if args.csv_output:
            print(f"Wrote CSV to {args.csv_output}")
        return 0
    except KeyboardInterrupt:
        print("Stopped by user; cached pages are preserved for the next run.", file=sys.stderr)
        return 130
    except ScrapeError as error:
        print(f"Scrape failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Audit and clean a Muscle & Strength scraper export.

This is intentionally separate from scraping: it makes it safe to review or
repair an existing download before importing it into the app. It removes
category-page false positives, canonicalises source URLs, removes duplicate
records, normalises empty list fields, and reports anything that still needs
attention.

Usage:
    python3 scripts/audit_exercises.py \
        downloads/muscle-and-strength.json \
        --output downloads/muscle-and-strength.cleaned.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse


DETAIL_RE = re.compile(r"^/exercises/[^/?#]+\.html?$", re.IGNORECASE)
CATEGORY_SLUG_RE = re.compile(r"\.html?$", re.IGNORECASE)
CATEGORY_SLUGS = {
    "abductors", "abs", "adductors", "biceps", "calves", "chest", "forearms", "glutes",
    "hamstrings", "hip-flexors", "it-band", "lats", "lower-back", "neck", "obliques",
    "palmar-fascia", "plantar-fascia", "quads", "shoulders", "traps", "triceps", "upper-back",
    "dumbbell", "barbell", "bodyweight", "cable", "machine", "exercise-ball", "ez-bar",
    "compound", "isolation",
}
LIST_FIELDS = ("sourceCategories", "primaryMuscles", "secondaryMuscles")
PROFILE_LABELS = ("Equipment Required", "Mechanics", "Force Type", "Experience Level", "Secondary Muscles", "Target Muscle Group")


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def canonical_url(value: object) -> str:
    parsed = urlparse(clean(value))
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", "", ""))


def source_slug(url: str) -> str:
    return CATEGORY_SLUG_RE.sub("", urlparse(url).path.rstrip("/").split("/")[-1]).lower()


def split_list(value: object) -> list[str]:
    if isinstance(value, list):
        values = value
    elif value is None:
        values = []
    else:
        values = str(value).split("|")
    result = []
    for item in values:
        value = clean(item)
        if value and value.lower() not in {"none", "n/a", "na", "-"} and value.casefold() not in {existing.casefold() for existing in result}:
            result.append(value)
    return result


def is_category_page(url: str) -> bool:
    parsed = urlparse(url)
    return source_slug(url) in CATEGORY_SLUGS and bool(CATEGORY_SLUG_RE.search(parsed.path))


def clean_record(raw: dict) -> dict:
    record = dict(raw)
    record["name"] = clean(record.get("name") or record.get("title"))
    record["sourceUrl"] = canonical_url(record.get("sourceUrl") or record.get("url"))
    for key in LIST_FIELDS:
        record[key] = split_list(record.get(key))
    record["sourceCategory"] = clean(record.get("sourceCategory"))
    record["equipment"] = clean(record.get("equipment"))
    record["type"] = clean(record.get("type"))
    record["mechanics"] = clean(record.get("mechanics"))
    record["difficulty"] = clean(record.get("difficulty"))
    # These are the characteristic signatures of a failed label boundary in
    # the HTML parser. Keeping them would pollute the app's exercise filters.
    if any(label.lower() in record["mechanics"].lower() for label in PROFILE_LABELS):
        record["mechanics"] = ""
    if record["type"].lower().startswith(("strength equipment", "warmup equipment")):
        record["type"] = record["type"].split(" Equipment", 1)[0]
    return record


def audit(rows: list[dict]) -> tuple[list[dict], dict[str, int]]:
    stats = {"input": len(rows), "removed_category_pages": 0, "removed_missing_name": 0, "removed_missing_url": 0, "removed_bad_url": 0, "removed_duplicates": 0, "output": 0}
    cleaned: list[dict] = []
    seen_urls: set[str] = set()
    seen_names: set[str] = set()
    for raw in rows:
        record = clean_record(raw)
        url = record["sourceUrl"]
        name_key = record["name"].casefold()
        if is_category_page(url):
            stats["removed_category_pages"] += 1
            continue
        if not record["name"]:
            stats["removed_missing_name"] += 1
            continue
        if not url:
            stats["removed_missing_url"] += 1
            continue
        if not DETAIL_RE.match(urlparse(url).path):
            stats["removed_bad_url"] += 1
            continue
        if url in seen_urls or name_key in seen_names:
            stats["removed_duplicates"] += 1
            continue
        seen_urls.add(url)
        seen_names.add(name_key)
        cleaned.append(record)
    stats["output"] = len(cleaned)
    return cleaned, stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Scraper JSON export")
    parser.add_argument("--output", required=True, help="Cleaned JSON output")
    args = parser.parse_args()
    try:
        input_path = Path(args.input)
        output_path = Path(args.output)
        payload = json.loads(input_path.read_text(encoding="utf-8"))
        rows = payload if isinstance(payload, list) else payload.get("exercises", [])
        if not isinstance(rows, list):
            raise ValueError("input must be an array or contain an exercises array")
        cleaned, stats = audit(rows)
        result = dict(payload) if isinstance(payload, dict) else {"source": "muscle-and-strength"}
        result["exercises"] = cleaned
        result["count"] = len(cleaned)
        result["auditedAt"] = datetime.now(timezone.utc).isoformat()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps(stats, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Audit failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

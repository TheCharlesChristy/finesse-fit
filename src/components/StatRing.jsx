// A flat, single-stroke progress ring — no gradient, no glow, just two
// concentric circles. Deliberately plain geometry so it reads as a crafted
// mark rather than a generic chart-library donut.
export default function StatRing({ pct = 0, size = 168, thickness = 14, color = 'var(--accent)', track = 'var(--track)', over = false }) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="presentation" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={thickness} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={over ? 'var(--danger)' : color}
        strokeWidth={thickness}
        strokeLinecap="butt"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1), stroke 300ms ease' }}
      />
    </svg>
  );
}

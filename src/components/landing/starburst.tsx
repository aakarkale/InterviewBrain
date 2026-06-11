// Hand-drawn starburst: deterministic ray geometry (computed once at
// module load, identical on server and client — no hydration drift).
const RAY_COUNT = 28;
const LENGTHS = [46, 80, 56, 94, 50, 72, 62, 88];

const rays = Array.from({ length: RAY_COUNT }, (_, i) => {
  const wobble = ((i % 3) - 1) * 1.6;
  const angle = ((i * 360) / RAY_COUNT + wobble) * (Math.PI / 180);
  const r0 = 86 + (i % 2) * 6;
  const r1 = r0 + LENGTHS[i % LENGTHS.length];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: +(200 + cos * r0).toFixed(2),
    y1: +(200 + sin * r0).toFixed(2),
    x2: +(200 + cos * r1).toFixed(2),
    y2: +(200 + sin * r1).toFixed(2),
    opacity: i % 2 === 0 ? 0.95 : 0.5,
  };
});

export function Starburst({ className }: { className?: string }) {
  return (
    <div className={className} data-starburst aria-hidden="true">
      <svg viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <radialGradient id="starburst-halo">
            <stop offset="0%" style={{ stopColor: "var(--glow)" }} />
            <stop offset="100%" style={{ stopColor: "transparent" }} />
          </radialGradient>
        </defs>
        <circle className="halo" cx="200" cy="200" r="120" fill="url(#starburst-halo)" />
        <g
          className="rays"
          stroke="var(--accent-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {rays.map((r, i) => (
            <line
              key={i}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              opacity={r.opacity}
            />
          ))}
        </g>
        <circle cx="200" cy="200" r="5" fill="var(--accent-2)" />
      </svg>
    </div>
  );
}

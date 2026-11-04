/**
 * The mark (owner, 2026-10-09): the heating ring, a thick ring in the heat ramp with a soft bloom. `RingDefs` is drawn
 * once by the root layout and every `Ring` uses it, as the spec's layout does.
 */
export function RingDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="heat" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5a1f" />
          <stop offset="1" stopColor="#ffb020" />
        </linearGradient>
        <filter id="bloom" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <g id="ring" fill="none" stroke="url(#heat)" strokeWidth="4.2">
          <circle cx="16" cy="16" r="8.6" filter="url(#bloom)" opacity=".55" />
          <circle cx="16" cy="16" r="8.6" />
        </g>
      </defs>
    </svg>
  );
}

export function Ring({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <use href="#ring" />
    </svg>
  );
}

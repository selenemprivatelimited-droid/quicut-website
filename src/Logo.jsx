// QuiCut wordmark as inline SVG (same Q geometry as the 3D logo).
const Q = 'M0.37 1.15L0.47 1.14L0.57 1.12L0.66 1.08L0.75 1.04L0.84 0.97L0.92 0.9L0.99 0.82L1.04 0.74L1.09 0.64L1.12 0.55L1.41 -0.65L1.42 -0.74L1.42 -0.84L1.41 -0.92L1.38 -1L1.33 -1.07L1.28 -1.14L1.21 -1.18L1.13 -1.22L1.04 -1.24L0.95 -1.25L-0.35 -1.25L-0.45 -1.24L-0.54 -1.22L-0.64 -1.18L-0.73 -1.14L-0.82 -1.07L-0.89 -1L-0.96 -0.92L-1.02 -0.84L-1.06 -0.74L-1.09 -0.65L-1.38 0.55L-1.4 0.64L-1.4 0.74L-1.38 0.82L-1.35 0.9L-1.31 0.97L-1.25 1.04L-1.18 1.08L-1.1 1.12L-1.02 1.14L-0.93 1.15ZM-0.5 0.52L-0.52 0.52L-0.54 0.51L-0.56 0.51L-0.57 0.5L-0.58 0.48L-0.59 0.47L-0.6 0.45L-0.6 0.44L-0.6 0.42L-0.6 0.4L-0.36 -0.58L-0.35 -0.6L-0.35 -0.62L-0.33 -0.63L-0.32 -0.65L-0.31 -0.66L-0.29 -0.68L-0.27 -0.69L-0.25 -0.69L-0.23 -0.7L-0.21 -0.7L0.55 -0.7L0.57 -0.7L0.58 -0.69L0.6 -0.69L0.61 -0.68L0.62 -0.66L0.63 -0.65L0.64 -0.63L0.64 -0.62L0.64 -0.6L0.64 -0.58L0.4 0.4L0.4 0.42L0.39 0.44L0.38 0.45L0.36 0.47L0.35 0.48L0.33 0.5L0.31 0.51L0.29 0.51L0.27 0.52L0.26 0.52Z'
const TAIL = 'M-0.02 0.6L0.52 0.6L1.08 1.74L0.5 1.74Z'
const BLADE = 'M-2.35 1.62L-1.91 1.29L-1.46 0.97L-1.01 0.66L-0.55 0.36L-0.09 0.06L0.38 -0.23L0.85 -0.51L1.32 -0.8L1.78 -1.09L2.25 -1.38L1.79 -1.08L1.34 -0.77L0.88 -0.46L0.43 -0.15L-0.03 0.15L-0.49 0.45L-0.95 0.75L-1.41 1.05L-1.88 1.34L-2.35 1.62Z'

export function QMark({ id = 'qm' }) {
  return (
    <>
      <defs>
        <linearGradient id={id + '-red'} x1="0" y1="-1.3" x2="0" y2="1.8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff2b31" />
          <stop offset="1" stopColor="#c40a12" />
        </linearGradient>
        <linearGradient id={id + '-blade'} x1="-2.3" y1="1.6" x2="2.2" y2="-1.4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d9e0" />
        </linearGradient>
      </defs>
      <path d={Q} fillRule="evenodd" fill={`url(#${id}-red)`} />
      <path d={TAIL} fill={`url(#${id}-red)`} />
      <path d={BLADE} fill="#050507" transform="translate(0 0.06)" />
      <path d={BLADE} fill={`url(#${id}-blade)`} />
    </>
  )
}

export default function Logo({ height = 30, id = 'logo' }) {
  return (
    <svg
      className="logo"
      viewBox="-2.4 -1.3 10.2 3.1"
      height={height}
      width={(height * 10.2) / 3.1}
      role="img"
      aria-label="QuiCut"
    >
      <defs>
        <linearGradient id={id + '-silver'} x1="0" y1="-0.6" x2="0" y2="0.9" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9c9d1" />
        </linearGradient>
      </defs>
      <QMark id={id} />
      <text
        x="1.55"
        y="0.86"
        fontFamily="Saira, 'Arial Narrow', sans-serif"
        fontStyle="italic"
        fontWeight="800"
        fontSize="1.85"
        textLength="6"
        lengthAdjust="spacingAndGlyphs"
        fill={`url(#${id}-silver)`}
      >
        UICUT
      </text>
    </svg>
  )
}

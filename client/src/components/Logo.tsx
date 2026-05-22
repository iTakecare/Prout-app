/** Marque Waste-end : feuille (matière organique) traversée d'un éclair
 *  (énergie) avec une tige orange — recréée en SVG d'après le logo officiel. */
const MINT = "#7FC9AF";
const ORANGE = "#D86E4C";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={(size * 120) / 150}
      height={size}
      viewBox="0 0 120 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M60 5C40 29 25 52 26 79c1 32 17 50 34 50s33-18 34-50C95 52 80 29 60 5Z"
        fill={MINT}
      />
      <path d="M55 124 L60 149 L65 124 Z" fill={ORANGE} />
      <path
        d="M63 36 L38 85 L61 85 L58 118 L84 69 L61 69 Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Logo complet : marque + mot « waste·end ». */
export function LogoFull({ iconSize = 46 }: { iconSize?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <LogoMark size={iconSize} />
      <span
        style={{
          fontWeight: 800,
          fontSize: iconSize * 0.6,
          letterSpacing: "-0.03em",
        }}
      >
        <span style={{ color: ORANGE }}>waste</span>
        <span style={{ color: MINT }}>·end</span>
      </span>
    </div>
  );
}

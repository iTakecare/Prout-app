/** Marque visuelle Waste-end : une feuille (matière organique) surmontée
 *  d'une bulle de biogaz, évoquant la biométhanisation. */
export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="we-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#27b766" />
          <stop offset="1" stopColor="#117a42" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#we-g)" />
      <path
        d="M24 13c-9 3-13 12-8 21 1 2 3 4 5 5 1-9 5-15 11-19-5 1-9 4-11 9-1-7 1-12 3-16z"
        fill="#fff"
        fillOpacity="0.95"
      />
      <circle cx="32.5" cy="15.5" r="4.2" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}

/** Logo complet : marque + nom, pour la barre latérale et les documents. */
export function Logo({ size = 38, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <LogoMark size={size} />
      <div>
        <div
          className="brand-name"
          style={dark ? { color: "#0e261c" } : undefined}
        >
          Waste-end
        </div>
        <span className="brand-sub">Méthascore CRM</span>
      </div>
    </div>
  );
}

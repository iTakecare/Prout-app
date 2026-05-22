import type { CalcResult } from "../types";
import { fmtEnergy, fmtEur, fmtInt, fmtNum, probaClass } from "../format";

const GAUGE_COLORS: Record<string, string> = {
  high: "#1f9d57",
  good: "#7cb342",
  mid: "#d68a1e",
  low: "#d24a3c",
};

export function ProbabilityGauge({ result }: { result: CalcResult }) {
  const color = GAUGE_COLORS[probaClass(result.probability)];
  const R = 48;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - Math.max(0, Math.min(100, result.probability)) / 100);
  return (
    <div className="gauge">
      <svg
        width="122"
        height="122"
        viewBox="0 0 122 122"
        style={{ flexShrink: 0 }}
      >
        <circle cx="61" cy="61" r={R} fill="none" stroke="#eaeeec" strokeWidth="13" />
        <circle
          cx="61"
          cy="61"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 61 61)"
        />
        <text
          x="61"
          y="59"
          textAnchor="middle"
          fontSize="27"
          fontWeight="800"
          fill="#14201b"
        >
          {result.probability}%
        </text>
        <text
          x="61"
          y="77"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#687a71"
          letterSpacing="0.8"
        >
          PERTINENCE
        </text>
      </svg>
      <div>
        <h3 style={{ fontSize: 16 }}>{result.verdict}</h3>
        <p className="muted" style={{ margin: "4px 0 0", maxWidth: 280 }}>
          Score de pertinence d'une unité de biométhanisation Waste-end sur ce
          site, pondéré sur le volume de déchets, l'incitatif économique et le
          contexte de l'établissement.
        </p>
      </div>
    </div>
  );
}

export default function ResultView({ result }: { result: CalcResult }) {
  return (
    <div className="stack">
      <div className="card">
        <ProbabilityGauge result={result} />
        <div style={{ marginTop: 16 }}>
          {result.factors.map((f) => (
            <div className="factor" key={f.label}>
              <div className="top">
                <span>
                  <strong>{f.label}</strong>{" "}
                  <span className="muted">· {f.detail}</span>
                </span>
                <span className="muted">
                  +{fmtNum(f.contribution, 1)} / {Math.round(f.weight * 100)} pts
                </span>
              </div>
              <div className="bar">
                <div style={{ width: `${Math.round(f.score * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid kpi-grid">
        <div className="kpi">
          <div className="label">Déchets traités</div>
          <div className="value">{fmtInt(result.totalTonnage)} t/an</div>
          <div className="sub">
            dont {fmtInt(result.totalMO)} t de matière organique
          </div>
        </div>
        <div className="kpi">
          <div className="label">Méthane (CH₄)</div>
          <div className="value">{fmtInt(result.ch4Total)} m³/an</div>
          <div className="sub">{fmtInt(result.biogasTotal)} m³ de biogaz</div>
        </div>
        <div className="kpi">
          <div className="label">Chaleur valorisable</div>
          <div className="value">{fmtEnergy(result.heatUsableKwh)}</div>
          <div className="sub">
            ≈ {fmtNum(result.homesEquivalent, 1)} foyers chauffés
          </div>
        </div>
        <div className="kpi">
          <div className="label">Digestat produit</div>
          <div className="value">{fmtInt(result.digestate)} t/an</div>
          <div className="sub">engrais naturel valorisable en agriculture</div>
        </div>
        <div className="kpi">
          <div className="label">CO₂ évité</div>
          <div className="value">{fmtInt(result.co2Avoided)} t/an</div>
          <div className="sub">par rapport à l'incinération</div>
        </div>
        <div className="kpi">
          <div className="label">Bénéfice annuel estimé</div>
          <div className="value">{fmtEur(result.totalBenefit)}/an</div>
          <div className="sub">
            {fmtEur(result.disposalSaving)} collecte évitée +{" "}
            {fmtEur(result.heatValue)} énergie
          </div>
        </div>
      </div>

      {result.lines.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>
            Détail par type de déchet
          </h3>
          <table>
            <thead>
              <tr>
                <th>Déchet alimentaire</th>
                <th className="num">Tonnage</th>
                <th className="num">Matière organique</th>
                <th className="num">CH₄ produit</th>
                <th className="num">Part</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.substrateId}>
                  <td>{l.name}</td>
                  <td className="num">{fmtInt(l.tonnage)} t</td>
                  <td className="num">{fmtInt(l.tMO)} t</td>
                  <td className="num">{fmtInt(l.ch4)} m³</td>
                  <td className="num">{Math.round(l.share * 100)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import type { CalcResult } from "../types";
import { fmtEnergy, fmtEur, fmtInt, fmtNum, probaClass } from "../format";

const GAUGE_COLORS: Record<string, string> = {
  high: "#1f9d57",
  good: "#7cb342",
  mid: "#d68a1e",
  low: "#d24a3c",
};

export function ProbabilityGauge({ result }: { result: CalcResult }) {
  const cls = probaClass(result.probability);
  return (
    <div className="gauge">
      <div
        className="gauge-ring"
        style={
          {
            "--p": result.probability,
            "--gc": GAUGE_COLORS[cls],
          } as React.CSSProperties
        }
      >
        <div className="inner">
          <div className="pct">{result.probability}%</div>
          <div className="cap">Pertinence</div>
        </div>
      </div>
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

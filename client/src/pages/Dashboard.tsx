import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtEnergy, fmtInt, fmtKeur, fmtPct, probaClass } from "../format";
import type { Dashboard as DashboardData, Lead, Stage } from "../types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.dashboard(), api.leads(), api.meta()])
      .then(([d, l, m]) => {
        setData(d);
        setLeads(l);
        setStages(m.stages);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (!data) return <div className="empty">Chargement…</div>;

  const maxCount = Math.max(1, ...stages.map((s) => data.stageCounts[s.id] ?? 0));
  const topLeads = [...leads]
    .filter((l) => l.probability != null && l.stage !== "perdu")
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, 6);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p>
            Vue d'ensemble du pipeline de vente de solutions de méthanisation
            Waste-end.
          </p>
        </div>
        <Link to="/pipeline" className="btn">
          Ouvrir le pipeline
        </Link>
      </div>

      <div className="grid kpi-grid">
        <div className="kpi">
          <div className="label">Pipeline en cours</div>
          <div className="value">{fmtKeur(data.pipelineValue)}</div>
          <div className="sub">{data.totalLeads} leads au total</div>
        </div>
        <div className="kpi">
          <div className="label">Prévision pondérée</div>
          <div className="value">{fmtKeur(data.weightedValue)}</div>
          <div className="sub">selon la probabilité d'étape</div>
        </div>
        <div className="kpi">
          <div className="label">Affaires gagnées</div>
          <div className="value">{fmtKeur(data.wonValue)}</div>
          <div className="sub">installations &amp; contrats signés</div>
        </div>
        <div className="kpi">
          <div className="label">Potentiel CH₄ du pipeline</div>
          <div className="value">{fmtInt(data.ch4Pipeline)} m³/an</div>
          <div className="sub">
            ≈ {fmtEnergy(data.ch4Pipeline * 9.94)} d'énergie primaire
          </div>
        </div>
        <div className="kpi">
          <div className="label">Probabilité moyenne</div>
          <div className="value">{fmtPct(data.avgProbability)}</div>
          <div className="sub">méthanisation, leads étudiés</div>
        </div>
        <div className="kpi">
          <div className="label">Tickets SAV ouverts</div>
          <div className="value">{data.openTickets}</div>
          <div className="sub">suivi après-vente</div>
        </div>
      </div>

      <div className="cols-2" style={{ marginTop: 22 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>
            Répartition du pipeline
          </h3>
          {stages.map((s) => {
            const count = data.stageCounts[s.id] ?? 0;
            return (
              <div key={s.id} style={{ marginBottom: 10 }}>
                <div className="row-between" style={{ marginBottom: 3 }}>
                  <span style={{ fontSize: 13 }}>{s.label}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {count}
                  </span>
                </div>
                <div className="factor">
                  <div className="bar">
                    <div
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        background:
                          s.id === "perdu" ? "#d24a3c" : "var(--green)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>
            Leads les plus prometteurs
          </h3>
          {topLeads.length === 0 && (
            <div className="empty">Aucune étude réalisée pour l'instant.</div>
          )}
          {topLeads.map((l) => (
            <Link
              to={`/leads/${l.id}`}
              key={l.id}
              className="row-between"
              style={{
                padding: "9px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div>
                <strong>{l.company}</strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  {l.sector || "—"}
                </div>
              </div>
              <span className={"proba " + probaClass(l.probability ?? 0)}>
                <span className="dot" />
                {l.probability} %
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

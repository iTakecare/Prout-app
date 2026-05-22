import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { fmtDate, fmtEur, probaClass } from "../format";
import type { Lead, Stage } from "../types";

const STAGE_BADGE: Record<string, string> = {
  nouveau: "gray",
  qualifie: "blue",
  etude: "blue",
  proposition: "amber",
  negociation: "amber",
  gagne: "",
  service: "",
  perdu: "red",
};

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.leads(), api.meta()])
      .then(([l, m]) => {
        setLeads(l);
        setStages(m.stages);
      })
      .catch((e) => setError(e.message));
  }, []);

  const stageLabel = (id: string) =>
    stages.find((s) => s.id === id)?.label ?? id;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!stageFilter || l.stage === stageFilter) &&
        (!needle ||
          `${l.company} ${l.sector} ${l.city} ${l.contact_name} ${l.owner}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [leads, q, stageFilter]);

  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>CRM — Clients &amp; prospects</h1>
          <p>
            Tous vos établissements suivis, du premier contact à l'après-vente.
            Cliquez sur une ligne pour ouvrir la fiche.
          </p>
        </div>
      </div>

      <div
        className="row-between"
        style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}
      >
        <input
          placeholder="Rechercher un établissement, un contact, une ville…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 360 }}
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          style={{ width: "auto" }}
        >
          <option value="">Toutes les étapes</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Établissement</th>
              <th>Secteur</th>
              <th>Ville</th>
              <th>Étape</th>
              <th>Commercial</th>
              <th className="num">Valeur</th>
              <th className="num">Pertinence</th>
              <th className="num">Mise à jour</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/leads/${l.id}`)}
              >
                <td>
                  <strong>{l.company}</strong>
                  {l.contact_name && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {l.contact_name}
                    </div>
                  )}
                </td>
                <td>{l.sector || "—"}</td>
                <td>{l.city || "—"}</td>
                <td>
                  <span className={"badge " + (STAGE_BADGE[l.stage] || "")}>
                    {stageLabel(l.stage)}
                  </span>
                </td>
                <td>{l.owner || "—"}</td>
                <td className="num">
                  {l.estimated_value > 0 ? fmtEur(l.estimated_value) : "—"}
                </td>
                <td className="num">
                  {l.probability != null ? (
                    <span className={"proba " + probaClass(l.probability)}>
                      <span className="dot" />
                      {l.probability} %
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="num muted" style={{ fontSize: 12 }}>
                  {fmtDate(l.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty">Aucun client ne correspond à la recherche.</div>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        {filtered.length} établissement(s) affiché(s) sur {leads.length}.
      </p>
    </div>
  );
}

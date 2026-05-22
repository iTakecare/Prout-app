import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import AssessmentForm from "../components/AssessmentForm";
import ResultView from "../components/ResultView";
import { fmtDate, fmtEur, probaClass } from "../format";
import type { LeadDetail, Stage, Substrate } from "../types";

const ACTIVITY_ICON: Record<string, string> = {
  appel: "📞",
  email: "✉️",
  rdv: "🤝",
  note: "📝",
  devis: "📄",
};

const PRIORITY_BADGE: Record<string, string> = {
  critique: "red",
  haute: "amber",
  normale: "blue",
  basse: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const leadId = Number(id);
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [tab, setTab] = useState<"synthese" | "etudes" | "activites" | "sav">(
    "synthese",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.lead(leadId).then(setLead).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.meta().then((m) => {
      setStages(m.stages);
      setSubstrates(m.substrates);
    });
  }, [leadId]);

  if (error) return <div className="error-box">{error}</div>;
  if (!lead) return <div className="empty">Chargement…</div>;

  const latest = lead.assessments[0];

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/pipeline" className="muted" style={{ fontSize: 13 }}>
            ← Pipeline
          </Link>
          <h1 style={{ marginTop: 4 }}>{lead.company}</h1>
          <p>
            {lead.sector || "—"}
            {lead.city ? ` · ${lead.city}` : ""}
            {lead.owner ? ` · Commercial : ${lead.owner}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {latest && (
            <span className={"proba " + probaClass(latest.probability)}>
              <span className="dot" />
              {latest.probability} % méthanisation
            </span>
          )}
          <select
            value={lead.stage}
            onChange={(e) => guard(() => api.setStage(leadId, e.target.value))}
            style={{ width: "auto" }}
          >
            {stages.map((s) => (
              <option value={s.id} key={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ["synthese", "Synthèse"],
            ["etudes", `Études (${lead.assessments.length})`],
            ["activites", `Activités (${lead.activities.length})`],
            ["sav", `Suivi & SAV (${lead.tickets.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={"tab" + (tab === key ? " active" : "")}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "synthese" && (
        <SyntheseTab lead={lead} busy={busy} onSave={guard} onDelete={() => navigate("/pipeline")} />
      )}
      {tab === "etudes" && (
        <EtudesTab
          lead={lead}
          substrates={substrates}
          busy={busy}
          onChange={guard}
        />
      )}
      {tab === "activites" && (
        <ActivitesTab lead={lead} busy={busy} onChange={guard} />
      )}
      {tab === "sav" && <SavTab lead={lead} busy={busy} onChange={guard} />}
    </div>
  );
}

/* ---------- Synthèse ---------- */
function SyntheseTab({
  lead,
  busy,
  onSave,
  onDelete,
}: {
  lead: LeadDetail;
  busy: boolean;
  onSave: (fn: () => Promise<unknown>) => Promise<void>;
  onDelete: () => void;
}) {
  const [form, setForm] = useState({
    company: lead.company,
    contact_name: lead.contact_name,
    email: lead.email,
    phone: lead.phone,
    sector: lead.sector,
    address: lead.address,
    city: lead.city,
    source: lead.source,
    owner: lead.owner,
    estimated_value: lead.estimated_value,
    notes: lead.notes,
  });

  function set(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="cols-2">
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Fiche client</h3>
        <div className="field">
          <label>Entreprise</label>
          <input value={form.company} onChange={(e) => set("company", e.target.value)} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Contact</label>
            <input
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Secteur</label>
            <input value={form.sector} onChange={(e) => set("sector", e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="field">
            <label>Adresse</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="field">
            <label>Ville</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="field">
            <label>Origine</label>
            <input value={form.source} onChange={(e) => set("source", e.target.value)} />
          </div>
          <div className="field">
            <label>Commercial</label>
            <input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
          </div>
          <div className="field">
            <label>Valeur estimée (€)</label>
            <input
              type="number"
              min={0}
              value={form.estimated_value || ""}
              onChange={(e) => set("estimated_value", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="row-between">
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Supprimer définitivement « ${lead.company} » ?`)) {
                api.deleteLead(lead.id).then(onDelete);
              }
            }}
          >
            Supprimer le lead
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => onSave(() => api.updateLead(lead.id, form))}
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Repères commerciaux</h3>
          <div className="row-between" style={{ padding: "6px 0" }}>
            <span className="muted">Valeur estimée</span>
            <strong>{fmtEur(lead.estimated_value)}</strong>
          </div>
          <div className="row-between" style={{ padding: "6px 0" }}>
            <span className="muted">Créé le</span>
            <span>{fmtDate(lead.created_at)}</span>
          </div>
          <div className="row-between" style={{ padding: "6px 0" }}>
            <span className="muted">Dernière activité</span>
            <span>{fmtDate(lead.updated_at)}</span>
          </div>
          <div className="row-between" style={{ padding: "6px 0" }}>
            <span className="muted">Études réalisées</span>
            <span>{lead.assessments.length}</span>
          </div>
          <div className="row-between" style={{ padding: "6px 0" }}>
            <span className="muted">Tickets SAV ouverts</span>
            <span>
              {lead.tickets.filter((t) => t.status !== "resolu").length}
            </span>
          </div>
        </div>
        {lead.assessments[0] && (
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>
              Dernière étude de faisabilité
            </h3>
            <ResultView result={lead.assessments[0].result} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Études ---------- */
function EtudesTab({
  lead,
  substrates,
  busy,
  onChange,
}: {
  lead: LeadDetail;
  substrates: Substrate[];
  busy: boolean;
  onChange: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(lead.assessments.length === 0);

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h3 style={{ fontSize: 15 }}>Nouvelle étude de faisabilité</h3>
          <button className="btn ghost sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Masquer" : "Afficher"}
          </button>
        </div>
        {showForm && substrates.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <AssessmentForm
              substrates={substrates}
              submitLabel="Enregistrer l'étude"
              busy={busy}
              showLabel
              onSubmit={(input) =>
                onChange(() => api.addAssessment(lead.id, input)).then(() =>
                  setShowForm(false),
                )
              }
            />
          </div>
        )}
      </div>

      {lead.assessments.map((a) => (
        <div className="card" key={a.id}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ fontSize: 15 }}>{a.label}</h3>
              <span className="muted" style={{ fontSize: 12 }}>
                {fmtDate(a.createdAt)} · Biométhanisation
              </span>
            </div>
            <button
              className="btn danger sm"
              disabled={busy}
              onClick={() => onChange(() => api.deleteAssessment(a.id))}
            >
              Supprimer
            </button>
          </div>
          <ResultView result={a.result} />
        </div>
      ))}
      {lead.assessments.length === 0 && (
        <div className="card empty">Aucune étude réalisée pour ce lead.</div>
      )}
    </div>
  );
}

/* ---------- Activités ---------- */
function ActivitesTab({
  lead,
  busy,
  onChange,
}: {
  lead: LeadDetail;
  busy: boolean;
  onChange: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [type, setType] = useState("appel");
  const [summary, setSummary] = useState("");

  return (
    <div className="cols-2">
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Journal des interactions</h3>
        {lead.activities.length === 0 && (
          <div className="empty">Aucune activité enregistrée.</div>
        )}
        {lead.activities.map((act) => (
          <div className="timeline-item" key={act.id}>
            <div className="tl-icon">{ACTIVITY_ICON[act.type] ?? "📝"}</div>
            <div style={{ flex: 1 }}>
              <div className="row-between">
                <strong style={{ textTransform: "capitalize" }}>
                  {act.type}
                </strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {fmtDate(act.created_at)}
                </span>
              </div>
              <div>{act.summary}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Ajouter une activité</h3>
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="appel">Appel</option>
            <option value="email">Email</option>
            <option value="rdv">Rendez-vous</option>
            <option value="devis">Devis</option>
            <option value="note">Note</option>
          </select>
        </div>
        <div className="field">
          <label>Contenu</label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Compte-rendu de l'échange…"
          />
        </div>
        <button
          className="btn"
          disabled={busy || !summary.trim()}
          onClick={() =>
            onChange(() => api.addActivity(lead.id, type, summary)).then(() =>
              setSummary(""),
            )
          }
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

/* ---------- SAV ---------- */
function SavTab({
  lead,
  busy,
  onChange,
}: {
  lead: LeadDetail;
  busy: boolean;
  onChange: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "normale",
  });

  return (
    <div className="cols-2">
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>
          Tickets de suivi & service après-vente
        </h3>
        {lead.tickets.length === 0 && (
          <div className="empty">Aucun ticket pour cette installation.</div>
        )}
        {lead.tickets.map((t) => (
          <div
            key={t.id}
            style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
          >
            <div className="row-between">
              <strong>{t.title}</strong>
              <span className={"badge " + (PRIORITY_BADGE[t.priority] ?? "gray")}>
                {t.priority}
              </span>
            </div>
            {t.description && (
              <p className="muted" style={{ margin: "4px 0" }}>
                {t.description}
              </p>
            )}
            <div className="row-between" style={{ marginTop: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Ouvert le {fmtDate(t.created_at)}
              </span>
              <select
                value={t.status}
                style={{ width: "auto" }}
                onChange={(e) =>
                  onChange(() => api.updateTicket(t.id, { status: e.target.value }))
                }
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Nouveau ticket</h3>
        <div className="field">
          <label>Titre</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Priorité</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="basse">Basse</option>
            <option value="normale">Normale</option>
            <option value="haute">Haute</option>
            <option value="critique">Critique</option>
          </select>
        </div>
        <button
          className="btn"
          disabled={busy || !form.title.trim()}
          onClick={() =>
            onChange(() => api.addTicket(lead.id, form)).then(() =>
              setForm({ title: "", description: "", priority: "normale" }),
            )
          }
        >
          Créer le ticket
        </button>
      </div>
    </div>
  );
}

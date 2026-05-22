import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { fmtKeur, probaClass } from "../format";
import type { Lead, Stage } from "../types";

const HAPPY = ["nouveau", "qualifie", "etude", "proposition", "negociation", "gagne", "service"];

function NewLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    company: "",
    contact_name: "",
    email: "",
    phone: "",
    sector: "",
    city: "",
    source: "",
    owner: "",
    estimated_value: 0,
    notes: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await api.createLead(form);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, marginBottom: 14 }}>Nouveau lead</h2>
        {error && <div className="error-box">{error}</div>}
        <div className="field">
          <label>Établissement *</label>
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
            <label>Ville</label>
            <input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="field">
            <label>Origine du lead</label>
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
        <div className="row-between" style={{ marginTop: 8 }}>
          <button className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn" onClick={submit} disabled={busy || !form.company.trim()}>
            Créer le lead
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  function load() {
    Promise.all([api.leads(), api.meta()])
      .then(([l, m]) => {
        setLeads(l);
        setStages(m.stages);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function move(lead: Lead, dir: number) {
    const idx = HAPPY.indexOf(lead.stage);
    const next = idx < 0 ? "nouveau" : HAPPY[Math.min(HAPPY.length - 1, Math.max(0, idx + dir))];
    if (next === lead.stage) return;
    await api.setStage(lead.id, next);
    load();
  }

  async function setStage(lead: Lead, stage: string) {
    if (lead.stage === stage) return;
    await api.setStage(lead.id, stage);
    load();
  }

  function clearDrag() {
    setDragId(null);
    setDragOver(null);
  }

  async function handleDrop(stageId: string) {
    const lead = leads.find((l) => l.id === dragId);
    clearDrag();
    if (lead && lead.stage !== stageId) {
      await api.setStage(lead.id, stageId);
      load();
    }
  }

  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pipeline commercial</h1>
          <p>
            Du lead entrant à la gestion après-vente. Glissez-déposez une fiche
            d'une colonne à l'autre pour faire avancer l'affaire.
          </p>
        </div>
        <button className="btn" onClick={() => setShowModal(true)}>
          + Nouveau lead
        </button>
      </div>

      <div className="kanban">
        {stages.map((stage) => {
          const items = leads.filter((l) => l.stage === stage.id);
          const isTarget = dragOver === stage.id && dragId != null;
          return (
            <div
              className={"kanban-col" + (isTarget ? " drop-target" : "")}
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOver !== stage.id) setDragOver(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setDragOver((c) => (c === stage.id ? null : c));
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(stage.id);
              }}
            >
              <h3>
                {stage.label}
                <span className="count">{items.length}</span>
              </h3>
              {items.map((lead) => (
                <div
                  className={"lead-card" + (dragId === lead.id ? " dragging" : "")}
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragId(lead.id)}
                  onDragEnd={clearDrag}
                >
                  <Link to={`/leads/${lead.id}`} className="company">
                    {lead.company}
                  </Link>
                  <div className="meta">
                    {lead.sector || "—"}
                    {lead.city ? ` · ${lead.city}` : ""}
                  </div>
                  <div className="row">
                    <span className="badge gray">
                      {lead.estimated_value > 0
                        ? fmtKeur(lead.estimated_value)
                        : "À chiffrer"}
                    </span>
                    {lead.probability != null && (
                      <span className={"proba " + probaClass(lead.probability)}>
                        <span className="dot" />
                        {lead.probability} %
                      </span>
                    )}
                  </div>
                  <div className="move-btns">
                    {stage.id === "perdu" ? (
                      <button onClick={() => setStage(lead, "nouveau")}>
                        ↩ Réactiver
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => move(lead, -1)}
                          disabled={HAPPY.indexOf(lead.stage) <= 0}
                        >
                          ◀
                        </button>
                        <button
                          onClick={() => move(lead, 1)}
                          disabled={HAPPY.indexOf(lead.stage) >= HAPPY.length - 1}
                        >
                          ▶
                        </button>
                        <button onClick={() => setStage(lead, "perdu")}>
                          ✕ Perdu
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="muted" style={{ fontSize: 12, padding: "8px 5px" }}>
                  {isTarget ? "Déposer ici" : "Aucun lead"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <NewLeadModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

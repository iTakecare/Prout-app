import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AssessmentForm from "../components/AssessmentForm";
import ResultView from "../components/ResultView";
import type { AssessmentInput, CalcResult, Lead, Substrate } from "../types";

type Input = AssessmentInput & { label?: string };

export default function Calculator() {
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [lastInput, setLastInput] = useState<Input | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedLead, setSelectedLead] = useState("");
  const [saved, setSaved] = useState<Lead | null>(null);

  useEffect(() => {
    api
      .meta()
      .then((m) => setSubstrates(m.substrates))
      .catch((e) => setError(e.message));
    api.leads().then(setLeads).catch(() => undefined);
  }, []);

  async function runCalc(input: Input) {
    setBusy(true);
    setError("");
    setSaved(null);
    try {
      setResult(await api.calc(input));
      setLastInput(input);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveToClient() {
    if (!selectedLead || !lastInput) return;
    setSaving(true);
    setError("");
    try {
      await api.addAssessment(Number(selectedLead), lastInput);
      setSaved(leads.find((l) => String(l.id) === selectedLead) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Calculateur de biométhanisation</h1>
          <p>
            Estimez le potentiel d'une unité Waste-end à partir du gisement de
            déchets alimentaires d'un établissement, puis rattachez l'étude à un
            client.
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="cols-2">
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 14 }}>
            Déchets alimentaires de l'établissement
          </h3>
          {substrates.length > 0 && (
            <AssessmentForm
              substrates={substrates}
              submitLabel="Calculer le potentiel"
              busy={busy}
              showLabel
              onSubmit={runCalc}
            />
          )}
        </div>
        <div>
          {result ? (
            <div className="stack">
              <ResultView result={result} />
              <div className="card">
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>
                  Rattacher cette étude à un client
                </h3>
                {saved ? (
                  <div className="badge" style={{ display: "block", padding: 12 }}>
                    ✓ Étude enregistrée pour <strong>{saved.company}</strong>.{" "}
                    <Link
                      to={`/leads/${saved.id}`}
                      style={{ textDecoration: "underline" }}
                    >
                      Ouvrir la fiche client
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>Client</label>
                      <select
                        value={selectedLead}
                        onChange={(e) => setSelectedLead(e.target.value)}
                      >
                        <option value="">— Choisir un client —</option>
                        {leads.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.company}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn"
                      disabled={!selectedLead || saving}
                      onClick={saveToClient}
                    >
                      {saving ? "Enregistrement…" : "Enregistrer l'étude pour ce client"}
                    </button>
                    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                      L'étude apparaîtra dans l'onglet « Études » de la fiche
                      client. Aucun client ?{" "}
                      <Link to="/pipeline" style={{ textDecoration: "underline" }}>
                        Créez-en un depuis le pipeline
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="card empty">
              Renseignez les déchets alimentaires et lancez le calcul pour
              afficher la pertinence du projet et les bénéfices estimés.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

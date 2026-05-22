import { useEffect, useState } from "react";
import { api } from "../api";
import AssessmentForm from "../components/AssessmentForm";
import ResultView from "../components/ResultView";
import type { CalcResult, Substrate } from "../types";

export default function Calculator() {
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.meta().then((m) => setSubstrates(m.substrates)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Calculateur de biométhanisation</h1>
          <p>
            Estimez le potentiel d'une unité Waste-end à partir du gisement de
            déchets alimentaires d'un établissement.
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
              onSubmit={async (input) => {
                setBusy(true);
                setError("");
                try {
                  setResult(await api.calc(input));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </div>
        <div>
          {result ? (
            <ResultView result={result} />
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

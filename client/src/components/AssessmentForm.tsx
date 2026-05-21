import { useMemo, useState } from "react";
import type { AssessmentInput, CalcLine, Substrate } from "../types";

interface Props {
  substrates: Substrate[];
  onSubmit: (input: AssessmentInput & { label?: string }) => void;
  submitLabel: string;
  busy?: boolean;
  showLabel?: boolean;
  initial?: Partial<AssessmentInput> & { label?: string };
}

export default function AssessmentForm({
  substrates,
  onSubmit,
  submitLabel,
  busy,
  showLabel,
  initial,
}: Props) {
  const [label, setLabel] = useState(initial?.label ?? "Étude de méthanisation");
  const [lines, setLines] = useState<CalcLine[]>(
    initial?.lines && initial.lines.length
      ? initial.lines
      : [{ substrateId: substrates[0]?.id ?? "", tonnage: 0 }],
  );
  const [valorization, setValorization] = useState(
    initial?.valorization ?? "cogeneration",
  );
  const [ch4Content, setCh4Content] = useState(
    Math.round((initial?.ch4Content ?? 0.55) * 100),
  );
  const [energyOutlet, setEnergyOutlet] = useState(
    initial?.energyOutlet ?? "partiel",
  );
  const [spaceAvailable, setSpaceAvailable] = useState(
    initial?.spaceAvailable ?? true,
  );
  const [disposalCost, setDisposalCost] = useState(initial?.disposalCost ?? 0);
  const [supplyRegularity, setSupplyRegularity] = useState(
    initial?.supplyRegularity ?? "reguliere",
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Substrate[]>();
    for (const s of substrates) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return [...map.entries()];
  }, [substrates]);

  function updateLine(i: number, patch: Partial<CalcLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    onSubmit({
      label,
      valorization,
      ch4Content: ch4Content / 100,
      energyOutlet,
      spaceAvailable,
      disposalCost: Number(disposalCost) || 0,
      supplyRegularity,
      lines: lines.filter((l) => l.substrateId && Number(l.tonnage) > 0),
    });
  }

  return (
    <div>
      {showLabel && (
        <div className="field">
          <label>Intitulé de l'étude</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      )}

      <label>Gisement de déchets organiques (tonnes brutes / an)</label>
      {lines.map((line, i) => (
        <div className="split-line" key={i}>
          <select
            value={line.substrateId}
            onChange={(e) => updateLine(i, { substrateId: e.target.value })}
          >
            <option value="">— Choisir un substrat —</option>
            {grouped.map(([cat, items]) => (
              <optgroup label={cat} key={cat}>
                {items.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={line.tonnage || ""}
            placeholder="t/an"
            onChange={(e) => updateLine(i, { tonnage: Number(e.target.value) })}
          />
          <span className="muted" style={{ fontSize: 12 }}>
            t/an
          </span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
            disabled={lines.length === 1}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn ghost sm"
        onClick={() =>
          setLines((ls) => [...ls, { substrateId: "", tonnage: 0 }])
        }
        style={{ marginBottom: 16 }}
      >
        + Ajouter un substrat
      </button>

      <div className="form-row">
        <div className="field">
          <label>Mode de valorisation</label>
          <select
            value={valorization}
            onChange={(e) =>
              setValorization(e.target.value as AssessmentInput["valorization"])
            }
          >
            <option value="cogeneration">Cogénération (élec + chaleur)</option>
            <option value="biomethane">Biométhane (injection réseau)</option>
          </select>
        </div>
        <div className="field">
          <label>Teneur en CH₄ du biogaz : {ch4Content} %</label>
          <input
            type="range"
            min={45}
            max={70}
            value={ch4Content}
            onChange={(e) => setCh4Content(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Débouché énergétique sur site</label>
          <select
            value={energyOutlet}
            onChange={(e) =>
              setEnergyOutlet(e.target.value as AssessmentInput["energyOutlet"])
            }
          >
            <option value="aucun">Aucun</option>
            <option value="partiel">Partiel</option>
            <option value="important">Important</option>
          </select>
        </div>
        <div className="field">
          <label>Régularité de l'approvisionnement</label>
          <select
            value={supplyRegularity}
            onChange={(e) =>
              setSupplyRegularity(
                e.target.value as AssessmentInput["supplyRegularity"],
              )
            }
          >
            <option value="reguliere">Régulière</option>
            <option value="saisonniere">Saisonnière</option>
            <option value="irreguliere">Irrégulière</option>
          </select>
        </div>
        <div className="field">
          <label>Coût actuel d'élimination (€/t)</label>
          <input
            type="number"
            min={0}
            value={disposalCost || ""}
            onChange={(e) => setDisposalCost(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label>Foncier disponible</label>
          <select
            value={spaceAvailable ? "1" : "0"}
            onChange={(e) => setSpaceAvailable(e.target.value === "1")}
          >
            <option value="1">Oui</option>
            <option value="0">Non / limité</option>
          </select>
        </div>
      </div>

      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? "Calcul en cours…" : submitLabel}
      </button>
    </div>
  );
}

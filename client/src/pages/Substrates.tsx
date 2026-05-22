import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtInt } from "../format";
import type { Substrate } from "../types";

const CATEGORIES = [
  "Épluchures & préparation",
  "Restes de repas & invendus",
  "Sous-produits riches",
  "Autres déchets",
];

function SubstrateRow({
  s,
  onChange,
  onError,
}: {
  s: Substrate;
  onChange: () => void;
  onError: (m: string) => void;
}) {
  const [f, setF] = useState({
    name: s.name,
    category: s.category,
    ts: Math.round(s.ts * 100),
    vs: Math.round(s.vs * 100),
    bmp: Math.round(s.bmp),
  });
  const [busy, setBusy] = useState(false);
  const dirty =
    f.name !== s.name ||
    f.category !== s.category ||
    f.ts !== Math.round(s.ts * 100) ||
    f.vs !== Math.round(s.vs * 100) ||
    f.bmp !== Math.round(s.bmp);

  async function guard(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </td>
      <td>
        <select
          value={f.category}
          onChange={(e) => setF({ ...f, category: e.target.value })}
        >
          {[...new Set([...CATEGORIES, f.category])].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="num">
        <input
          type="number"
          min={0}
          max={100}
          value={f.ts}
          onChange={(e) => setF({ ...f, ts: Number(e.target.value) })}
        />
      </td>
      <td className="num">
        <input
          type="number"
          min={0}
          max={100}
          value={f.vs}
          onChange={(e) => setF({ ...f, vs: Number(e.target.value) })}
        />
      </td>
      <td className="num">
        <input
          type="number"
          min={0}
          value={f.bmp}
          onChange={(e) => setF({ ...f, bmp: Number(e.target.value) })}
        />
      </td>
      <td className="num muted">{fmtInt((f.ts / 100) * (f.vs / 100) * f.bmp)} m³</td>
      <td style={{ whiteSpace: "nowrap" }}>
        <button
          className="btn sm"
          disabled={!dirty || busy}
          onClick={() =>
            guard(() =>
              api.updateSubstrate(s.id, {
                name: f.name,
                category: f.category,
                ts: f.ts / 100,
                vs: f.vs / 100,
                bmp: f.bmp,
              }),
            )
          }
        >
          Enregistrer
        </button>{" "}
        <button
          className="btn danger sm"
          disabled={busy}
          onClick={() => {
            if (confirm(`Supprimer « ${s.name} » du référentiel ?`)) {
              guard(() => api.deleteSubstrate(s.id));
            }
          }}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export default function Substrates() {
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState({
    name: "",
    category: CATEGORIES[0],
    ts: 25,
    vs: 88,
    bmp: 450,
  });

  function load() {
    api.substrates().then(setSubstrates).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function add() {
    if (!adding.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      setSubstrates(
        await api.createSubstrate({
          name: adding.name,
          category: adding.category,
          ts: adding.ts / 100,
          vs: adding.vs / 100,
          bmp: adding.bmp,
        }),
      );
      setAdding({ name: "", category: adding.category, ts: 25, vs: 88, bmp: 450 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const categories = [...new Set(substrates.map((s) => s.category))];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Référentiel des déchets alimentaires</h1>
          <p>
            Caractéristiques utilisées par le moteur de calcul. Modifiez les
            valeurs, ajoutez ou retirez des déchets selon vos retours terrain.
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Ajouter un déchet</h3>
        <div className="form-row">
          <div className="field" style={{ margin: 0 }}>
            <label>Nom du déchet</label>
            <input
              value={adding.name}
              placeholder="ex. Coquilles d'œufs"
              onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Catégorie</label>
            <select
              value={adding.category}
              onChange={(e) => setAdding({ ...adding, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Matière sèche (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={adding.ts}
              onChange={(e) => setAdding({ ...adding, ts: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Matière organique (% MS)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={adding.vs}
              onChange={(e) => setAdding({ ...adding, vs: Number(e.target.value) })}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Potentiel CH₄ (m³/t MO)</label>
            <input
              type="number"
              min={0}
              value={adding.bmp}
              onChange={(e) => setAdding({ ...adding, bmp: Number(e.target.value) })}
            />
          </div>
        </div>
        <button
          className="btn"
          style={{ marginTop: 6 }}
          disabled={busy || !adding.name.trim()}
          onClick={add}
        >
          + Ajouter au référentiel
        </button>
      </div>

      <div className="stack">
        {categories.map((cat) => (
          <div className="card" key={cat}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>{cat}</h3>
            <table>
              <thead>
                <tr>
                  <th>Déchet</th>
                  <th>Catégorie</th>
                  <th className="num">MS %</th>
                  <th className="num">MO % MS</th>
                  <th className="num">CH₄ m³/t MO</th>
                  <th className="num">CH₄/t brute</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {substrates
                  .filter((s) => s.category === cat)
                  .map((s) => (
                    <SubstrateRow
                      key={s.id}
                      s={s}
                      onChange={load}
                      onError={setError}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        ))}
        {substrates.length === 0 && (
          <div className="card empty">Aucun déchet dans le référentiel.</div>
        )}
      </div>
    </div>
  );
}

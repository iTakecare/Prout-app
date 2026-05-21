import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { fmtInt } from "../format";
import type { Substrate } from "../types";

export default function Substrates() {
  const [substrates, setSubstrates] = useState<Substrate[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.meta().then((m) => setSubstrates(m.substrates)).catch((e) => setError(e.message));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Substrate[]>();
    for (const s of substrates) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return [...map.entries()];
  }, [substrates]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Référentiel des substrats</h1>
          <p>
            Caractéristiques de référence utilisées par le moteur de calcul :
            matière sèche, matière organique et potentiel méthanogène.
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="stack">
        {grouped.map(([cat, items]) => (
          <div className="card" key={cat}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>{cat}</h3>
            <table>
              <thead>
                <tr>
                  <th>Substrat</th>
                  <th className="num">Matière sèche</th>
                  <th className="num">Matière organique</th>
                  <th className="num">Potentiel méthanogène</th>
                  <th className="num">CH₄ par tonne brute</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="num">{Math.round(s.ts * 100)} %</td>
                    <td className="num">{Math.round(s.vs * 100)} % MS</td>
                    <td className="num">{fmtInt(s.bmp)} m³/t MO</td>
                    <td className="num">
                      {fmtInt(s.ts * s.vs * s.bmp)} m³
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

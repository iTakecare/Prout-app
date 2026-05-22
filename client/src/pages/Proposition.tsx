import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { LogoMark } from "../components/Logo";
import { ProbabilityGauge } from "../components/ResultView";
import { fmtDate, fmtEnergy, fmtEur, fmtInt, fmtNum } from "../format";
import type { Assessment, Lead } from "../types";

const ECO_ARGS = [
  "Économie circulaire : vos déchets alimentaires deviennent de l'énergie et de l'engrais, directement sur votre site.",
  "Zéro transport : suppression des tournées de camions pour la collecte des biodéchets.",
  "Moins d'incinération : réduction directe et mesurable des émissions de CO₂.",
  "Atout RSE et image : une démarche concrète à valoriser auprès de vos usagers, parents, résidents ou clients.",
  "Conformité : anticipe l'obligation de tri à la source des biodéchets.",
];

const SUPPORT_ARGS = [
  "Subvention régionale wallonne à la biométhanisation des déchets organiques, de l'ordre de 32,5 €/tonne traitée.",
  "Prise en charge jusqu'à 35 % des coûts d'investissement et de fonctionnement subsidiables d'une installation de biométhanisation.",
  "Primes à la collecte sélective des déchets organiques (de l'ordre de 20 €/tonne).",
  "Cadre réglementaire favorable : le tri à la source des biodéchets est encouragé et progressivement rendu obligatoire.",
];

export default function Proposition() {
  const { assessmentId } = useParams();
  const [data, setData] = useState<(Assessment & { lead: Lead | null }) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .assessment(Number(assessmentId))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [assessmentId]);

  if (error)
    return (
      <div className="doc-screen">
        <div className="error-box" style={{ maxWidth: 820, margin: "0 auto" }}>
          {error}
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="doc-screen">
        <p style={{ textAlign: "center", color: "#dfe9e3" }}>Chargement…</p>
      </div>
    );

  const r = data.result;
  const lead = data.lead;
  const company = lead?.company ?? "Établissement";

  return (
    <div className="doc-screen">
      <div className="doc-toolbar">
        <Link to={lead ? `/leads/${lead.id}` : "/"} className="btn ghost">
          ← Retour
        </Link>
        <button className="btn" onClick={() => window.print()}>
          ⤓ Télécharger en PDF
        </button>
      </div>

      <div className="doc">
        <div className="doc-hero">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 20,
            }}
          >
            <div>
              <div className="kicker">Proposition Waste-end</div>
              <h1>Valorisation des déchets alimentaires sur site</h1>
              <div className="client">
                {company}
                {lead?.city ? ` · ${lead.city}` : ""}
              </div>
            </div>
            <LogoMark size={54} />
          </div>
        </div>

        <div className="doc-body">
          <div className="doc-section">
            <h2>Le constat</h2>
            <p>
              {company} produit environ <strong>{fmtInt(r.totalTonnage)} tonnes
              de déchets alimentaires par an</strong>. Aujourd'hui, ces biodéchets
              sont collectés puis incinérés : un poste de coût croissant et une
              ressource gaspillée.
            </p>
          </div>

          <div className="doc-section">
            <h2>La solution Waste-end</h2>
            <p>
              Une unité de biométhanisation compacte, installée directement dans
              votre établissement, transforme ces déchets par digestion anaérobie
              en deux ressources : du <strong>biogaz</strong>, énergie verte pour
              la cuisine et l'eau chaude, et du <strong>digestat</strong>, un
              engrais naturel. Le traitement se fait sur place, sans collecte ni
              transport.
            </p>
          </div>

          <div className="doc-section">
            <h2>Les résultats estimés</h2>
            <div className="doc-kpis">
              <div className="doc-kpi">
                <div className="v">{fmtInt(r.totalTonnage)} t/an</div>
                <div className="l">Déchets traités</div>
              </div>
              <div className="doc-kpi">
                <div className="v">{fmtInt(r.ch4Total)} m³</div>
                <div className="l">Méthane / an</div>
              </div>
              <div className="doc-kpi">
                <div className="v">{fmtEnergy(r.heatUsableKwh)}</div>
                <div className="l">Chaleur valorisable</div>
              </div>
              <div className="doc-kpi">
                <div className="v">{fmtInt(r.digestate)} t/an</div>
                <div className="l">Digestat (engrais)</div>
              </div>
              <div className="doc-kpi">
                <div className="v">{fmtInt(r.co2Avoided)} t/an</div>
                <div className="l">CO₂ évité</div>
              </div>
              <div className="doc-kpi">
                <div className="v">{fmtEur(r.totalBenefit)}</div>
                <div className="l">Bénéfice annuel estimé</div>
              </div>
            </div>
          </div>

          <div className="doc-section">
            <div className="doc-callout">
              <div className="big">{fmtInt(r.co2Avoided)} t</div>
              <div>
                de CO₂ évitées chaque année en traitant vos biodéchets sur place
                plutôt qu'en les incinérant.
                <br />
                <span style={{ fontSize: 11, opacity: 0.75 }}>
                  Réf. étude Bruxelles Environnement : 124 t CO₂ pour 1 000 t de
                  déchets de cuisine.
                </span>
              </div>
            </div>
          </div>

          <div className="doc-section">
            <h2>Une démarche écoresponsable</h2>
            <ul className="doc-args">
              {ECO_ARGS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <div className="doc-section">
            <h2>Les soutiens publics</h2>
            <ul className="doc-args">
              {SUPPORT_ARGS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p style={{ fontSize: 11, color: "#8a978f", marginTop: 8 }}>
              Montants indicatifs, à confirmer selon les dispositifs régionaux en
              vigueur au moment du projet.
            </p>
          </div>

          <div className="doc-section">
            <h2>Pertinence du projet</h2>
            <ProbabilityGauge result={r} />
            <p style={{ marginTop: 14 }}>
              Le bénéfice annuel estimé combine{" "}
              <strong>{fmtEur(r.disposalSaving)}</strong> de coûts de collecte
              évités et <strong>{fmtEur(r.heatValue)}</strong> d'énergie
              valorisée — pour {fmtInt(r.totalTonnage)} t de déchets et un
              potentiel méthanogène moyen de {fmtNum(r.avgBmp, 0)} m³ CH₄/t MO.
            </p>
          </div>
        </div>

        <div className="doc-foot">
          <span>Waste-end — Your waste, your solution · www.waste-end.com</span>
          <span>Proposition établie le {fmtDate(data.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

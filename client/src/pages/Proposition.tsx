import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { LogoFull } from "../components/Logo";
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

const TEAM = [
  {
    name: "Lola Brousmiche",
    role: "Co-fondatrice · Ingénieure chimiste",
    photo: "/team/lola.jpg",
    bio: "Lors de sa formation d'ingénieur en chimie, Lola s'est spécialisée dans la biométhanisation des déchets alimentaires lors de son stage et de son travail de fin d'étude. Elle a ensuite approfondi sa connaissance du sujet pendant deux ans au sein de ValBiom asbl, experts en valorisation de la biomasse en Wallonie. Co-fondatrice de Waste-end et Circular Economy Optimist, elle dimensionne au mieux l'installation qui vous convient grâce à ses compétences techniques.",
  },
  {
    name: "Régis Coli",
    role: "Chief Technology Officer",
    photo: "/team/regis.jpg",
    bio: "Fort d'une expérience riche et de compétences techniques pointues, Régis a rejoint Waste-end comme Chief Technology Officer. Curieux, visionnaire et animé par la volonté de trouver des solutions concrètes, il apporte un regard neuf, transforme les défis en opportunités et fait avancer Waste-end vers un futur toujours plus circulaire.",
  },
];

const SUPPORTERS = [
  "Ceneo — une énergie commune",
  "YEP Tech — Polytech Mons",
  "Charleroi Entreprendre",
  "Fondation pour les Générations Futures",
  "Ignity — Start to Scale",
  "Resto du Cœur",
  "KAYA — Belgian Coalition of Ecopreneurs",
  "Lauréat Réseau Entreprendre Wallonie",
  "VLAIO",
  "Wallonie Entreprendre",
  "POM Oost-Vlaanderen",
  "POM West-Vlaanderen",
  "Grand Est Développement",
];

const COFINANCERS = [
  "Union européenne",
  "Interreg France-Wallonie-Vlaanderen",
  "Région Grand Est",
  "Province d'Oost-Vlaanderen",
  "Région Hauts-de-France",
  "Wallonie",
  "Province de West-Vlaanderen",
];

const AWARDS = [
  "Gagnant Inno Pépites Award 2018 — catégorie jeunes entreprises",
  "Gagnant Interreg Protopitch, Boostcamp 2018 — Prix Securex",
  "Lauréat Mind & Market 2019 — Prix de la catégorie lancement",
  "Lauréat Mind & Market 2019 — Prix du jury",
  "Fondation pour les Générations Futures 2020 — Bourse de prototypage",
  "Fondation pour les Générations Futures 2023 — Lauréat du Fonds SE'nSE",
  "Ceneo — Lauréat du prix Ineo 2023",
  "Lauréat du Starter Fund 2025",
  "Lauréat du Réseau Entreprendre Wallonie",
];

function Avatar({ src, name }: { src: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2);
    return <div className="team-photo team-photo-fallback">{initials}</div>;
  }
  return (
    <img
      className="team-photo"
      src={src}
      alt={name}
      onError={() => setBroken(true)}
    />
  );
}

function Supporters() {
  const [broken, setBroken] = useState(false);
  if (!broken) {
    return (
      <img
        className="doc-supporters-img"
        src="/supporters.png"
        alt="Partenaires et soutiens de Waste-end"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <>
      <div className="supporter-chips">
        {SUPPORTERS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="cofin-label">Co-financeurs</div>
      <div className="supporter-chips">
        {COFINANCERS.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </>
  );
}

export default function Proposition() {
  const { assessmentId } = useParams();
  const [data, setData] = useState<(Assessment & { lead: Lead | null }) | null>(null);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

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

  async function downloadPdf() {
    const el = docRef.current;
    if (!el) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.95);
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`Proposition Waste-end - ${company}.pdf`);
    } catch {
      alert("La génération du PDF a échoué. Veuillez réessayer.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="doc-screen">
      <div className="doc-toolbar">
        <Link to={lead ? `/leads/${lead.id}` : "/"} className="btn ghost">
          ← Retour
        </Link>
        <button className="btn" onClick={downloadPdf} disabled={pdfBusy}>
          {pdfBusy ? "Génération du PDF…" : "⤓ Télécharger le PDF"}
        </button>
      </div>

      <div className="doc" ref={docRef}>
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
            <LogoFull iconSize={48} />
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

          <div className="doc-section">
            <h2>Notre équipe</h2>
            <div className="doc-team">
              {TEAM.map((m) => (
                <div className="team-member" key={m.name}>
                  <Avatar src={m.photo} name={m.name} />
                  <div>
                    <div className="t-name">{m.name}</div>
                    <div className="t-role">{m.role}</div>
                    <div className="t-bio">{m.bio}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="doc-section">
            <h2>Prix &amp; distinctions</h2>
            <ul className="doc-args">
              {AWARDS.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <div className="doc-section">
            <h2>Ils soutiennent le projet</h2>
            <Supporters />
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

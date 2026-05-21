import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compute, type CalcContext, type CalcLine } from "./calc.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "crm.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/** Étapes du pipeline commercial, du lead à l'après-vente. */
export const STAGES = [
  { id: "nouveau", label: "Nouveau lead", win: 0.1 },
  { id: "qualifie", label: "Qualifié", win: 0.25 },
  { id: "etude", label: "Étude technique", win: 0.4 },
  { id: "proposition", label: "Proposition envoyée", win: 0.6 },
  { id: "negociation", label: "Négociation", win: 0.8 },
  { id: "gagne", label: "Gagné — Installation", win: 1 },
  { id: "service", label: "En service — Suivi", win: 1 },
  { id: "perdu", label: "Perdu", win: 0 },
] as const;

export const STAGE_IDS = STAGES.map((s) => s.id);
export const STAGE_WIN: Record<string, number> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.win]),
);

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Belgique',
  source TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'nouveau',
  owner TEXT NOT NULL DEFAULT '',
  estimated_value REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  valorization TEXT NOT NULL DEFAULT 'cogeneration',
  inputs_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  probability REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normale',
  status TEXT NOT NULL DEFAULT 'ouvert',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
`);

function seed(): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number };
  if (n > 0) return;

  const insLead = db.prepare(`
    INSERT INTO leads (company, contact_name, email, phone, sector, address, city, country,
                       source, stage, owner, estimated_value, notes, created_at)
    VALUES (@company, @contact_name, @email, @phone, @sector, @address, @city, @country,
            @source, @stage, @owner, @estimated_value, @notes, datetime('now', @age))
  `);
  const insAssessment = db.prepare(`
    INSERT INTO assessments (lead_id, label, valorization, inputs_json, result_json, probability)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insActivity = db.prepare(`
    INSERT INTO activities (lead_id, type, summary, created_at)
    VALUES (?, ?, ?, datetime('now', ?))
  `);
  const insTicket = db.prepare(`
    INSERT INTO tickets (lead_id, title, description, priority, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  const addAssessment = (
    leadId: number,
    label: string,
    ctx: CalcContext,
    lines: CalcLine[],
  ): void => {
    const result = compute(lines, ctx);
    insAssessment.run(
      leadId,
      label,
      ctx.valorization,
      JSON.stringify({ ...ctx, lines }),
      JSON.stringify(result),
      result.probability,
    );
  };

  type Demo = {
    lead: Record<string, unknown>;
    assessment?: { label: string; ctx: CalcContext; lines: CalcLine[] };
    activities?: Array<[string, string, string]>;
    tickets?: Array<[string, string, string, string]>;
  };

  const demos: Demo[] = [
    {
      lead: {
        company: "Ferme du Grand Pré",
        contact_name: "Étienne Dubois",
        email: "e.dubois@grandpre.be",
        phone: "+32 81 22 14 55",
        sector: "Élevage bovin",
        address: "Route de Gembloux 120",
        city: "Namur",
        country: "Belgique",
        source: "Salon Agribex",
        stage: "etude",
        owner: "Camille Verhoeven",
        estimated_value: 480000,
        notes: "Exploitation laitière 220 têtes. Cherche à valoriser ses effluents et à sécuriser sa facture énergétique.",
        age: "-26 days",
      },
      assessment: {
        label: "Étude initiale — cogénération",
        ctx: {
          valorization: "cogeneration",
          ch4Content: 0.55,
          energyOutlet: "partiel",
          spaceAvailable: true,
          disposalCost: 0,
          supplyRegularity: "reguliere",
        },
        lines: [
          { substrateId: "lisier-bovin", tonnage: 7200 },
          { substrateId: "fumier-bovin", tonnage: 1800 },
          { substrateId: "cive-seigle", tonnage: 2600 },
        ],
      },
      activities: [
        ["rdv", "Visite de l'exploitation et relevé des gisements d'effluents.", "-20 days"],
        ["email", "Envoi du pré-dimensionnement et de l'estimation de production.", "-12 days"],
        ["appel", "Le client confirme l'intérêt, demande un chiffrage cogénération.", "-4 days"],
      ],
    },
    {
      lead: {
        company: "Brasserie Houblon d'Or",
        contact_name: "Marie Lefèvre",
        email: "m.lefevre@houblondor.be",
        phone: "+32 4 223 88 10",
        sector: "Agro-alimentaire — brasserie",
        address: "Quai des Tanneurs 7",
        city: "Liège",
        country: "Belgique",
        source: "Recommandation client",
        stage: "proposition",
        owner: "Camille Verhoeven",
        estimated_value: 620000,
        notes: "Produit 18 000 hl/an. Coûts d'évacuation des drêches en forte hausse.",
        age: "-40 days",
      },
      assessment: {
        label: "Étude valorisation drêches + lactosérum",
        ctx: {
          valorization: "cogeneration",
          ch4Content: 0.58,
          energyOutlet: "important",
          spaceAvailable: true,
          disposalCost: 45,
          supplyRegularity: "reguliere",
        },
        lines: [
          { substrateId: "dreches-brasserie", tonnage: 4200 },
          { substrateId: "lactoserum", tonnage: 1600 },
          { substrateId: "marc-fruits", tonnage: 900 },
        ],
      },
      activities: [
        ["rdv", "Audit des flux de sous-produits sur site.", "-30 days"],
        ["devis", "Proposition technico-commerciale envoyée — unité 250 kWe.", "-6 days"],
      ],
      tickets: [],
    },
    {
      lead: {
        company: "Coopérative maraîchère Val-Vert",
        contact_name: "Hugo Maréchal",
        email: "contact@valvert-coop.be",
        phone: "+32 10 45 67 89",
        sector: "Maraîchage",
        address: "Chaussée de Wavre 310",
        city: "Wavre",
        country: "Belgique",
        source: "Formulaire site web",
        stage: "qualifie",
        owner: "Yanis Brahimi",
        estimated_value: 210000,
        notes: "Écarts de tri et invendus à valoriser. Gisement saisonnier à confirmer.",
        age: "-9 days",
      },
      activities: [
        ["appel", "Qualification du besoin — gisement estimé à 2 500 t/an.", "-7 days"],
      ],
    },
    {
      lead: {
        company: "Carrefour Supply Hub",
        contact_name: "Sophie Nguyen",
        email: "s.nguyen@supplyhub.be",
        phone: "+32 2 555 33 22",
        sector: "Grande distribution — logistique",
        address: "Boulevard Industriel 45",
        city: "Bruxelles",
        country: "Belgique",
        source: "Campagne LinkedIn",
        stage: "nouveau",
        owner: "Yanis Brahimi",
        estimated_value: 0,
        notes: "Plateforme logistique avec invendus alimentaires importants. Premier contact à organiser.",
        age: "-2 days",
      },
    },
    {
      lead: {
        company: "Agri-Métha SmartFarm",
        contact_name: "Laurent Pirard",
        email: "l.pirard@smartfarm.be",
        phone: "+32 63 21 09 87",
        sector: "Élevage porcin & grandes cultures",
        address: "Rue de la Semois 2",
        city: "Arlon",
        country: "Belgique",
        source: "Salon Agribex",
        stage: "gagne",
        owner: "Camille Verhoeven",
        estimated_value: 940000,
        notes: "Contrat signé — unité de biométhane avec injection réseau. Chantier planifié.",
        age: "-120 days",
      },
      assessment: {
        label: "Dimensionnement contractuel — injection biométhane",
        ctx: {
          valorization: "biomethane",
          ch4Content: 0.55,
          energyOutlet: "important",
          spaceAvailable: true,
          disposalCost: 20,
          supplyRegularity: "reguliere",
        },
        lines: [
          { substrateId: "lisier-porcin", tonnage: 13000 },
          { substrateId: "ensilage-mais", tonnage: 4200 },
          { substrateId: "fumier-volaille", tonnage: 2100 },
        ],
      },
      activities: [
        ["devis", "Offre finale acceptée — signature du contrat d'installation.", "-15 days"],
        ["note", "Lancement des études d'exécution et de la commande des équipements.", "-8 days"],
      ],
    },
    {
      lead: {
        company: "Site Bio-Énergie Méthavalor",
        contact_name: "Nathalie Crols",
        email: "n.crols@methavalor.be",
        phone: "+32 87 44 55 66",
        sector: "Méthanisation territoriale",
        address: "Zoning de la Hesbaye 14",
        city: "Hannut",
        country: "Belgique",
        source: "Client historique",
        stage: "service",
        owner: "Camille Verhoeven",
        estimated_value: 1250000,
        notes: "Unité en exploitation depuis 14 mois. Contrat de maintenance Waste-end actif.",
        age: "-430 days",
      },
      assessment: {
        label: "Bilan d'exploitation — co-digestion",
        ctx: {
          valorization: "cogeneration",
          ch4Content: 0.56,
          energyOutlet: "important",
          spaceAvailable: true,
          disposalCost: 35,
          supplyRegularity: "reguliere",
        },
        lines: [
          { substrateId: "biodechets-menagers", tonnage: 6800 },
          { substrateId: "graisses-flottation", tonnage: 1400 },
          { substrateId: "tontes-vegetaux", tonnage: 2200 },
          { substrateId: "boues-agro", tonnage: 1800 },
        ],
      },
      activities: [
        ["note", "Visite de maintenance préventive trimestrielle réalisée.", "-25 days"],
      ],
      tickets: [
        [
          "Baisse de production biogaz constatée",
          "Le rendement CH₄ a chuté de 8 % sur deux semaines. Suspicion de surcharge organique du digesteur.",
          "haute",
          "en_cours",
        ],
        [
          "Révision annuelle du moteur de cogénération",
          "Planifier la révision des 6 000 h du moteur avec le prestataire.",
          "normale",
          "ouvert",
        ],
      ],
    },
    {
      lead: {
        company: "Cuisine centrale Le Délice",
        contact_name: "Olivier Sart",
        email: "o.sart@ledelice.be",
        phone: "+32 71 33 22 11",
        sector: "Restauration collective",
        address: "Rue du Marché 88",
        city: "Charleroi",
        country: "Belgique",
        source: "Formulaire site web",
        stage: "perdu",
        owner: "Yanis Brahimi",
        estimated_value: 0,
        notes: "Gisement trop faible et irrégulier pour une unité dédiée. Orienté vers une collecte mutualisée.",
        age: "-60 days",
      },
      activities: [
        ["appel", "Gisement insuffisant pour un projet autonome — dossier clôturé.", "-30 days"],
      ],
    },
  ];

  const tx = db.transaction(() => {
    for (const demo of demos) {
      const info = insLead.run(demo.lead);
      const leadId = Number(info.lastInsertRowid);
      if (demo.assessment) {
        addAssessment(leadId, demo.assessment.label, demo.assessment.ctx, demo.assessment.lines);
      }
      for (const [type, summary, age] of demo.activities ?? []) {
        insActivity.run(leadId, type, summary, age);
      }
      for (const [title, description, priority, status] of demo.tickets ?? []) {
        insTicket.run(leadId, title, description, priority, status);
      }
    }
  });
  tx();
}

seed();

export default db;

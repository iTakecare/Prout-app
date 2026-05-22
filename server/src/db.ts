import pg from "pg";
import {
  compute,
  DEFAULT_SUBSTRATES,
  type CalcContext,
  type CalcLine,
} from "./calc.js";

const { Pool } = pg;

/** Pool de connexions PostgreSQL. */
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://prout:prout@localhost:5432/prout",
});

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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  valorization TEXT NOT NULL DEFAULT 'thermique',
  inputs_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  probability REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normale',
  status TEXT NOT NULL DEFAULT 'ouvert',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS substrates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  ts DOUBLE PRECISION NOT NULL,
  vs DOUBLE PRECISION NOT NULL,
  bmp DOUBLE PRECISION NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_assessments_lead ON assessments(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_tickets_lead ON tickets(lead_id);
`;

async function seedSubstrates(): Promise<void> {
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM substrates",
  );
  if (rows[0].n > 0) return;
  let position = 0;
  for (const s of DEFAULT_SUBSTRATES) {
    await pool.query(
      `INSERT INTO substrates (id, name, category, ts, vs, bmp, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [s.id, s.name, s.category, s.ts, s.vs, s.bmp, position++],
    );
  }
}

type Demo = {
  lead: {
    company: string;
    contact_name: string;
    email: string;
    phone: string;
    sector: string;
    address: string;
    city: string;
    country: string;
    source: string;
    stage: string;
    owner: string;
    estimated_value: number;
    notes: string;
    age: string;
  };
  assessment?: { label: string; ctx: CalcContext; lines: CalcLine[] };
  activities?: Array<[string, string, string]>;
  tickets?: Array<[string, string, string, string]>;
};

const DEMOS: Demo[] = [
  {
    lead: {
      company: "Athénée Royal de Gembloux",
      contact_name: "Sophie Delvaux",
      email: "intendance@ar-gembloux.be",
      phone: "+32 81 61 12 40",
      sector: "École — cantine scolaire",
      address: "Rue Verlaine 12",
      city: "Gembloux",
      country: "Belgique",
      source: "Salon des collectivités durables",
      stage: "etude",
      owner: "Camille Verhoeven",
      estimated_value: 38000,
      notes:
        "Cantine de 600 couverts/jour. Souhaite traiter ses déchets alimentaires sur site plutôt que de payer la collecte.",
      age: "-24 days",
    },
    assessment: {
      label: "Étude de faisabilité — cantine scolaire",
      ctx: {
        ch4Content: 0.6,
        heatOutlet: "important",
        spaceAvailable: true,
        disposalCost: 160,
        supplyRegularity: "reguliere",
      },
      lines: [
        { substrateId: "epluchures", tonnage: 16 },
        { substrateId: "prepa-cuisine", tonnage: 11 },
        { substrateId: "restes-repas", tonnage: 28 },
        { substrateId: "pain-boulangerie", tonnage: 4 },
        { substrateId: "marc-cafe", tonnage: 3 },
      ],
    },
    activities: [
      ["rdv", "Visite de la cuisine et pesée des déchets sur une semaine type.", "-18 days"],
      ["email", "Envoi de l'estimation de production de biogaz et d'économies.", "-10 days"],
      ["appel", "L'intendance confirme l'intérêt, demande un devis détaillé.", "-3 days"],
    ],
  },
  {
    lead: {
      company: "Maison de repos Les Tilleuls",
      contact_name: "Marc Hennuy",
      email: "direction@lestilleuls.be",
      phone: "+32 81 74 22 18",
      sector: "Maison de repos",
      address: "Avenue des Acacias 5",
      city: "Namur",
      country: "Belgique",
      source: "Recommandation client",
      stage: "proposition",
      owner: "Camille Verhoeven",
      estimated_value: 52000,
      notes:
        "150 résidents, cuisine interne. Coûts de collecte des déchets organiques en hausse.",
      age: "-38 days",
    },
    assessment: {
      label: "Étude valorisation déchets de cuisine",
      ctx: {
        ch4Content: 0.6,
        heatOutlet: "important",
        spaceAvailable: true,
        disposalCost: 175,
        supplyRegularity: "reguliere",
      },
      lines: [
        { substrateId: "epluchures", tonnage: 20 },
        { substrateId: "prepa-cuisine", tonnage: 14 },
        { substrateId: "restes-repas", tonnage: 35 },
        { substrateId: "produits-laitiers", tonnage: 6 },
        { substrateId: "marc-cafe", tonnage: 3 },
      ],
    },
    activities: [
      ["rdv", "Audit des flux de déchets de la cuisine et de la salle.", "-28 days"],
      ["devis", "Proposition d'installation d'une unité Waste-end envoyée.", "-5 days"],
    ],
  },
  {
    lead: {
      company: "Restaurant Le Comptoir Vert",
      contact_name: "Julie Moreau",
      email: "contact@comptoirvert.be",
      phone: "+32 4 250 33 71",
      sector: "Restaurant",
      address: "Rue du Pont 22",
      city: "Liège",
      country: "Belgique",
      source: "Formulaire site web",
      stage: "qualifie",
      owner: "Yanis Brahimi",
      estimated_value: 22000,
      notes:
        "Restaurant engagé dans une démarche zéro déchet. Gisement à confirmer par une pesée.",
      age: "-8 days",
    },
    activities: [
      ["appel", "Qualification du besoin — gisement estimé à 25 t/an.", "-6 days"],
    ],
  },
  {
    lead: {
      company: "Centre Hospitalier de Wallonie",
      contact_name: "Pascal Genet",
      email: "p.genet@chwallonie.be",
      phone: "+32 71 92 40 00",
      sector: "Hôpital",
      address: "Boulevard Zoé Drion 1",
      city: "Charleroi",
      country: "Belgique",
      source: "Campagne LinkedIn",
      stage: "nouveau",
      owner: "Yanis Brahimi",
      estimated_value: 0,
      notes:
        "Cuisine hospitalière importante. Premier contact à organiser avec le service technique.",
      age: "-2 days",
    },
  },
  {
    lead: {
      company: "Cuisine collective ScolaRest",
      contact_name: "Nadia Lambert",
      email: "n.lambert@scolarest.be",
      phone: "+32 10 47 88 90",
      sector: "Cuisine de collectivité",
      address: "Zoning Nord 8",
      city: "Wavre",
      country: "Belgique",
      source: "Salon des collectivités durables",
      stage: "gagne",
      owner: "Camille Verhoeven",
      estimated_value: 95000,
      notes:
        "Contrat signé — cuisine centrale livrant 20 écoles. Installation d'une unité Waste-end planifiée.",
      age: "-110 days",
    },
    assessment: {
      label: "Dimensionnement contractuel — cuisine centrale",
      ctx: {
        ch4Content: 0.6,
        heatOutlet: "important",
        spaceAvailable: true,
        disposalCost: 190,
        supplyRegularity: "reguliere",
      },
      lines: [
        { substrateId: "epluchures", tonnage: 60 },
        { substrateId: "prepa-cuisine", tonnage: 55 },
        { substrateId: "restes-repas", tonnage: 90 },
        { substrateId: "invendus", tonnage: 25 },
        { substrateId: "fruits-legumes-declasses", tonnage: 30 },
      ],
    },
    activities: [
      ["devis", "Offre acceptée — signature du contrat d'installation.", "-14 days"],
      ["note", "Préparation du chantier et planification de l'installation.", "-6 days"],
    ],
  },
  {
    lead: {
      company: "Resto du Cœur de Charleroi",
      contact_name: "Christine Body",
      email: "charleroi@restosducoeur.be",
      phone: "+32 71 30 18 55",
      sector: "Aide alimentaire",
      address: "Rue de la Providence 40",
      city: "Charleroi",
      country: "Belgique",
      source: "Client historique",
      stage: "service",
      owner: "Camille Verhoeven",
      estimated_value: 41000,
      notes:
        "Unité Waste-end en service depuis 10 mois — site pilote. Contrat de maintenance actif.",
      age: "-360 days",
    },
    assessment: {
      label: "Bilan d'exploitation — site pilote",
      ctx: {
        ch4Content: 0.6,
        heatOutlet: "partiel",
        spaceAvailable: true,
        disposalCost: 150,
        supplyRegularity: "reguliere",
      },
      lines: [
        { substrateId: "epluchures", tonnage: 22 },
        { substrateId: "fruits-legumes-declasses", tonnage: 28 },
        { substrateId: "prepa-cuisine", tonnage: 12 },
        { substrateId: "restes-repas", tonnage: 14 },
      ],
    },
    activities: [
      ["note", "Visite de maintenance préventive trimestrielle réalisée.", "-22 days"],
    ],
    tickets: [
      [
        "Production de biogaz en baisse",
        "Le rendement a légèrement chuté. Vérifier le tri à la source (présence d'emballages) et la température du digesteur.",
        "haute",
        "en_cours",
      ],
      [
        "Enlèvement du digestat à planifier",
        "Organiser la collecte du digestat avec le partenaire agricole local.",
        "normale",
        "ouvert",
      ],
    ],
  },
  {
    lead: {
      company: "Hôtel-Restaurant du Parc",
      contact_name: "Olivier Sart",
      email: "info@hotelduparc.be",
      phone: "+32 84 21 33 22",
      sector: "Hôtel-restaurant",
      address: "Place du Parc 3",
      city: "Durbuy",
      country: "Belgique",
      source: "Formulaire site web",
      stage: "perdu",
      owner: "Yanis Brahimi",
      estimated_value: 0,
      notes:
        "Gisement trop faible et très saisonnier pour rentabiliser une unité dédiée.",
      age: "-55 days",
    },
    activities: [
      ["appel", "Gisement insuffisant pour un projet autonome — dossier clôturé.", "-30 days"],
    ],
  },
];

async function seed(): Promise<void> {
  const { rows } = await pool.query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM leads",
  );
  if (rows[0].n > 0) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const demo of DEMOS) {
      const l = demo.lead;
      const leadRes = await client.query<{ id: number }>(
        `INSERT INTO leads (company, contact_name, email, phone, sector, address, city,
            country, source, stage, owner, estimated_value, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                 now() + $14::interval, now() + $14::interval)
         RETURNING id`,
        [
          l.company, l.contact_name, l.email, l.phone, l.sector, l.address, l.city,
          l.country, l.source, l.stage, l.owner, l.estimated_value, l.notes, l.age,
        ],
      );
      const leadId = leadRes.rows[0].id;

      if (demo.assessment) {
        const { label, ctx, lines } = demo.assessment;
        const result = compute(lines, ctx, DEFAULT_SUBSTRATES);
        await client.query(
          `INSERT INTO assessments (lead_id, label, valorization, inputs_json, result_json, probability)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            leadId,
            label,
            "thermique",
            JSON.stringify({ ...ctx, lines }),
            JSON.stringify(result),
            result.probability,
          ],
        );
      }
      for (const [type, summary, age] of demo.activities ?? []) {
        await client.query(
          `INSERT INTO activities (lead_id, type, summary, created_at)
           VALUES ($1,$2,$3, now() + $4::interval)`,
          [leadId, type, summary, age],
        );
      }
      for (const [title, description, priority, status] of demo.tickets ?? []) {
        await client.query(
          `INSERT INTO tickets (lead_id, title, description, priority, status)
           VALUES ($1,$2,$3,$4,$5)`,
          [leadId, title, description, priority, status],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Crée le schéma et, si la base est vide, charge un jeu de démonstration. */
export async function initDb(): Promise<void> {
  await pool.query(SCHEMA);
  await seedSubstrates();
  await seed();
}

export default pool;

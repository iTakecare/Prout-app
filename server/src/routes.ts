import { Router, type Request, type Response } from "express";
import pool, { STAGE_IDS, STAGE_WIN, STAGES } from "./db.js";
import {
  compute,
  type CalcContext,
  type CalcLine,
  type Substrate,
} from "./calc.js";

const router = Router();

async function getSubstrates(): Promise<Substrate[]> {
  const { rows } = await pool.query(
    "SELECT id, name, category, ts, vs, bmp FROM substrates ORDER BY position, name",
  );
  return rows as Substrate[];
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "substrat"
  );
}

/** Enveloppe les handlers async pour router les erreurs vers Express. */
function wrap(
  fn: (req: Request, res: Response) => Promise<unknown>,
): (req: Request, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: "Erreur serveur" });
    });
  };
}

function buildContext(body: Record<string, unknown>): CalcContext {
  return {
    ch4Content: Number(body.ch4Content) || 0.6,
    heatOutlet: (["aucun", "partiel", "important"].includes(String(body.heatOutlet))
      ? body.heatOutlet
      : "important") as CalcContext["heatOutlet"],
    spaceAvailable: body.spaceAvailable !== false && body.spaceAvailable !== 0,
    disposalCost: Number(body.disposalCost) || 0,
    supplyRegularity: (["irreguliere", "saisonniere", "reguliere"].includes(
      String(body.supplyRegularity),
    )
      ? body.supplyRegularity
      : "reguliere") as CalcContext["supplyRegularity"],
    heatPrice: body.heatPrice != null ? Number(body.heatPrice) : undefined,
  };
}

function buildLines(raw: unknown): CalcLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => ({
      substrateId: String((l as CalcLine).substrateId ?? ""),
      tonnage: Number((l as CalcLine).tonnage) || 0,
    }))
    .filter((l) => l.substrateId);
}

const leadFields = [
  "company",
  "contact_name",
  "email",
  "phone",
  "sector",
  "address",
  "city",
  "country",
  "source",
  "stage",
  "owner",
  "estimated_value",
  "notes",
] as const;

async function leadDetail(id: number) {
  const leadRes = await pool.query("SELECT * FROM leads WHERE id = $1", [id]);
  if (leadRes.rowCount === 0) return null;
  const lead = leadRes.rows[0];

  const assessments = (
    await pool.query(
      "SELECT * FROM assessments WHERE lead_id = $1 ORDER BY created_at DESC, id DESC",
      [id],
    )
  ).rows.map((a) => ({
    id: a.id,
    label: a.label,
    valorization: a.valorization,
    probability: a.probability,
    createdAt: a.created_at,
    inputs: a.inputs_json,
    result: a.result_json,
  }));

  const activities = (
    await pool.query(
      "SELECT * FROM activities WHERE lead_id = $1 ORDER BY created_at DESC, id DESC",
      [id],
    )
  ).rows;

  const tickets = (
    await pool.query(
      "SELECT * FROM tickets WHERE lead_id = $1 ORDER BY created_at DESC, id DESC",
      [id],
    )
  ).rows;

  return { ...lead, assessments, activities, tickets };
}

/** Référentiel des déchets et des étapes du pipeline. */
router.get(
  "/meta",
  wrap(async (_req, res) => {
    res.json({ substrates: await getSubstrates(), stages: STAGES });
  }),
);

/** Calcul de biométhanisation sans persistance (calculateur libre). */
router.post(
  "/calc",
  wrap(async (req, res) => {
    const substrates = await getSubstrates();
    const result = compute(
      buildLines(req.body?.lines),
      buildContext(req.body ?? {}),
      substrates,
    );
    res.json(result);
  }),
);

/** Référentiel des déchets — opérations d'édition. */
router.get(
  "/substrates",
  wrap(async (_req, res) => {
    res.json(await getSubstrates());
  }),
);

router.post(
  "/substrates",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim();
    if (!name) return res.status(400).json({ error: "Le nom est requis" });
    let id = slugify(name);
    const exists = await pool.query("SELECT 1 FROM substrates WHERE id = $1", [id]);
    if ((exists.rowCount ?? 0) > 0) id = `${id}-${Date.now().toString(36)}`;
    const pos = await pool.query<{ m: number }>(
      "SELECT COALESCE(MAX(position), 0) + 1 AS m FROM substrates",
    );
    await pool.query(
      `INSERT INTO substrates (id, name, category, ts, vs, bmp, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        name,
        String(b.category || "Autres déchets"),
        Math.min(1, Math.max(0, Number(b.ts) || 0)),
        Math.min(1, Math.max(0, Number(b.vs) || 0)),
        Math.max(0, Number(b.bmp) || 0),
        pos.rows[0].m,
      ],
    );
    res.status(201).json(await getSubstrates());
  }),
);

router.put(
  "/substrates/:id",
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const current = await pool.query("SELECT * FROM substrates WHERE id = $1", [
      req.params.id,
    ]);
    if (current.rowCount === 0)
      return res.status(404).json({ error: "Déchet introuvable" });
    const c = current.rows[0];
    await pool.query(
      `UPDATE substrates SET name = $1, category = $2, ts = $3, vs = $4, bmp = $5
       WHERE id = $6`,
      [
        b.name != null ? String(b.name) : c.name,
        b.category != null ? String(b.category) : c.category,
        b.ts != null ? Math.min(1, Math.max(0, Number(b.ts))) : c.ts,
        b.vs != null ? Math.min(1, Math.max(0, Number(b.vs))) : c.vs,
        b.bmp != null ? Math.max(0, Number(b.bmp)) : c.bmp,
        req.params.id,
      ],
    );
    res.json(await getSubstrates());
  }),
);

router.delete(
  "/substrates/:id",
  wrap(async (req, res) => {
    const del = await pool.query("DELETE FROM substrates WHERE id = $1", [
      req.params.id,
    ]);
    if (del.rowCount === 0)
      return res.status(404).json({ error: "Déchet introuvable" });
    res.json(await getSubstrates());
  }),
);

/** Liste des leads, filtrable par étape, avec la probabilité de la dernière étude. */
router.get(
  "/leads",
  wrap(async (req, res) => {
    const stage = req.query.stage as string | undefined;
    const filtered = stage && STAGE_IDS.includes(stage as never);
    const rows = (
      await pool.query(
        `SELECT l.*, a.probability
           FROM leads l
           LEFT JOIN LATERAL (
             SELECT probability FROM assessments
             WHERE lead_id = l.id ORDER BY created_at DESC, id DESC LIMIT 1
           ) a ON true
          ${filtered ? "WHERE l.stage = $1" : ""}
          ORDER BY l.updated_at DESC`,
        filtered ? [stage] : [],
      )
    ).rows;
    res.json(rows);
  }),
);

router.get(
  "/leads/:id",
  wrap(async (req, res) => {
    const detail = await leadDetail(Number(req.params.id));
    if (!detail) return res.status(404).json({ error: "Lead introuvable" });
    res.json(detail);
  }),
);

router.post(
  "/leads",
  wrap(async (req, res) => {
    const body = req.body ?? {};
    if (!body.company || !String(body.company).trim()) {
      return res.status(400).json({ error: "Le nom de l'entreprise est requis" });
    }
    const values = leadFields.map((f) => {
      if (f === "estimated_value") return Number(body[f]) || 0;
      if (f === "stage") return STAGE_IDS.includes(body[f]) ? body[f] : "nouveau";
      if (f === "country") return body[f] || "Belgique";
      return body[f] != null ? String(body[f]) : "";
    });
    const placeholders = leadFields.map((_, i) => `$${i + 1}`).join(", ");
    const inserted = await pool.query(
      `INSERT INTO leads (${leadFields.join(", ")}) VALUES (${placeholders}) RETURNING id`,
      values,
    );
    res.status(201).json(await leadDetail(inserted.rows[0].id));
  }),
);

router.put(
  "/leads/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existingRes = await pool.query("SELECT * FROM leads WHERE id = $1", [id]);
    if (existingRes.rowCount === 0)
      return res.status(404).json({ error: "Lead introuvable" });
    const existing = existingRes.rows[0];
    const body = req.body ?? {};
    const values = leadFields.map((f) => {
      if (body[f] === undefined) return existing[f];
      if (f === "estimated_value") return Number(body[f]) || 0;
      if (f === "stage") return STAGE_IDS.includes(body[f]) ? body[f] : existing[f];
      return String(body[f]);
    });
    const setClause = leadFields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    await pool.query(
      `UPDATE leads SET ${setClause}, updated_at = now() WHERE id = $${leadFields.length + 1}`,
      [...values, id],
    );
    res.json(await leadDetail(id));
  }),
);

router.patch(
  "/leads/:id/stage",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const stage = String(req.body?.stage ?? "");
    if (!STAGE_IDS.includes(stage as never)) {
      return res.status(400).json({ error: "Étape invalide" });
    }
    const updated = await pool.query(
      "UPDATE leads SET stage = $1, updated_at = now() WHERE id = $2",
      [stage, id],
    );
    if (updated.rowCount === 0)
      return res.status(404).json({ error: "Lead introuvable" });
    const label = STAGES.find((s) => s.id === stage)?.label ?? stage;
    await pool.query(
      "INSERT INTO activities (lead_id, type, summary) VALUES ($1, 'note', $2)",
      [id, `Étape du pipeline mise à jour : ${label}.`],
    );
    res.json(await leadDetail(id));
  }),
);

router.delete(
  "/leads/:id",
  wrap(async (req, res) => {
    const del = await pool.query("DELETE FROM leads WHERE id = $1", [
      Number(req.params.id),
    ]);
    if (del.rowCount === 0) return res.status(404).json({ error: "Lead introuvable" });
    res.json({ ok: true });
  }),
);

/** Crée une étude de méthanisation rattachée à un lead. */
router.post(
  "/leads/:id/assessments",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const lead = await pool.query("SELECT id FROM leads WHERE id = $1", [id]);
    if (lead.rowCount === 0) return res.status(404).json({ error: "Lead introuvable" });
    const ctx = buildContext(req.body ?? {});
    const lines = buildLines(req.body?.lines);
    const result = compute(lines, ctx, await getSubstrates());
    const label = String(req.body?.label || "Étude de méthanisation");
    await pool.query(
      `INSERT INTO assessments (lead_id, label, valorization, inputs_json, result_json, probability)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        label,
        "thermique",
        JSON.stringify({ ...ctx, lines }),
        JSON.stringify(result),
        result.probability,
      ],
    );
    await pool.query(
      "INSERT INTO activities (lead_id, type, summary) VALUES ($1, 'note', $2)",
      [id, `Étude « ${label} » réalisée — probabilité ${result.probability} %.`],
    );
    await pool.query("UPDATE leads SET updated_at = now() WHERE id = $1", [id]);
    res.status(201).json(await leadDetail(id));
  }),
);

/** Détail d'une étude avec le lead associé (pour la proposition PDF). */
router.get(
  "/assessments/:id",
  wrap(async (req, res) => {
    const a = await pool.query("SELECT * FROM assessments WHERE id = $1", [
      Number(req.params.id),
    ]);
    if (a.rowCount === 0)
      return res.status(404).json({ error: "Étude introuvable" });
    const row = a.rows[0];
    const lead = await pool.query("SELECT * FROM leads WHERE id = $1", [
      row.lead_id,
    ]);
    res.json({
      id: row.id,
      label: row.label,
      probability: row.probability,
      createdAt: row.created_at,
      inputs: row.inputs_json,
      result: row.result_json,
      lead: lead.rows[0] ?? null,
    });
  }),
);

router.put(
  "/assessments/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await pool.query(
      "SELECT lead_id FROM assessments WHERE id = $1",
      [id],
    );
    if (existing.rowCount === 0)
      return res.status(404).json({ error: "Étude introuvable" });
    const ctx = buildContext(req.body ?? {});
    const lines = buildLines(req.body?.lines);
    const result = compute(lines, ctx, await getSubstrates());
    const label = String(req.body?.label || "Étude de faisabilité");
    await pool.query(
      `UPDATE assessments SET label = $1, inputs_json = $2, result_json = $3,
         probability = $4 WHERE id = $5`,
      [
        label,
        JSON.stringify({ ...ctx, lines }),
        JSON.stringify(result),
        result.probability,
        id,
      ],
    );
    res.json(await leadDetail(existing.rows[0].lead_id));
  }),
);

router.delete(
  "/assessments/:id",
  wrap(async (req, res) => {
    const del = await pool.query("DELETE FROM assessments WHERE id = $1", [
      Number(req.params.id),
    ]);
    if (del.rowCount === 0) return res.status(404).json({ error: "Étude introuvable" });
    res.json({ ok: true });
  }),
);

/** Journal des interactions commerciales. */
router.post(
  "/leads/:id/activities",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const lead = await pool.query("SELECT id FROM leads WHERE id = $1", [id]);
    if (lead.rowCount === 0) return res.status(404).json({ error: "Lead introuvable" });
    const summary = String(req.body?.summary ?? "").trim();
    if (!summary) return res.status(400).json({ error: "Le contenu est requis" });
    const type = ["appel", "email", "rdv", "note", "devis"].includes(String(req.body?.type))
      ? req.body.type
      : "note";
    await pool.query(
      "INSERT INTO activities (lead_id, type, summary) VALUES ($1,$2,$3)",
      [id, type, summary],
    );
    await pool.query("UPDATE leads SET updated_at = now() WHERE id = $1", [id]);
    res.status(201).json(await leadDetail(id));
  }),
);

/** Tickets de suivi / service après-vente. */
router.post(
  "/leads/:id/tickets",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const lead = await pool.query("SELECT id FROM leads WHERE id = $1", [id]);
    if (lead.rowCount === 0) return res.status(404).json({ error: "Lead introuvable" });
    const title = String(req.body?.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "Le titre est requis" });
    const priority = ["basse", "normale", "haute", "critique"].includes(
      String(req.body?.priority),
    )
      ? req.body.priority
      : "normale";
    await pool.query(
      "INSERT INTO tickets (lead_id, title, description, priority) VALUES ($1,$2,$3,$4)",
      [id, title, String(req.body?.description ?? ""), priority],
    );
    res.status(201).json(await leadDetail(id));
  }),
);

router.patch(
  "/tickets/:id",
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const ticketRes = await pool.query("SELECT * FROM tickets WHERE id = $1", [id]);
    if (ticketRes.rowCount === 0)
      return res.status(404).json({ error: "Ticket introuvable" });
    const ticket = ticketRes.rows[0];
    const status = ["ouvert", "en_cours", "resolu"].includes(String(req.body?.status))
      ? req.body.status
      : ticket.status;
    const priority = ["basse", "normale", "haute", "critique"].includes(
      String(req.body?.priority),
    )
      ? req.body.priority
      : ticket.priority;
    await pool.query(
      `UPDATE tickets SET status = $1, priority = $2,
         resolved_at = CASE WHEN $1 = 'resolu' THEN now() ELSE NULL END
       WHERE id = $3`,
      [status, priority, id],
    );
    res.json(await leadDetail(ticket.lead_id));
  }),
);

/** Indicateurs agrégés du pipeline pour le tableau de bord. */
router.get(
  "/dashboard",
  wrap(async (_req, res) => {
    const leads = (
      await pool.query(
        `SELECT l.id, l.stage, l.estimated_value, a.result_json, a.probability
           FROM leads l
           LEFT JOIN LATERAL (
             SELECT result_json, probability FROM assessments
             WHERE lead_id = l.id ORDER BY created_at DESC, id DESC LIMIT 1
           ) a ON true`,
      )
    ).rows;

    const stageCounts: Record<string, number> = {};
    for (const s of STAGE_IDS) stageCounts[s] = 0;

    let pipelineValue = 0;
    let weightedValue = 0;
    let wonValue = 0;
    let ch4Pipeline = 0;
    const probs: number[] = [];

    for (const lead of leads) {
      const stage = String(lead.stage);
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
      const value = Number(lead.estimated_value) || 0;
      if (stage === "gagne" || stage === "service") wonValue += value;
      else if (stage !== "perdu") {
        pipelineValue += value;
        weightedValue += value * (STAGE_WIN[stage] ?? 0);
      }
      if (lead.probability != null) probs.push(Number(lead.probability));
      if (lead.result_json && stage !== "perdu") {
        ch4Pipeline += Number(lead.result_json.ch4Total) || 0;
      }
    }

    const openTickets = (
      await pool.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM tickets WHERE status != 'resolu'",
      )
    ).rows[0].n;

    res.json({
      totalLeads: leads.length,
      stageCounts,
      pipelineValue,
      weightedValue,
      wonValue,
      ch4Pipeline,
      avgProbability: probs.length
        ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length)
        : 0,
      openTickets,
    });
  }),
);

export default router;

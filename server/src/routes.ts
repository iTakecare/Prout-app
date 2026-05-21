import { Router, type Request, type Response } from "express";
import db, { STAGE_IDS, STAGE_WIN, STAGES } from "./db.js";
import {
  compute,
  SUBSTRATES,
  type CalcContext,
  type CalcLine,
  type Valorization,
} from "./calc.js";

const router = Router();

function buildContext(body: Record<string, unknown>): CalcContext {
  const valorization: Valorization =
    body.valorization === "biomethane" ? "biomethane" : "cogeneration";
  return {
    valorization,
    ch4Content: Number(body.ch4Content) || 0.55,
    energyOutlet: (["aucun", "partiel", "important"].includes(String(body.energyOutlet))
      ? body.energyOutlet
      : "partiel") as CalcContext["energyOutlet"],
    spaceAvailable: body.spaceAvailable !== false && body.spaceAvailable !== 0,
    disposalCost: Number(body.disposalCost) || 0,
    supplyRegularity: (["irreguliere", "saisonniere", "reguliere"].includes(
      String(body.supplyRegularity),
    )
      ? body.supplyRegularity
      : "reguliere") as CalcContext["supplyRegularity"],
    elecPrice: body.elecPrice != null ? Number(body.elecPrice) : undefined,
    heatPrice: body.heatPrice != null ? Number(body.heatPrice) : undefined,
    biomethanePrice: body.biomethanePrice != null ? Number(body.biomethanePrice) : undefined,
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

interface AssessmentRow {
  id: number;
  lead_id: number;
  label: string;
  valorization: string;
  inputs_json: string;
  result_json: string;
  probability: number;
  created_at: string;
}

function leadDetail(id: number) {
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!lead) return null;
  const assessments = (
    db
      .prepare("SELECT * FROM assessments WHERE lead_id = ? ORDER BY created_at DESC")
      .all(id) as AssessmentRow[]
  ).map((a) => ({
    id: a.id,
    label: a.label,
    valorization: a.valorization,
    probability: a.probability,
    createdAt: a.created_at,
    inputs: JSON.parse(a.inputs_json),
    result: JSON.parse(a.result_json),
  }));
  const activities = db
    .prepare("SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC")
    .all(id);
  const tickets = db
    .prepare("SELECT * FROM tickets WHERE lead_id = ? ORDER BY created_at DESC")
    .all(id);
  return { ...lead, assessments, activities, tickets };
}

/** Référentiel des substrats et des étapes du pipeline. */
router.get("/meta", (_req: Request, res: Response) => {
  res.json({ substrates: SUBSTRATES, stages: STAGES });
});

/** Calcul de méthanisation sans persistance (calculateur libre). */
router.post("/calc", (req: Request, res: Response) => {
  const result = compute(buildLines(req.body?.lines), buildContext(req.body ?? {}));
  res.json(result);
});

/** Liste des leads, filtrable par étape. */
router.get("/leads", (req: Request, res: Response) => {
  const stage = req.query.stage as string | undefined;
  const rows =
    stage && STAGE_IDS.includes(stage as never)
      ? db.prepare("SELECT * FROM leads WHERE stage = ? ORDER BY updated_at DESC").all(stage)
      : db.prepare("SELECT * FROM leads ORDER BY updated_at DESC").all();
  const withProb = (rows as Array<Record<string, unknown>>).map((lead) => {
    const a = db
      .prepare(
        "SELECT probability FROM assessments WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(lead.id) as { probability: number } | undefined;
    return { ...lead, probability: a ? a.probability : null };
  });
  res.json(withProb);
});

router.get("/leads/:id", (req: Request, res: Response) => {
  const detail = leadDetail(Number(req.params.id));
  if (!detail) return res.status(404).json({ error: "Lead introuvable" });
  res.json(detail);
});

router.post("/leads", (req: Request, res: Response) => {
  const body = req.body ?? {};
  if (!body.company || !String(body.company).trim()) {
    return res.status(400).json({ error: "Le nom de l'entreprise est requis" });
  }
  const values: Record<string, unknown> = {};
  for (const f of leadFields) {
    if (f === "estimated_value") values[f] = Number(body[f]) || 0;
    else if (f === "stage")
      values[f] = STAGE_IDS.includes(body[f]) ? body[f] : "nouveau";
    else if (f === "country") values[f] = body[f] || "Belgique";
    else values[f] = body[f] != null ? String(body[f]) : "";
  }
  const info = db
    .prepare(
      `INSERT INTO leads (${leadFields.join(", ")})
       VALUES (${leadFields.map((f) => "@" + f).join(", ")})`,
    )
    .run(values);
  res.status(201).json(leadDetail(Number(info.lastInsertRowid)));
});

router.put("/leads/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "Lead introuvable" });
  const body = req.body ?? {};
  const values: Record<string, unknown> = { id };
  for (const f of leadFields) {
    if (body[f] === undefined) values[f] = existing[f];
    else if (f === "estimated_value") values[f] = Number(body[f]) || 0;
    else if (f === "stage")
      values[f] = STAGE_IDS.includes(body[f]) ? body[f] : existing[f];
    else values[f] = String(body[f]);
  }
  db.prepare(
    `UPDATE leads SET ${leadFields.map((f) => `${f} = @${f}`).join(", ")},
       updated_at = datetime('now') WHERE id = @id`,
  ).run(values);
  res.json(leadDetail(id));
});

router.patch("/leads/:id/stage", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const stage = String(req.body?.stage ?? "");
  if (!STAGE_IDS.includes(stage as never)) {
    return res.status(400).json({ error: "Étape invalide" });
  }
  const info = db
    .prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ?")
    .run(stage, id);
  if (info.changes === 0) return res.status(404).json({ error: "Lead introuvable" });
  const label = STAGES.find((s) => s.id === stage)?.label ?? stage;
  db.prepare("INSERT INTO activities (lead_id, type, summary) VALUES (?, 'note', ?)").run(
    id,
    `Étape du pipeline mise à jour : ${label}.`,
  );
  res.json(leadDetail(id));
});

router.delete("/leads/:id", (req: Request, res: Response) => {
  const info = db.prepare("DELETE FROM leads WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Lead introuvable" });
  res.json({ ok: true });
});

/** Crée une étude de méthanisation rattachée à un lead. */
router.post("/leads/:id/assessments", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!lead) return res.status(404).json({ error: "Lead introuvable" });
  const ctx = buildContext(req.body ?? {});
  const lines = buildLines(req.body?.lines);
  const result = compute(lines, ctx);
  const label = String(req.body?.label || "Étude de méthanisation");
  db.prepare(
    `INSERT INTO assessments (lead_id, label, valorization, inputs_json, result_json, probability)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, label, ctx.valorization, JSON.stringify({ ...ctx, lines }), JSON.stringify(result), result.probability);
  db.prepare(
    "INSERT INTO activities (lead_id, type, summary) VALUES (?, 'note', ?)",
  ).run(id, `Étude « ${label} » réalisée — probabilité ${result.probability} %.`);
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(id);
  res.status(201).json(leadDetail(id));
});

router.delete("/assessments/:id", (req: Request, res: Response) => {
  const info = db.prepare("DELETE FROM assessments WHERE id = ?").run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Étude introuvable" });
  res.json({ ok: true });
});

/** Journal des interactions commerciales. */
router.post("/leads/:id/activities", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!lead) return res.status(404).json({ error: "Lead introuvable" });
  const summary = String(req.body?.summary ?? "").trim();
  if (!summary) return res.status(400).json({ error: "Le contenu est requis" });
  const type = ["appel", "email", "rdv", "note", "devis"].includes(String(req.body?.type))
    ? req.body.type
    : "note";
  db.prepare("INSERT INTO activities (lead_id, type, summary) VALUES (?, ?, ?)").run(
    id,
    type,
    summary,
  );
  db.prepare("UPDATE leads SET updated_at = datetime('now') WHERE id = ?").run(id);
  res.status(201).json(leadDetail(id));
});

/** Tickets de suivi / service après-vente. */
router.post("/leads/:id/tickets", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(id);
  if (!lead) return res.status(404).json({ error: "Lead introuvable" });
  const title = String(req.body?.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "Le titre est requis" });
  const priority = ["basse", "normale", "haute", "critique"].includes(String(req.body?.priority))
    ? req.body.priority
    : "normale";
  db.prepare(
    "INSERT INTO tickets (lead_id, title, description, priority) VALUES (?, ?, ?, ?)",
  ).run(id, title, String(req.body?.description ?? ""), priority);
  res.status(201).json(leadDetail(id));
});

router.patch("/tickets/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
  const status = ["ouvert", "en_cours", "resolu"].includes(String(req.body?.status))
    ? req.body.status
    : ticket.status;
  const priority = ["basse", "normale", "haute", "critique"].includes(
    String(req.body?.priority),
  )
    ? req.body.priority
    : ticket.priority;
  const resolvedAt = status === "resolu" ? "datetime('now')" : "NULL";
  db.prepare(
    `UPDATE tickets SET status = ?, priority = ?, resolved_at = ${resolvedAt} WHERE id = ?`,
  ).run(status, priority, id);
  res.json(leadDetail(Number(ticket.lead_id)));
});

/** Indicateurs agrégés du pipeline pour le tableau de bord. */
router.get("/dashboard", (_req: Request, res: Response) => {
  const leads = db.prepare("SELECT * FROM leads").all() as Array<Record<string, unknown>>;
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
    const a = db
      .prepare(
        "SELECT result_json, probability FROM assessments WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(lead.id) as { result_json: string; probability: number } | undefined;
    if (a) {
      probs.push(a.probability);
      if (stage !== "perdu") {
        try {
          ch4Pipeline += JSON.parse(a.result_json).ch4Total ?? 0;
        } catch {
          /* ignore */
        }
      }
    }
  }

  const openTickets = (
    db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE status != 'resolu'").get() as {
      n: number;
    }
  ).n;

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
});

export default router;

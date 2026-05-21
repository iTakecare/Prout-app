/**
 * Moteur de calcul de méthanisation.
 *
 * Estime, à partir d'un gisement de déchets organiques, le potentiel
 * biogaz / biométhane, la valorisation énergétique et économique, ainsi
 * qu'une probabilité de faisabilité du projet de méthanisation.
 *
 * Les valeurs de référence des substrats (matière sèche, matière organique,
 * potentiel méthanogène) sont des ordres de grandeur issus de la littérature
 * technique (ADEME, guides biogaz). Elles peuvent être affinées par substrat.
 */

export type SubstrateCategory =
  | "Effluents d'élevage"
  | "Biodéchets"
  | "Agro-industrie"
  | "Cultures & CIVE"
  | "Boues & co-produits";

export interface Substrate {
  id: string;
  name: string;
  category: SubstrateCategory;
  /** Matière sèche — fraction de la matière brute (0-1). */
  ts: number;
  /** Matière organique — fraction de la matière sèche (0-1). */
  vs: number;
  /** Potentiel méthanogène — m³ de CH4 par tonne de matière organique. */
  bmp: number;
}

export const SUBSTRATES: Substrate[] = [
  { id: "lisier-bovin", name: "Lisier bovin", category: "Effluents d'élevage", ts: 0.08, vs: 0.8, bmp: 210 },
  { id: "fumier-bovin", name: "Fumier bovin", category: "Effluents d'élevage", ts: 0.21, vs: 0.82, bmp: 230 },
  { id: "lisier-porcin", name: "Lisier porcin", category: "Effluents d'élevage", ts: 0.06, vs: 0.75, bmp: 320 },
  { id: "fumier-volaille", name: "Fumier de volaille", category: "Effluents d'élevage", ts: 0.35, vs: 0.75, bmp: 280 },
  { id: "fumier-equin", name: "Fumier équin", category: "Effluents d'élevage", ts: 0.3, vs: 0.8, bmp: 200 },
  { id: "biodechets-menagers", name: "Biodéchets ménagers", category: "Biodéchets", ts: 0.28, vs: 0.85, bmp: 480 },
  { id: "dechets-restauration", name: "Déchets de restauration", category: "Biodéchets", ts: 0.22, vs: 0.9, bmp: 550 },
  { id: "invendus-gms", name: "Invendus alimentaires (GMS)", category: "Biodéchets", ts: 0.25, vs: 0.88, bmp: 520 },
  { id: "tontes-vegetaux", name: "Tontes & déchets verts", category: "Biodéchets", ts: 0.25, vs: 0.8, bmp: 320 },
  { id: "graisses-flottation", name: "Graisses de flottation", category: "Agro-industrie", ts: 0.12, vs: 0.92, bmp: 850 },
  { id: "huiles-usagees", name: "Huiles & graisses alimentaires usagées", category: "Agro-industrie", ts: 0.9, vs: 0.98, bmp: 900 },
  { id: "dreches-brasserie", name: "Drêches de brasserie", category: "Agro-industrie", ts: 0.23, vs: 0.92, bmp: 420 },
  { id: "marc-fruits", name: "Marc de fruits & pommes", category: "Agro-industrie", ts: 0.25, vs: 0.9, bmp: 450 },
  { id: "lactoserum", name: "Lactosérum (petit-lait)", category: "Agro-industrie", ts: 0.06, vs: 0.9, bmp: 600 },
  { id: "issues-cereales", name: "Issues de céréales", category: "Agro-industrie", ts: 0.88, vs: 0.95, bmp: 380 },
  { id: "pulpes-betterave", name: "Pulpes de betterave", category: "Agro-industrie", ts: 0.22, vs: 0.95, bmp: 400 },
  { id: "ensilage-mais", name: "Ensilage de maïs (CIVE)", category: "Cultures & CIVE", ts: 0.33, vs: 0.95, bmp: 350 },
  { id: "cive-seigle", name: "CIVE seigle / avoine", category: "Cultures & CIVE", ts: 0.3, vs: 0.93, bmp: 320 },
  { id: "boues-step", name: "Boues de station d'épuration", category: "Boues & co-produits", ts: 0.05, vs: 0.7, bmp: 320 },
  { id: "boues-agro", name: "Boues agro-alimentaires", category: "Boues & co-produits", ts: 0.08, vs: 0.85, bmp: 400 },
];

export const SUBSTRATE_MAP: Record<string, Substrate> = Object.fromEntries(
  SUBSTRATES.map((s) => [s.id, s]),
);

/** PCI du méthane — kWh par m³ de CH4. */
export const PCI_CH4 = 9.94;
/** Rendement électrique d'une cogénération biogaz. */
const ELEC_EFFICIENCY = 0.38;
/** Rendement thermique d'une cogénération biogaz. */
const THERMAL_EFFICIENCY = 0.43;
/** Rendement énergétique épuration + injection du biométhane. */
const BIOMETHANE_YIELD = 0.92;
/** kg de CO2 évité par kWh d'énergie fossile substituée. */
const CO2_FACTOR = 0.22;
/** Consommation électrique annuelle d'un foyer (kWh). */
const HOME_ELEC_KWH = 4700;
/** Consommation de chaleur annuelle d'un foyer (kWh). */
const HOME_HEAT_KWH = 12000;

const DEFAULT_PRICES = { elec: 0.14, heat: 0.045, biomethane: 0.09 };

/** Part de la chaleur cogénérée réellement valorisée selon le débouché. */
const HEAT_USE: Record<string, number> = { aucun: 0, partiel: 0.5, important: 0.9 };

export type Valorization = "cogeneration" | "biomethane";
export type EnergyOutlet = "aucun" | "partiel" | "important";
export type SupplyRegularity = "irreguliere" | "saisonniere" | "reguliere";

export interface CalcLine {
  substrateId: string;
  /** Gisement annuel en tonnes de matière brute. */
  tonnage: number;
}

export interface CalcContext {
  valorization: Valorization;
  /** Teneur en CH4 du biogaz (0.4-0.75). */
  ch4Content: number;
  energyOutlet: EnergyOutlet;
  spaceAvailable: boolean;
  /** Coût actuel d'élimination des déchets (€/t) — incitatif au projet. */
  disposalCost: number;
  supplyRegularity: SupplyRegularity;
  elecPrice?: number;
  heatPrice?: number;
  biomethanePrice?: number;
}

export interface LineResult {
  substrateId: string;
  name: string;
  category: string;
  tonnage: number;
  tMS: number;
  tMO: number;
  ch4: number;
  share: number;
}

export interface ProbabilityFactor {
  label: string;
  detail: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface CalcResult {
  lines: LineResult[];
  totalTonnage: number;
  totalMS: number;
  totalMO: number;
  ch4Total: number;
  biogasTotal: number;
  avgBmp: number;
  primaryEnergyKwh: number;
  valorization: Valorization;
  electricityKwh: number;
  heatKwh: number;
  heatValorizedKwh: number;
  biomethaneKwh: number;
  valorizedEnergyKwh: number;
  revenue: number;
  co2Avoided: number;
  homesEquivalent: number;
  probability: number;
  verdict: string;
  factors: ProbabilityFactor[];
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const logistic = (x: number, mid: number, steep: number) =>
  1 / (1 + Math.exp(-(x - mid) / steep));

function verdictFor(probability: number): string {
  if (probability >= 70) return "Projet très favorable";
  if (probability >= 55) return "Projet favorable";
  if (probability >= 38) return "Projet à étudier / optimiser";
  return "Projet peu favorable en l'état";
}

function mixScore(distinctCount: number): number {
  if (distinctCount <= 0) return 0;
  if (distinctCount === 1) return 0.45;
  if (distinctCount === 2) return 0.7;
  if (distinctCount === 3) return 0.88;
  return 1;
}

export function compute(lines: CalcLine[], ctx: CalcContext): CalcResult {
  const ch4Content = clamp(ctx.ch4Content || 0.55, 0.4, 0.75);
  const prices = {
    elec: ctx.elecPrice ?? DEFAULT_PRICES.elec,
    heat: ctx.heatPrice ?? DEFAULT_PRICES.heat,
    biomethane: ctx.biomethanePrice ?? DEFAULT_PRICES.biomethane,
  };

  const lineResults: LineResult[] = [];
  for (const line of lines) {
    const s = SUBSTRATE_MAP[line.substrateId];
    const tonnage = Number(line.tonnage) || 0;
    if (!s || tonnage <= 0) continue;
    const tMS = tonnage * s.ts;
    const tMO = tMS * s.vs;
    const ch4 = tMO * s.bmp;
    lineResults.push({
      substrateId: s.id,
      name: s.name,
      category: s.category,
      tonnage,
      tMS,
      tMO,
      ch4,
      share: 0,
    });
  }

  const totalTonnage = lineResults.reduce((a, l) => a + l.tonnage, 0);
  const totalMS = lineResults.reduce((a, l) => a + l.tMS, 0);
  const totalMO = lineResults.reduce((a, l) => a + l.tMO, 0);
  const ch4Total = lineResults.reduce((a, l) => a + l.ch4, 0);
  for (const l of lineResults) l.share = ch4Total > 0 ? l.ch4 / ch4Total : 0;

  const biogasTotal = ch4Total / ch4Content;
  const avgBmp = totalMO > 0 ? ch4Total / totalMO : 0;
  const primaryEnergyKwh = ch4Total * PCI_CH4;

  let electricityKwh = 0;
  let heatKwh = 0;
  let heatValorizedKwh = 0;
  let biomethaneKwh = 0;
  let valorizedEnergyKwh = 0;
  let homesEquivalent = 0;
  let revenue = 0;

  if (ctx.valorization === "biomethane") {
    biomethaneKwh = primaryEnergyKwh * BIOMETHANE_YIELD;
    valorizedEnergyKwh = biomethaneKwh;
    homesEquivalent = biomethaneKwh / HOME_HEAT_KWH;
    revenue = biomethaneKwh * prices.biomethane;
  } else {
    electricityKwh = primaryEnergyKwh * ELEC_EFFICIENCY;
    heatKwh = primaryEnergyKwh * THERMAL_EFFICIENCY;
    heatValorizedKwh = heatKwh * (HEAT_USE[ctx.energyOutlet] ?? 0.5);
    valorizedEnergyKwh = electricityKwh + heatValorizedKwh;
    homesEquivalent = electricityKwh / HOME_ELEC_KWH;
    revenue = electricityKwh * prices.elec + heatValorizedKwh * prices.heat;
  }

  const co2Avoided = (valorizedEnergyKwh * CO2_FACTOR) / 1000;

  // --- Probabilité de méthanisation ---
  const scaleScore = logistic(ch4Total, 250000, 120000);
  const qualityScore = clamp((avgBmp - 200) / (650 - 200));
  const mix = mixScore(lineResults.length);
  const outletScore = { aucun: 0.2, partiel: 0.65, important: 1 }[ctx.energyOutlet] ?? 0.65;
  const spaceScore = ctx.spaceAvailable ? 1 : 0.3;
  const incentiveScore = clamp(ctx.disposalCost / 80);
  const regularityScore =
    { irreguliere: 0.4, saisonniere: 0.7, reguliere: 1 }[ctx.supplyRegularity] ?? 0.7;

  const defs: Array<Omit<ProbabilityFactor, "contribution">> = [
    {
      label: "Volume valorisable",
      detail: `${Math.round(ch4Total).toLocaleString("fr-BE")} m³ CH₄/an — la taille du gisement conditionne la rentabilité`,
      score: scaleScore,
      weight: 0.32,
    },
    {
      label: "Qualité méthanogène",
      detail: `Potentiel moyen de ${Math.round(avgBmp)} m³ CH₄/t MO du mélange de substrats`,
      score: qualityScore,
      weight: 0.2,
    },
    {
      label: "Co-digestion du mélange",
      detail: `${lineResults.length} substrat(s) — un mélange équilibré stabilise la digestion`,
      score: mix,
      weight: 0.12,
    },
    {
      label: "Débouché énergétique",
      detail: `Valorisation de l'énergie produite (chaleur ou injection) : ${ctx.energyOutlet}`,
      score: outletScore,
      weight: 0.15,
    },
    {
      label: "Foncier disponible",
      detail: ctx.spaceAvailable
        ? "Terrain disponible pour l'unité de méthanisation"
        : "Foncier limité — contrainte d'implantation",
      score: spaceScore,
      weight: 0.08,
    },
    {
      label: "Incitatif économique",
      detail: `Coût actuel d'élimination des déchets : ${ctx.disposalCost} €/t`,
      score: incentiveScore,
      weight: 0.07,
    },
    {
      label: "Régularité du gisement",
      detail: `Approvisionnement ${ctx.supplyRegularity} sur l'année`,
      score: regularityScore,
      weight: 0.06,
    },
  ];

  const factors: ProbabilityFactor[] = defs.map((d) => ({
    ...d,
    contribution: d.score * d.weight * 100,
  }));
  const probability = Math.round(factors.reduce((a, f) => a + f.contribution, 0));

  return {
    lines: lineResults,
    totalTonnage,
    totalMS,
    totalMO,
    ch4Total,
    biogasTotal,
    avgBmp,
    primaryEnergyKwh,
    valorization: ctx.valorization,
    electricityKwh,
    heatKwh,
    heatValorizedKwh,
    biomethaneKwh,
    valorizedEnergyKwh,
    revenue,
    co2Avoided,
    homesEquivalent,
    probability,
    verdict: verdictFor(probability),
    factors,
  };
}

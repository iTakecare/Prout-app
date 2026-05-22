/**
 * Moteur de calcul de biométhanisation de déchets alimentaires.
 *
 * Estime, pour un établissement (restaurant, école, maison de repos,
 * hôpital, cuisine de collectivité...), le potentiel d'une unité de
 * biométhanisation sur site type Waste-end : production de biogaz,
 * chaleur valorisable, digestat (engrais), CO2 évité par rapport à
 * l'incinération, économies réalisées, et un score de pertinence du
 * projet.
 *
 * Les caractéristiques des déchets (matière sèche, matière organique,
 * potentiel méthanogène) sont des ordres de grandeur issus de la
 * littérature technique sur la digestion anaérobie des biodéchets.
 */

export type SubstrateCategory =
  | "Épluchures & préparation"
  | "Restes de repas & invendus"
  | "Sous-produits riches";

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

export const DEFAULT_SUBSTRATES: Substrate[] = [
  { id: "epluchures", name: "Épluchures de fruits & légumes", category: "Épluchures & préparation", ts: 0.14, vs: 0.88, bmp: 460 },
  { id: "prepa-cuisine", name: "Déchets de préparation cuisine", category: "Épluchures & préparation", ts: 0.2, vs: 0.88, bmp: 450 },
  { id: "fruits-legumes-declasses", name: "Fruits & légumes déclassés", category: "Épluchures & préparation", ts: 0.13, vs: 0.87, bmp: 430 },
  { id: "restes-repas", name: "Restes de repas (déchets d'assiette)", category: "Restes de repas & invendus", ts: 0.27, vs: 0.9, bmp: 500 },
  { id: "invendus", name: "Invendus alimentaires", category: "Restes de repas & invendus", ts: 0.28, vs: 0.9, bmp: 520 },
  { id: "pain-boulangerie", name: "Pain & produits de boulangerie", category: "Restes de repas & invendus", ts: 0.65, vs: 0.96, bmp: 520 },
  { id: "marc-cafe", name: "Marc de café & thé", category: "Sous-produits riches", ts: 0.34, vs: 0.95, bmp: 400 },
  { id: "produits-laitiers", name: "Produits laitiers périmés", category: "Sous-produits riches", ts: 0.16, vs: 0.9, bmp: 600 },
  { id: "viande-poisson", name: "Restes de viande & poisson", category: "Sous-produits riches", ts: 0.35, vs: 0.92, bmp: 640 },
  { id: "huiles-cuisson", name: "Huiles & graisses de cuisson usagées", category: "Sous-produits riches", ts: 0.9, vs: 0.98, bmp: 850 },
];

/** PCI du méthane — kWh par m³ de CH4. */
export const PCI_CH4 = 9.94;
/** Rendement d'une chaudière biogaz (chaleur / eau chaude / cuisson). */
const BOILER_EFFICIENCY = 0.88;
/** Teneur en CH4 du biogaz issu de déchets alimentaires. */
const DEFAULT_CH4_CONTENT = 0.6;
/** Densité du biogaz — kg par m³. */
const BIOGAS_DENSITY = 1.2;
/**
 * CO2 évité par tonne de déchets alimentaires traités par
 * biométhanisation plutôt qu'incinérés (étude Bruxelles Environnement :
 * 124 t CO2 pour 1 000 t de déchets de cuisine).
 */
const CO2_AVOIDED_PER_TONNE = 0.124;
/** Consommation de chaleur annuelle d'un foyer (kWh). */
const HOME_HEAT_KWH = 12000;
/** Prix par défaut de la chaleur substituée (€/kWh, équivalent gaz). */
const DEFAULT_HEAT_PRICE = 0.08;

/** Part de la chaleur produite réellement valorisée selon le débouché. */
const HEAT_USE: Record<string, number> = { aucun: 0.3, partiel: 0.65, important: 0.95 };

export type HeatOutlet = "aucun" | "partiel" | "important";
export type SupplyRegularity = "irreguliere" | "saisonniere" | "reguliere";

export interface CalcLine {
  substrateId: string;
  /** Gisement annuel en tonnes de matière brute. */
  tonnage: number;
}

export interface CalcContext {
  /** Teneur en CH4 du biogaz (0.5-0.7). */
  ch4Content: number;
  /** Débouché pour la chaleur sur le site (cuisine, eau chaude...). */
  heatOutlet: HeatOutlet;
  /** Place disponible pour installer l'unité. */
  spaceAvailable: boolean;
  /** Coût actuel d'élimination des déchets alimentaires (€/t). */
  disposalCost: number;
  supplyRegularity: SupplyRegularity;
  /** Prix de la chaleur valorisée (€/kWh). */
  heatPrice?: number;
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
  heatUsableKwh: number;
  homesEquivalent: number;
  digestate: number;
  co2Avoided: number;
  heatValue: number;
  disposalSaving: number;
  totalBenefit: number;
  probability: number;
  verdict: string;
  factors: ProbabilityFactor[];
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const logistic = (x: number, mid: number, steep: number) =>
  1 / (1 + Math.exp(-(x - mid) / steep));

function verdictFor(probability: number): string {
  if (probability >= 70) return "Site très favorable à une unité Waste-end";
  if (probability >= 55) return "Site favorable";
  if (probability >= 38) return "Site à étudier / optimiser";
  return "Site peu adapté en l'état";
}

export function compute(
  lines: CalcLine[],
  ctx: CalcContext,
  substrates: Substrate[] = DEFAULT_SUBSTRATES,
): CalcResult {
  const ch4Content = clamp(ctx.ch4Content || DEFAULT_CH4_CONTENT, 0.5, 0.7);
  const heatPrice = ctx.heatPrice ?? DEFAULT_HEAT_PRICE;
  const substrateMap: Record<string, Substrate> = Object.fromEntries(
    substrates.map((s) => [s.id, s]),
  );

  const lineResults: LineResult[] = [];
  for (const line of lines) {
    const s = substrateMap[line.substrateId];
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

  const heatUseFactor = HEAT_USE[ctx.heatOutlet] ?? 0.65;
  const heatUsableKwh = primaryEnergyKwh * BOILER_EFFICIENCY * heatUseFactor;
  const homesEquivalent = heatUsableKwh / HOME_HEAT_KWH;

  // Le digestat correspond à la matière entrante moins la masse partie en biogaz.
  const digestate = Math.max(0, totalTonnage - (biogasTotal * BIOGAS_DENSITY) / 1000);
  const co2Avoided = totalTonnage * CO2_AVOIDED_PER_TONNE;

  const heatValue = heatUsableKwh * heatPrice;
  const disposalSaving = totalTonnage * (Number(ctx.disposalCost) || 0);
  const totalBenefit = heatValue + disposalSaving;

  // --- Score de pertinence d'une unité Waste-end ---
  const volumeScore = logistic(totalTonnage, 120, 70);
  const incentiveScore = clamp((Number(ctx.disposalCost) || 0) / 220);
  const regularityScore =
    { irreguliere: 0.4, saisonniere: 0.7, reguliere: 1 }[ctx.supplyRegularity] ?? 0.7;
  const spaceScore = ctx.spaceAvailable ? 1 : 0.25;
  const heatScore = { aucun: 0.3, partiel: 0.7, important: 1 }[ctx.heatOutlet] ?? 0.7;
  const qualityScore = clamp((avgBmp - 380) / (640 - 380));

  const defs: Array<Omit<ProbabilityFactor, "contribution">> = [
    {
      label: "Volume de déchets alimentaires",
      detail: `${Math.round(totalTonnage)} t/an — un gisement suffisant justifie l'installation d'une unité`,
      score: volumeScore,
      weight: 0.3,
    },
    {
      label: "Incitatif économique",
      detail: `Coût d'élimination actuel : ${Math.round(Number(ctx.disposalCost) || 0)} €/t — plus il est élevé, plus le projet est rentable`,
      score: incentiveScore,
      weight: 0.22,
    },
    {
      label: "Régularité du gisement",
      detail: `Production de déchets ${ctx.supplyRegularity} sur l'année`,
      score: regularityScore,
      weight: 0.18,
    },
    {
      label: "Place disponible",
      detail: ctx.spaceAvailable
        ? "Espace disponible pour installer l'unité sur site"
        : "Espace limité — contrainte d'implantation de l'unité",
      score: spaceScore,
      weight: 0.12,
    },
    {
      label: "Débouché chaleur sur site",
      detail: `Valorisation de la chaleur (cuisine, eau chaude) : ${ctx.heatOutlet}`,
      score: heatScore,
      weight: 0.1,
    },
    {
      label: "Qualité méthanogène",
      detail: `Potentiel moyen de ${Math.round(avgBmp)} m³ CH₄/t MO du mélange de déchets`,
      score: qualityScore,
      weight: 0.08,
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
    heatUsableKwh,
    homesEquivalent,
    digestate,
    co2Avoided,
    heatValue,
    disposalSaving,
    totalBenefit,
    probability,
    verdict: verdictFor(probability),
    factors,
  };
}

export interface Substrate {
  id: string;
  name: string;
  category: string;
  ts: number;
  vs: number;
  bmp: number;
}

export interface Stage {
  id: string;
  label: string;
  win: number;
}

export interface ProbabilityFactor {
  label: string;
  detail: string;
  score: number;
  weight: number;
  contribution: number;
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

export interface CalcLine {
  substrateId: string;
  tonnage: number;
}

export interface AssessmentInput extends Record<string, unknown> {
  ch4Content: number;
  heatOutlet: "aucun" | "partiel" | "important";
  spaceAvailable: boolean;
  disposalCost: number;
  supplyRegularity: "irreguliere" | "saisonniere" | "reguliere";
  lines: CalcLine[];
}

export interface Assessment {
  id: number;
  label: string;
  valorization: string;
  probability: number;
  createdAt: string;
  inputs: AssessmentInput;
  result: CalcResult;
}

export interface Activity {
  id: number;
  lead_id: number;
  type: string;
  summary: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  lead_id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export interface Lead {
  id: number;
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
  created_at: string;
  updated_at: string;
  probability?: number | null;
}

export interface LeadDetail extends Lead {
  assessments: Assessment[];
  activities: Activity[];
  tickets: Ticket[];
}

export interface Dashboard {
  totalLeads: number;
  stageCounts: Record<string, number>;
  pipelineValue: number;
  weightedValue: number;
  wonValue: number;
  ch4Pipeline: number;
  avgProbability: number;
  openTickets: number;
}

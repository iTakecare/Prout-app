import type {
  Assessment,
  AssessmentInput,
  CalcResult,
  Dashboard,
  Lead,
  LeadDetail,
  Stage,
  Substrate,
} from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => request<{ substrates: Substrate[]; stages: Stage[] }>("/api/meta"),
  dashboard: () => request<Dashboard>("/api/dashboard"),
  calc: (input: AssessmentInput) =>
    request<CalcResult>("/api/calc", { method: "POST", body: JSON.stringify(input) }),
  leads: () => request<Lead[]>("/api/leads"),
  lead: (id: number) => request<LeadDetail>(`/api/leads/${id}`),
  createLead: (data: Partial<Lead>) =>
    request<LeadDetail>("/api/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<LeadDetail>(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  setStage: (id: number, stage: string) =>
    request<LeadDetail>(`/api/leads/${id}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    }),
  deleteLead: (id: number) =>
    request<{ ok: boolean }>(`/api/leads/${id}`, { method: "DELETE" }),
  addAssessment: (leadId: number, input: AssessmentInput & { label?: string }) =>
    request<LeadDetail>(`/api/leads/${leadId}/assessments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  deleteAssessment: (id: number) =>
    request<{ ok: boolean }>(`/api/assessments/${id}`, { method: "DELETE" }),
  updateAssessment: (id: number, input: AssessmentInput & { label?: string }) =>
    request<LeadDetail>(`/api/assessments/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  addActivity: (leadId: number, type: string, summary: string) =>
    request<LeadDetail>(`/api/leads/${leadId}/activities`, {
      method: "POST",
      body: JSON.stringify({ type, summary }),
    }),
  addTicket: (leadId: number, data: { title: string; description: string; priority: string }) =>
    request<LeadDetail>(`/api/leads/${leadId}/tickets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTicket: (id: number, data: { status?: string; priority?: string }) =>
    request<LeadDetail>(`/api/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  assessment: (id: number) =>
    request<Assessment & { lead: Lead | null }>(`/api/assessments/${id}`),
  substrates: () => request<Substrate[]>("/api/substrates"),
  createSubstrate: (data: Partial<Substrate>) =>
    request<Substrate[]>("/api/substrates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSubstrate: (id: string, data: Partial<Substrate>) =>
    request<Substrate[]>(`/api/substrates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSubstrate: (id: string) =>
    request<Substrate[]>(`/api/substrates/${id}`, { method: "DELETE" }),
};

const LOCALE = "fr-BE";

export function fmtInt(n: number): string {
  return Math.round(n || 0).toLocaleString(LOCALE);
}

export function fmtNum(n: number, digits = 1): string {
  return (n || 0).toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtEur(n: number): string {
  return `${Math.round(n || 0).toLocaleString(LOCALE)} €`;
}

export function fmtKeur(n: number): string {
  const v = (n || 0) / 1000;
  return `${v.toLocaleString(LOCALE, { maximumFractionDigits: v >= 100 ? 0 : 1 })} k€`;
}

/** Affiche une énergie en kWh ou MWh/GWh selon l'ordre de grandeur. */
export function fmtEnergy(kwh: number): string {
  const v = kwh || 0;
  if (v >= 1_000_000) return `${fmtNum(v / 1_000_000, 2)} GWh`;
  if (v >= 1000) return `${fmtNum(v / 1000, 1)} MWh`;
  return `${fmtInt(v)} kWh`;
}

export function fmtPct(n: number): string {
  return `${Math.round(n || 0)} %`;
}

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short", year: "numeric" });
}

export function probaClass(p: number): string {
  if (p >= 70) return "high";
  if (p >= 55) return "good";
  if (p >= 38) return "mid";
  return "low";
}

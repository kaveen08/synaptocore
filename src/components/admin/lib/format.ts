export function packageShort(value: string): string {
  if (value.includes("Pilot")) return "Pilot";
  if (value.includes("Core")) return "Core Solution";
  if (value.includes("Managed")) return "Managed Service";
  return value || "Nicht angegeben";
}

export function packageTone(value: string): string {
  if (value.includes("Pilot")) return "border-blue-200 bg-blue-50 text-blue-700";
  if (value.includes("Core")) return "border-violet-200 bg-violet-50 text-violet-700";
  if (value.includes("Managed")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value.includes("Erstgespräch")) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}

export function relativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return new Date(value).toLocaleDateString("de-CH");
}

const appointmentFormatter = new Intl.DateTimeFormat("de-CH", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

const appointmentDateFormatter = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

const appointmentTimeFormatter = new Intl.DateTimeFormat("de-CH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Zurich",
});

export function appointmentDateTime(value: string): string {
  return appointmentFormatter.format(new Date(value));
}

export function appointmentDate(value: string): string {
  return appointmentDateFormatter.format(new Date(value));
}

export function appointmentTime(value: string): string {
  return appointmentTimeFormatter.format(new Date(value));
}

export function toLocalDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

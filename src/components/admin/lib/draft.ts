import { packageShort } from "./format";
import type { Lead } from "./types";

export function buildDraft(lead: Lead): string {
  const packageName = packageShort(lead.selected_package);
  const context = lead.message
    ? `Sie schreiben: «${lead.message.length > 140 ? `${lead.message.slice(0, 140)}…` : lead.message}»\n\n`
    : "";

  let body = `vielen Dank für Ihre Anfrage.\n\n${context}Gerne melden wir uns mit einer konkreten Einschätzung. Wann erreichen wir Sie am besten für ein kurzes Erstgespräch?`;

  if (packageName === "Pilot") {
    body = `gerne bestätigen wir den Erhalt Ihrer Anfrage für den kostenlosen Pilot.\n\n${context}In einem kurzen Erstgespräch identifizieren wir den Prozess, der Sie aktuell am meisten Zeit kostet. Anschliessend testen Sie die Automatisierung sieben Tage unverbindlich. Welche zwei oder drei Zeitfenster passen Ihnen?`;
  } else if (packageName === "Core Solution") {
    body = `vielen Dank für Ihr Interesse an unserer Core Solution.\n\n${context}Gerne zeigen wir Ihnen anhand Ihres konkreten Falls, wie wir Ihre bestehenden Tools über sichere KI-Pipelines verbinden. Wann passt Ihnen ein kurzes Gespräch?`;
  } else if (packageName === "Managed Service") {
    body = `vielen Dank für Ihre Anfrage zum Managed Service.\n\n${context}Gerne besprechen wir Ihre bestehende Umgebung und den laufenden Betreuungsbedarf in einem kurzen Call. Wann erreichen wir Sie am besten?`;
  }

  return `Guten Tag ${lead.name}\n\n${body}\n\nFreundliche Grüsse\nSynaptoCore · Zürich\nsynaptocore@gmail.com · +41 78 809 00 94`;
}

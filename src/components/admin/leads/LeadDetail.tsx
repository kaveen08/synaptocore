import {
  Building2,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Ellipsis,
  FolderInput,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Phone,
  RefreshCw,
  Reply,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { appointmentDateTime, packageShort, packageTone, relativeTime } from "../lib/format";
import type { Folder, Lead, LeadMailEvent } from "../lib/types";

const kindLabels: Record<string, string> = {
  owner_notification: "Interne Benachrichtigung",
  customer_confirmation: "Kundenbestätigung",
};

function mailStatusBadge(status: string) {
  if (status === "sent") return { label: "zugestellt", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (status === "failed") return { label: "fehlgeschlagen", tone: "border-red-200 bg-red-50 text-red-700" };
  return { label: "ausstehend", tone: "border-amber-200 bg-amber-50 text-amber-700" };
}

export function LeadDetail({
  lead,
  mailEvents,
  folders,
  busy,
  compact = false,
  onReply,
  onRetryMail,
  onMove,
  onDelete,
}: {
  lead: Lead;
  mailEvents: LeadMailEvent[];
  folders: Folder[];
  busy: boolean;
  compact?: boolean;
  onReply: () => void;
  onRetryMail: () => void;
  onMove: (folder: Folder) => void;
  onDelete: () => void;
}) {
  const failedMail = mailEvents.filter((event) => event.status === "failed");
  const failedOwnerNotification = failedMail.some((event) => event.kind === "owner_notification");
  const failedCustomerConfirmation = failedMail.some((event) => event.kind === "customer_confirmation");

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(lead.email);
      toast.success("E-Mail-Adresse kopiert.");
    } catch {
      toast.error("Kopieren nicht möglich.");
    }
  }

  return (
    <article className={cn("mx-auto w-full max-w-3xl", compact && "pt-6")}>
      <div className={cn("sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-5 backdrop-blur-sm sm:px-8", compact && "px-5")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("font-normal", packageTone(lead.selected_package))}>
                {packageShort(lead.selected_package)}
              </Badge>
              {lead.replied_at && (
                <Badge variant="secondary">
                  <Check /> Beantwortet {relativeTime(lead.replied_at)}
                </Badge>
              )}
            </div>
            <h2 className="text-2xl font-semibold tracking-[-0.035em] text-balance">{lead.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{lead.company || "Keine Firma angegeben"}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={onReply}>
              <Reply /> Antworten
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
                <Ellipsis />
                <span className="sr-only">Weitere Aktionen</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
                {folders
                  .filter((folder) => folder.id !== lead.folder_id)
                  .map((folder) => (
                    <DropdownMenuItem key={folder.id} onClick={() => onMove(folder)} disabled={busy}>
                      <FolderInput /> {folder.name}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 /> Anfrage löschen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className={cn("px-6 py-6 sm:px-8", compact && "px-5")}>
        {failedMail.length > 0 && (
          <div className="mb-6 flex flex-col gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">E-Mail-Versand fehlgeschlagen</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {failedOwnerNotification && failedCustomerConfirmation
                    ? "Die interne Benachrichtigung und die Kundenbestätigung konnten nicht zugestellt werden."
                    : failedOwnerNotification
                      ? "Die interne Benachrichtigung konnte nicht zugestellt werden."
                      : "Die Kundenbestätigung konnte nicht zugestellt werden."}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onRetryMail} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Erneut versuchen
            </Button>
          </div>
        )}

        <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <ContactItem icon={Mail} label="E-Mail">
            <span className="flex items-center gap-1.5">
              <a href={`mailto:${lead.email}`} className="break-all text-sm text-foreground hover:text-primary hover:underline">
                {lead.email}
              </a>
              <Button variant="ghost" size="icon-xs" onClick={() => void copyEmail()} aria-label="E-Mail-Adresse kopieren" title="Kopieren">
                <Copy />
              </Button>
            </span>
          </ContactItem>
          <ContactItem icon={Phone} label="Telefon">
            {lead.phone ? (
              <a href={`tel:${lead.phone.replace(/\s/g, "")}`} className="text-sm text-foreground hover:text-primary hover:underline">
                {lead.phone}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Nicht angegeben</span>
            )}
          </ContactItem>
          <ContactItem icon={Building2} label="Unternehmen">
            <span className="text-sm">{lead.company || "Nicht angegeben"}</span>
          </ContactItem>
          <ContactItem icon={Clock3} label="Eingegangen">
            <span className="text-sm">
              {new Date(lead.created_at).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </ContactItem>
          {lead.appointment_start && (
            <ContactItem icon={CalendarDays} label={lead.appointment_status === "cancelled" ? "Termin abgesagt" : "Termin"}>
              <span className="text-sm">{appointmentDateTime(lead.appointment_start)}</span>
            </ContactItem>
          )}
        </dl>

        <Separator className="my-6" />

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <MessageSquareText className="size-4 text-muted-foreground" />
            Nachricht
          </div>
          <p className={cn("max-w-[70ch] whitespace-pre-wrap text-sm leading-7", !lead.message && "text-muted-foreground italic")}>
            {lead.message || "Keine Nachricht hinterlassen."}
          </p>
        </section>

        {mailEvents.length > 0 && (
          <>
            <Separator className="my-6" />
            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CircleCheck className="size-4 text-muted-foreground" />
                Automatische E-Mails
              </div>
              <ul className="space-y-2">
                {mailEvents.map((event) => {
                  const badge = mailStatusBadge(event.status);
                  return (
                    <li key={event.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                      <span className="text-sm">{kindLabels[event.kind] ?? event.kind}</span>
                      <Badge variant="outline" className={cn("font-normal", badge.tone)}>
                        {badge.label}
                      </Badge>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {event.sent_at
                          ? new Date(event.sent_at).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })
                          : event.status === "failed"
                            ? `${event.attempts} ${event.attempts === 1 ? "Versuch" : "Versuche"}`
                            : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </article>
  );
}

function ContactItem({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-2">
      <span className="mt-0.5 grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-1">{children}</dd>
      </div>
    </div>
  );
}

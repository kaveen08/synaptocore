import { useMemo, useState } from "react";
import { Ban, CalendarDays, Clock3, LoaderCircle, Plus, RotateCcw, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { appointmentDate, appointmentDateTime, appointmentTime } from "../lib/format";
import type { AppointmentBooking, AppointmentSlot, Lead } from "../lib/types";

type SlotGroup = {
  label: string;
  slots: AppointmentSlot[];
};

export function AppointmentsView({
  slots,
  bookings,
  leads,
  busy,
  onCreateSlot,
  onDeleteSlot,
  onCancelBooking,
  onReopenBooking,
  onOpenLead,
}: {
  slots: AppointmentSlot[];
  bookings: AppointmentBooking[];
  leads: Lead[];
  busy: boolean;
  onCreateSlot: (startsAt: string) => Promise<boolean>;
  onDeleteSlot: (slot: AppointmentSlot) => void;
  onCancelBooking: (booking: AppointmentBooking) => void;
  onReopenBooking: (booking: AppointmentBooking) => void;
  onOpenLead: (lead: Lead) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");

  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const activeBookingsBySlot = useMemo(() => {
    const result = new Map<string, AppointmentBooking>();
    for (const booking of bookings) {
      if (booking.status === "booked" && !result.has(booking.slot_id)) result.set(booking.slot_id, booking);
    }
    return result;
  }, [bookings]);
  const cancelledBookingsBySlot = useMemo(() => {
    const result = new Map<string, AppointmentBooking[]>();
    for (const booking of bookings) {
      if (booking.status !== "cancelled") continue;
      result.set(booking.slot_id, [...(result.get(booking.slot_id) ?? []), booking]);
    }
    return result;
  }, [bookings]);
  const groups = useMemo<SlotGroup[]>(() => {
    const grouped = new Map<string, AppointmentSlot[]>();
    for (const slot of slots) {
      const key = appointmentDate(slot.starts_at);
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return [...grouped.entries()].map(([label, groupedSlots]) => ({
      label,
      slots: groupedSlots,
    }));
  }, [slots]);

  async function createSlot() {
    const startsAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Bitte geben Sie ein gültiges Datum und eine Uhrzeit ein.");
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      toast.error("Termine müssen in der Zukunft liegen.");
      return;
    }
    await onCreateSlot(startsAt.toISOString());
  }

  function confirmDelete(slot: AppointmentSlot) {
    if (window.confirm("Freien Termin löschen?")) onDeleteSlot(slot);
  }

  function confirmCancel(booking: AppointmentBooking) {
    if (window.confirm("Termin absagen? Der Kunde wird nicht automatisch informiert.")) {
      onCancelBooking(booking);
    }
  }

  function confirmReopen(booking: AppointmentBooking) {
    if (window.confirm("Buchung reaktivieren? Der Slot ist danach wieder belegt.")) {
      onReopenBooking(booking);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="size-4 text-muted-foreground" />
                Neuer freier Termin
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Erstellen Sie genau die Zeiten, die öffentlich buchbar sein sollen.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[160px_120px_auto]">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Datum
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-9 bg-background" />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Zeit
                <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 bg-background" />
              </label>
              <Button className="self-end" onClick={() => void createSlot()} disabled={busy}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
                Erstellen
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Termine</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Absagen machen einen Slot wieder buchbar. Kunden werden dabei nicht automatisch informiert.
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="grid min-h-64 place-items-center px-6 py-10 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Clock3 className="size-4" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">Noch keine freien Termine</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Erstellen Sie oben den ersten Zeitpunkt. Danach erscheint er direkt auf der Kontaktseite.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {groups.map((group) => (
                <section key={group.label} className="px-4 py-4 sm:px-5">
                  <h3 className="mb-3 text-xs font-medium text-muted-foreground">{group.label}</h3>
                  <div className="space-y-2">
                    {group.slots.map((slot) => {
                      const activeBooking = activeBookingsBySlot.get(slot.id);
                      const cancelledBookings = cancelledBookingsBySlot.get(slot.id) ?? [];
                      const latestCancelled = cancelledBookings[0];
                      const booking = activeBooking ?? latestCancelled ?? null;
                      const lead = booking ? leadsById.get(booking.lead_id) : undefined;
                      const booked = Boolean(activeBooking);

                      return (
                        <div
                          key={slot.id}
                          className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span className={cn(
                              "mt-0.5 grid size-8 shrink-0 place-items-center rounded-md",
                              booked ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700",
                            )}>
                              <Clock3 className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{appointmentTime(slot.starts_at)}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-normal",
                                    booked
                                      ? "border-blue-200 bg-blue-50 text-blue-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                                  )}
                                >
                                  {booked ? "Gebucht" : "Verfügbar"}
                                </Badge>
                                {latestCancelled && !booked && (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                    Abgesagt
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {lead ? `${lead.name} · ${lead.company || "Keine Firma"}` : appointmentDateTime(slot.starts_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {lead && (
                              <Button variant="outline" size="sm" onClick={() => onOpenLead(lead)}>
                                <UserRound /> Lead öffnen
                              </Button>
                            )}
                            {activeBooking ? (
                              <Button variant="destructive" size="sm" disabled={busy} onClick={() => confirmCancel(activeBooking)}>
                                <Ban /> Absagen
                              </Button>
                            ) : latestCancelled ? (
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => confirmReopen(latestCancelled)}>
                                <RotateCcw /> Reaktivieren
                              </Button>
                            ) : null}
                            {!activeBooking && (
                              <Button variant="ghost" size="sm" disabled={busy} onClick={() => confirmDelete(slot)}>
                                <Trash2 /> Löschen
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { BadgeCheck, LoaderCircle, LockKeyhole, Mail, PlugZap, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Lead } from "../lib/types";

export function ReplyDialog({
  open,
  lead,
  subject,
  body,
  aiDrafting,
  sending,
  mailboxStatus,
  mailboxSetupOpen,
  mailboxPassword,
  mailboxConnecting,
  onOpenChange,
  onSubjectChange,
  onBodyChange,
  onGenerate,
  onSend,
  onMailboxSetupOpenChange,
  onMailboxPasswordChange,
  onConnectMailbox,
}: {
  open: boolean;
  lead: Lead | null;
  subject: string;
  body: string;
  aiDrafting: boolean;
  sending: boolean;
  mailboxStatus: "loading" | "connected" | "not_connected";
  mailboxSetupOpen: boolean;
  mailboxPassword: string;
  mailboxConnecting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onGenerate: () => void;
  onSend: () => void;
  onMailboxSetupOpenChange: (open: boolean) => void;
  onMailboxPasswordChange: (value: string) => void;
  onConnectMailbox: () => void;
}) {
  const mailto = lead
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Mail senden</DialogTitle>
          <DialogDescription>
            Von info@systemio.ch an {lead?.name} · {lead?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between gap-4 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                {mailboxStatus === "connected" ? (
                  <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
                ) : (
                  <PlugZap className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">Swizzonic-Postfach</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {mailboxStatus === "loading"
                      ? "Verbindung wird geprüft …"
                      : mailboxStatus === "connected"
                        ? "info@systemio.ch ist verbunden"
                        : "Noch nicht verbunden"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMailboxSetupOpenChange(!mailboxSetupOpen)}
                disabled={mailboxStatus === "loading" || mailboxConnecting || sending}
              >
                {mailboxStatus === "connected" ? "Neu verbinden" : "Verbinden"}
              </Button>
            </div>

            {mailboxSetupOpen && (
              <div className="grid gap-3 border-t px-3 py-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Geben Sie einmalig das Passwort des Swizzonic-Postfachs ein.
                  Es wird verschlüsselt gespeichert und danach nicht mehr an den Browser zurückgegeben.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="mailbox-password">Postfach-Passwort</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mailbox-password"
                      type="password"
                      autoComplete="current-password"
                      value={mailboxPassword}
                      onChange={(event) => onMailboxPasswordChange(event.target.value)}
                      placeholder="Passwort von info@systemio.ch"
                      className="pl-8"
                    />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={onConnectMailbox}
                  disabled={!mailboxPassword || mailboxConnecting || sending}
                >
                  {mailboxConnecting ? <LoaderCircle className="animate-spin" /> : <PlugZap />}
                  {mailboxConnecting ? "Verbindung wird getestet …" : "Verbinden und testen"}
                </Button>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reply-subject">Betreff</Label>
            <Input id="reply-subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="reply-body">Nachricht</Label>
              <Button variant="ghost" size="sm" onClick={onGenerate} disabled={aiDrafting}>
                {aiDrafting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {aiDrafting ? "Entwurf wird erstellt …" : "Entwurf erstellen"}
              </Button>
            </div>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              placeholder="Antwort verfassen oder einen Entwurf erstellen …"
              className="min-h-64 resize-y leading-6"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" render={<a href={mailto} target="_blank" rel="noreferrer" />}>
            <Mail /> Im E-Mail-Programm öffnen
          </Button>
          <Button
            onClick={onSend}
            disabled={
              !subject.trim() ||
              !body.trim() ||
              sending ||
              mailboxConnecting ||
              mailboxStatus !== "connected"
            }
          >
            {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
            {sending ? "E-Mail wird gesendet …" : "E-Mail senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

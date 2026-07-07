import { LoaderCircle, Mail, Send, Sparkles } from "lucide-react";

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
  busy,
  onOpenChange,
  onSubjectChange,
  onBodyChange,
  onGenerate,
  onSave,
}: {
  open: boolean;
  lead: Lead | null;
  subject: string;
  body: string;
  aiDrafting: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}) {
  const mailto = lead
    ? `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Antwort vorbereiten</DialogTitle>
          <DialogDescription>
            An {lead?.name} · {lead?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
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
          <Button onClick={onSave} disabled={!body.trim() || busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Send />}
            Als beantwortet markieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

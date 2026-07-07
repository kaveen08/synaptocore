import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Folder } from "../lib/types";

export interface FolderDialogState {
  mode: "create" | "rename";
  folder?: Folder;
}

export function FolderDialog({
  state,
  name,
  busy,
  onNameChange,
  onClose,
  onSave,
}: {
  state: FolderDialogState | null;
  name: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.mode === "create" ? "Ordner erstellen" : "Ordner umbenennen"}</DialogTitle>
          <DialogDescription>
            {state?.mode === "create"
              ? "Fügen Sie eine eigene Stufe zu Ihrem Lead-Prozess hinzu."
              : "Der neue Name wird sofort für alle Anfragen übernommen."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="folder-name">Name</Label>
          <Input
            id="folder-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onSave()}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={onSave} disabled={!name.trim() || busy}>
            {busy && <LoaderCircle className="animate-spin" />}
            {state?.mode === "create" ? "Erstellen" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

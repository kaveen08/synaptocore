import { LoaderCircle } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import type { Folder, Lead } from "../lib/types";

export function DeleteLeadDialog({
  lead,
  busy,
  onClose,
  onConfirm,
}: {
  lead: Lead | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={Boolean(lead)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anfrage endgültig löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Anfrage von {lead?.name} wird dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" />} Löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteFolderDialog({
  folder,
  busy,
  onClose,
  onConfirm,
}: {
  folder: Folder | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={Boolean(folder)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ordner löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Alle Anfragen aus «{folder?.name}» werden zurück in die Inbox verschoben. Der Ordner selbst wird gelöscht.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" />} Ordner löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

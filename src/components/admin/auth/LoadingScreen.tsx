import { BrandMark } from "../layout/BrandMark";

export function LoadingScreen() {
  return (
    <div className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <BrandMark />
        <span>Arbeitsbereich wird vorbereitet …</span>
      </div>
    </div>
  );
}

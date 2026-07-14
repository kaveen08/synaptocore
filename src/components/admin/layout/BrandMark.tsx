export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <img
      src={inverted ? "/systemio-mark-white.svg" : "/systemio-mark.svg"}
      alt=""
      aria-hidden="true"
      className="size-8 shrink-0 object-contain"
      width="165"
      height="165"
    />
  );
}

export default function Logo({
  size = 40,
  withWordmark = false,
}: {
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <a href="/" className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt="Radi"
        width={size}
        height={size}
        className="shrink-0"
      />
      {withWordmark && (
        <span className="text-[17px] font-bold tracking-wide text-foreground">
          RADI
        </span>
      )}
    </a>
  );
}

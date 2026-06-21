const BANKS = ["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "AmBank"];

export function BankLogos() {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">
        Pay via FPX from
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {BANKS.map((b) => (
          <span
            key={b}
            className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
          >
            {b}
          </span>
        ))}
        <span className="text-[10px] text-muted-foreground/70">& more</span>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: "h-7 w-7", text: "text-sm", inner: "text-[13px]" },
  md: { box: "h-9 w-9", text: "text-lg", inner: "text-[17px]" },
  lg: { box: "h-12 w-12", text: "text-2xl", inner: "text-[22px]" },
} as const;

export function BrandMark({ size = "md", showWordmark = true, className }: Props) {
  const s = SIZES[size];
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          s.box,
          "relative rounded-xl bg-gradient-primary shadow-elegant flex items-center justify-center overflow-hidden",
        )}
      >
        <span
          className={cn(
            s.inner,
            "font-display font-bold text-primary-foreground leading-none",
          )}
          aria-hidden
        >
          R
        </span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/15" aria-hidden />
      </div>
      {showWordmark && (
        <span className={cn(s.text, "font-display font-semibold tracking-tight text-foreground")}>
          Resume Tailor
        </span>
      )}
    </div>
  );
}

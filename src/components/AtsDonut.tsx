import { motion, useReducedMotion } from "framer-motion";
import { AnimatedCounter } from "./AnimatedCounter";
import { cn } from "@/lib/utils";

interface Props {
  score: number;
  size?: number;
  className?: string;
}

export function AtsDonut({ score, size = 72, className }: Props) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const colorVar =
    clamped >= 80 ? "var(--success)" : clamped >= 60 ? "var(--warning)" : "var(--destructive)";

  return (
    <div
      className={cn("relative flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
      aria-label={`ATS score ${clamped}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={6}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`hsl(${colorVar})`}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold leading-none">
          <AnimatedCounter value={clamped} duration={900} />
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">ATS</span>
      </div>
    </div>
  );
}

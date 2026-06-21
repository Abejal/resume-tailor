import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface Props {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({ value, duration = 600, className }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return <span className={className}>{display}</span>;
}

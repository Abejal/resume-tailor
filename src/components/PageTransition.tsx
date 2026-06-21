import { motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={location.pathname}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

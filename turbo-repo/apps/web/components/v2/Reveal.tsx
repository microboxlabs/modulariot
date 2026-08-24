"use client";

import { motion, useReducedMotion } from "framer-motion";

// Scroll-reveal estilo luuk.cl: fade-in + slide-up al entrar al viewport.
// `delay` (por índice) produce el efecto escalonado. Respeta prefers-reduced-motion.
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  id,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "span";
  id?: string;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      id={id}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealVariant = "up" | "left" | "right" | "scale" | "blur";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        el.style.transitionDelay = `${delay}ms`;
        if (entry.isIntersecting) {
          el.classList.add("scroll-visible");
        } else {
          el.classList.remove("scroll-visible");
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`scroll-reveal scroll-reveal--${variant} ${className}`}>
      {children}
    </div>
  );
}

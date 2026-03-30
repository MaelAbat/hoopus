"use client";

import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

export default function ScrollButton() {
  const [atBottom, setAtBottom] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function update() {
      const scrollY = window.scrollY;
      const windowH = window.innerHeight;
      const docH = document.documentElement.scrollHeight;

      // Show only if the page is scrollable (content taller than viewport + some margin)
      setVisible(docH > windowH + 100);
      // Consider "at bottom" when within 100px of the end
      setAtBottom(scrollY + windowH >= docH - 100);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!visible) return null;

  function handleClick() {
    if (atBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-3 z-40 lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-accent text-white shadow-lg active:scale-95 transition-transform"
      aria-label={atBottom ? "Remonter en haut" : "Aller en bas"}
    >
      {atBottom ? <ArrowUp size={20} /> : <ArrowDown size={20} />}
    </button>
  );
}

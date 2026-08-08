import React from "react";
import { Linkedin } from "lucide-react";
import { DEV_CREDIT, DEV_LINKEDIN } from "./store.js";

// Bandeau crédit collé en bas de chaque page.
export default function Footer() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-border/40 bg-background/90 px-4 py-1.5 text-center text-[11px] font-medium text-muted-foreground backdrop-blur-md">
      <span>
        Developed with <span aria-hidden="true">🧡</span> by {DEV_CREDIT}
      </span>
      <a
        href={DEV_LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`LinkedIn de ${DEV_CREDIT}`}
        className="inline-flex items-center transition-colors duration-150 hover:text-foreground"
      >
        <Linkedin size={14} strokeWidth={2.25} />
      </a>
    </footer>
  );
}

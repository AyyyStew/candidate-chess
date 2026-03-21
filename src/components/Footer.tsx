import { NavLink } from "react-router-dom";
import { Info, ScrollText, Github, ShieldCheck, FileText } from "lucide-react";

const linkClass =
  "flex items-center gap-1.5 px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded";

export default function Footer() {
  return (
    <footer className="border-t border-edge-hi mt-auto py-6 px-8">
      <div className="max-w-screen-lg mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img
            src="/candidate_chess_logo.svg"
            alt="Candidate Chess Logo"
            className="w-4 h-4 opacity-60"
          />
          <span className="text-xs text-muted font-semibold">
            &copy; {new Date().getFullYear()} Candidate Chess
          </span>
        </div>

        {/* Links */}
        <nav className="flex items-center flex-wrap justify-center">
          <NavLink to="/privacy" className={linkClass}>
            <ShieldCheck size={12} /> Privacy Policy
          </NavLink>
          <NavLink to="/terms" className={linkClass}>
            <FileText size={12} /> Terms &amp; Conditions
          </NavLink>
          <span className="text-edge-hi px-1">·</span>
          <NavLink to="/about" className={linkClass}>
            <Info size={12} /> About
          </NavLink>
          <NavLink to="/news" className={linkClass}>
            <ScrollText size={12} /> Dev Log
          </NavLink>
          <a
            href="https://github.com/AyyyStew/candidate-chess"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            <Github size={12} /> GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}

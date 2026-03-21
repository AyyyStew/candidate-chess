import { NavLink } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-edge-hi mt-auto py-6 px-8">
      <div className="max-w-screen-lg mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-xs text-muted">
          &copy; {new Date().getFullYear()} Candidate Chess
        </span>

        <nav className="flex items-center gap-1 flex-wrap justify-center">
          <NavLink
            to="/about"
            className="px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded"
          >
            About
          </NavLink>
          <span className="text-edge-hi">·</span>
          <NavLink
            to="/news"
            className="px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded"
          >
            Dev Log
          </NavLink>
          <span className="text-edge-hi">·</span>
          <a
            href="https://github.com/AyyyStew/candidate-chess"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded"
          >
            GitHub
          </a>
          <span className="text-edge-hi">·</span>
          <NavLink
            to="/privacy"
            className="px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded"
          >
            Privacy Policy
          </NavLink>
          <span className="text-edge-hi">·</span>
          <NavLink
            to="/terms"
            className="px-2 py-1 text-xs text-muted hover:text-label transition-colors rounded"
          >
            Terms &amp; Conditions
          </NavLink>
        </nav>
      </div>
    </footer>
  );
}

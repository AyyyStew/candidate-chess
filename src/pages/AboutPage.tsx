import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  CalendarDays,
  Shuffle,
  BookOpen,
  Wrench,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

const modes: { term: string; to: string; icon: LucideIcon; def: string }[] = [
  {
    term: "Daily",
    to: "/",
    icon: CalendarDays,
    def: "A shared daily position for everyone. Come back each day for a fresh challenge.",
  },
  {
    term: "Random",
    to: "/random",
    icon: Shuffle,
    def: "A random position from the precomputed set. Good for quick reps.",
  },
  {
    term: "Library",
    to: "/library",
    icon: BookOpen,
    def: "Browse and filter the full position library by phase, balance, and complexity.",
  },
  {
    term: "Custom",
    to: "/custom",
    icon: Wrench,
    def: "Paste in any FEN and practise from your own position.",
  },
  {
    term: "Study",
    to: "/study",
    icon: GraduationCap,
    def: "An analysis board where engine evals and top moves stay hidden until you ask.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About — Candidate Chess</title>
        <meta
          name="description"
          content="Learn how Candidate Chess works. A chess trainer built around deliberate candidate move thinking — find the engine's top 5 moves with no hints."
        />
      </Helmet>
      <main className="max-w-2xl mx-auto px-8 py-16 flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <h1 className="font-black text-3xl tracking-tight">About</h1>
          <p className="text-label leading-relaxed">
            Candidate Chess is a chess training app built around one question:
          </p>
          <p className="text-xl font-black tracking-tight text-text">
            What do I do here?
          </p>
          <p className="text-label leading-relaxed">
            You're shown a position and asked to find the engine's top 5 moves.
            No eval bar, no hints. The goal is to force deliberate candidate
            move thinking before reaching for the engine.
          </p>
          <p className="text-muted leading-relaxed">
            Loosely inspired by the Kotov method. Built by an 800 elo player, so
            take that with a grain of salt.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg tracking-tight text-text">Modes</h2>
          <dl className="flex flex-col gap-2">
            {modes.map(({ term, to, icon: Icon, def }) => (
              <Link
                key={term}
                to={to}
                className="flex gap-4 p-3 rounded-lg hover:bg-surface-hi transition-colors group"
              >
                <dt className="flex items-center gap-2 text-sm font-semibold text-accent w-24 shrink-0 pt-0.5">
                  <Icon size={14} />
                  {term}
                </dt>
                <dd className="text-muted text-sm leading-relaxed group-hover:text-label transition-colors">
                  {def}
                </dd>
              </Link>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-lg tracking-tight text-text">
            Under the hood
          </h2>
          <p className="text-muted text-sm leading-relaxed">
            Runs in the browser via React, Tailwind, and Stockfish 18 (WASM).
            Precomputed positions were generated with local Stockfish through a
            custom pipeline —{" "}
            <a
              href="https://github.com/AyyyStew/candidate-chess/tree/master/position_generation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hi underline underline-offset-2 transition-colors"
            >
              details on GitHub
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}

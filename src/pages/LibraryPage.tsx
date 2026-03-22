import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import {
  getFilteredSamples,
  type PositionFilters,
} from "../services/positionService";
import type { Position } from "../types";
import PositionCarousel from "../components/PositionCarousel";
import {
  Sprout,
  Swords,
  Clock,
  Crown,
  TrendingDown,
  Minus,
  TrendingUp,
  Trophy,
  Brain,
  Zap,
  Crosshair,
  Shield,
  type LucideIcon,
} from "lucide-react";

type FilterKey = keyof PositionFilters;

const FILTER_GROUPS: Array<{
  key: FilterKey;
  label: string;
  options: {
    value: string;
    label: string;
    description: string;
    icon: LucideIcon;
    activeColor: string;
  }[];
}> = [
  {
    key: "phase",
    label: "Game Phase",
    options: [
      {
        value: "opening",
        label: "Opening",
        description: "Pieces still developing, structure being decided",
        icon: Sprout,
        activeColor: "bg-sky-600 border-sky-600 shadow-sky-600/30",
      },
      {
        value: "middlegame",
        label: "Middlegame",
        description: "Both sides mobilized, plans in full clash",
        icon: Swords,
        activeColor: "bg-amber-600 border-amber-600 shadow-amber-600/30",
      },
      {
        value: "endgame",
        label: "Endgame",
        description: "Few pieces remain, king becomes active",
        icon: Crown,
        activeColor: "bg-violet-700 border-violet-700 shadow-violet-700/30",
      },
    ],
  },

  {
    key: "balance",
    label: "Balance",
    options: [
      {
        value: "worse",
        label: "Worse",
        description: "The side to move is at a disadvantage",
        icon: TrendingDown,
        activeColor: "bg-red-700 border-red-700 shadow-red-700/30",
      },
      {
        value: "equal",
        label: "Equal",
        description: "Engine score near zero — objectively level",
        icon: Minus,
        activeColor: "bg-blue-600 border-blue-600 shadow-blue-600/30",
      },
      {
        value: "better",
        label: "Better",
        description: "Slight edge for the side to move",
        icon: TrendingUp,
        activeColor: "bg-green-700 border-green-700 shadow-green-700/30",
      },
      {
        value: "winning",
        label: "Winning",
        description: "Decisive advantage, outcome likely decided",
        icon: Trophy,
        activeColor: "bg-yellow-600 border-yellow-600 shadow-yellow-600/30",
      },
    ],
  },
  {
    key: "complexity",
    label: "Complexity",
    options: [
      {
        value: "rich",
        label: "Rich",
        description: "Many plausible candidates to weigh up",
        icon: Brain,
        activeColor: "bg-blue-700 border-blue-700 shadow-blue-700/30",
      },
      {
        value: "active",
        label: "Active",
        description: "Tactical opportunities available for both sides",
        icon: Zap,
        activeColor: "bg-orange-600 border-orange-600 shadow-orange-600/30",
      },
      {
        value: "sharp",
        label: "Sharp",
        description: "Critical moment — precision is required",
        icon: Crosshair,
        activeColor: "bg-red-700 border-red-700 shadow-red-700/30",
      },
      {
        value: "balanced",
        label: "Balanced",
        description: "Calmer position with fewer competing ideas",
        icon: Shield,
        activeColor: "bg-teal-700 border-teal-700 shadow-teal-700/30",
      },
    ],
  },
];

type Filters = Record<FilterKey, string[]>;

function emptyFilters(): Filters {
  return { phase: [], category: [], balance: [], complexity: [] };
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [count, setCount] = useState<number | null>(null);
  const [samples, setSamples] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;
    setSamples([]);
    setCount(null);
    setLoading(true);
    getFilteredSamples(filters, 30).then(({ count: c, samples: s }) => {
      if (genRef.current !== gen) return;
      setCount(c);
      setSamples(s);
      setLoading(false);
    });
  }, [filters]);

  function toggle(key: FilterKey, value: string) {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key][0] === value ? [] : [value],
    }));
  }

  const hasAnyFilter = Object.values(filters).some((arr) => arr.length > 0);

  const loadMore = useCallback(async () => {
    const { samples: more } = await getFilteredSamples(filters, 30);
    return more;
  }, [filters]);

  return (
    <>
      <Helmet>
        <title>Position Library — Candidate Chess</title>
        <meta
          name="description"
          content="Browse and filter the full library of curated chess positions by phase, balance, and complexity."
        />
      </Helmet>
      <main className="max-w-3xl mx-auto px-8 py-8 flex flex-col gap-8">
        <div>
          <h1 className="font-black text-xl sm:text-3xl tracking-tight">
            Position Library
          </h1>
          <p className="text-muted text-sm mt-1">
            Select filters to find a matching position, then play or study it.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {FILTER_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <hr className="flex-1 border-edge-hi" />
                <p className="text-xs text-muted uppercase tracking-widest font-semibold">
                  {group.label}
                </p>
                <hr className="flex-1 border-edge-hi" />
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {group.options.map((opt) => {
                  const active = filters[group.key].includes(opt.value);
                  return (
                    <button
                      key={`${group.key}-${opt.value}`}
                      onClick={() => toggle(group.key, opt.value)}
                      className={`w-36 flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left transition-all border ${
                        active
                          ? `${opt.activeColor} text-white shadow-md`
                          : "bg-interactive hover:bg-interactive-hi text-label border-edge-hi"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <opt.icon size={14} />
                        {opt.label}
                      </span>
                      <span
                        className={`text-xs leading-snug ${active ? "text-white/70" : "text-muted"}`}
                      >
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Count */}
        <p className="text-sm font-medium">
          {loading ? (
            <span className="text-muted">Counting positions…</span>
          ) : (
            <span>
              <span className="font-black text-label">
                {count?.toLocaleString()}
              </span>
              <span className="text-muted">
                {" "}
                position{count === 1 ? "" : "s"}{" "}
                {hasAnyFilter ? "match these filters" : "available"}
              </span>
            </span>
          )}
        </p>

        {/* Play / Study */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() =>
              samples[0] && navigate(`/random?pos=${samples[0].id}`)
            }
            disabled={!samples[0]}
            className="w-full py-3 rounded-xl font-bold text-base bg-accent hover:bg-accent-hi disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40"
          >
            {loading ? "Loading..." : "Play"}
          </button>
          <button
            onClick={() =>
              samples[0] &&
              navigate(`/study?fen=${encodeURIComponent(samples[0].fen)}`)
            }
            disabled={!samples[0]}
            className="w-full py-3 rounded-xl font-bold text-base bg-interactive hover:bg-interactive-hi disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading..." : "Study"}
          </button>
        </div>

        {/* Carousel */}
        <PositionCarousel
          positions={samples}
          loading={loading}
          count={count}
          onLoadMore={loadMore}
        />
      </main>
    </>
  );
}

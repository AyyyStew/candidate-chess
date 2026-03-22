import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Position } from "../types";
import ChessgroundBoard from "./ChessgroundBoard";

interface Props {
  positions: Position[];
  loading: boolean;
  count: number | null;
  onLoadMore: () => Promise<Position[]>;
}

const PAGE_SIZE = 3;

export default function PositionCarousel({
  positions,
  loading,
  count,
  onLoadMore,
}: Props) {
  const [allPositions, setAllPositions] = useState<Position[]>(positions);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const seenIds = useRef(new Set<string>());

  // Reset when the base positions change (filter changed)
  useEffect(() => {
    seenIds.current = new Set(positions.map((p) => p.id));
    setAllPositions(positions);
    setPage(0);
    setExhausted(false);
  }, [positions]);

  const totalPages = Math.max(1, Math.ceil(allPositions.length / PAGE_SIZE));
  const visible = allPositions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isLastPage = page === totalPages - 1;
  const isExhausted =
    exhausted || (count !== null && allPositions.length >= count);

  async function handleNext() {
    if (!isLastPage) {
      setPage((p) => p + 1);
      return;
    }
    setLoadingMore(true);
    const more = await onLoadMore();
    const fresh = more.filter((p) => !seenIds.current.has(p.id));
    fresh.forEach((p) => seenIds.current.add(p.id));
    if (fresh.length === 0) {
      setExhausted(true);
    } else {
      setAllPositions((prev) => [...prev, ...fresh]);
      setPage((p) => p + 1);
    }
    setLoadingMore(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-faint uppercase tracking-widest">
        Sample positions
      </p>
      {/* Boards */}
      <div className="grid grid-cols-3 gap-3">
        {loading
          ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg bg-interactive animate-pulse"
              />
            ))
          : visible.map((pos) => (
              <div
                key={pos.id}
                className="relative aspect-square rounded-lg overflow-hidden group"
              >
                <ChessgroundBoard
                  config={{
                    fen: pos.fen,
                    orientation: pos.orientation,
                    viewOnly: true,
                    movable: { free: false },
                    drawable: { enabled: false, visible: false },
                  }}
                />
                <div className="absolute inset-0 z-10 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                  <Link
                    to={`/random?pos=${pos.id}`}
                    className="w-3/4 py-1.5 rounded-lg font-bold text-sm bg-accent hover:bg-accent-hi text-white transition-colors text-center"
                  >
                    Play
                  </Link>
                  <Link
                    to={`/study?fen=${encodeURIComponent(pos.fen)}`}
                    className="w-3/4 py-1.5 rounded-lg font-bold text-sm bg-slate-600 hover:bg-slate-500 text-white transition-colors text-center"
                  >
                    Study
                  </Link>
                </div>
              </div>
            ))}
      </div>

      {/* Pagination */}
      {!loading && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded-lg text-sm bg-interactive hover:bg-interactive-hi disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          <span className="text-xs text-muted">
            {page + 1} /{" "}
            {count !== null ? Math.ceil(count / PAGE_SIZE) : totalPages}
          </span>
          <button
            onClick={handleNext}
            disabled={loadingMore || (isLastPage && isExhausted)}
            className="px-3 py-1 rounded-lg text-sm bg-interactive hover:bg-interactive-hi disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loadingMore ? "…" : "→"}
          </button>
        </div>
      )}
    </div>
  );
}

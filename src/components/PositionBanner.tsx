interface PositionBannerProps {
  label: string;
  event?: string;
  moveNumber: number;
  orientation: "white" | "black";
}

export default function PositionBanner({ label, event, moveNumber, orientation }: PositionBannerProps) {
  return (
    <div className="rounded-xl border border-edge-hi bg-surface px-6 py-5 flex items-center justify-between gap-8 shadow-lg shadow-black/30">
      <div className="min-w-0">
        <h2 className="font-black text-2xl text-text leading-tight">{label}</h2>
        {event && <p className="text-sm text-muted mt-1">{event}</p>}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-3">
        <div className="text-right">
          <p className="text-xs text-faint uppercase tracking-widest mb-1">Move</p>
          <p className="font-black text-4xl text-yellow-400 leading-none">{moveNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full ring-1 ring-white/10"
            style={{
              background: orientation === "white" ? "#f3f4f6" : "#030712",
              boxShadow:
                orientation === "white"
                  ? "0 0 6px rgba(243,244,246,0.35)"
                  : "0 0 6px rgba(0,0,0,0.8)",
            }}
          />
          <span className="text-sm font-semibold text-label">
            {orientation === "white" ? "White" : "Black"} to move
          </span>
        </div>
      </div>
    </div>
  );
}

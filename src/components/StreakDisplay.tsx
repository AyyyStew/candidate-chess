interface StreakDisplayProps {
  participationStreak: number;
  winStreak: number;
}

function Streak({ value, label, icon }: { value: number; label: string; icon: string }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className="text-base leading-none">{icon}</span>
      <span className="font-bold text-sm text-label tabular-nums">{value}</span>
    </div>
  );
}

export default function StreakDisplay({ participationStreak, winStreak }: StreakDisplayProps) {
  if (participationStreak === 0 && winStreak === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <Streak value={participationStreak} label="Play streak" icon="🔥" />
      <Streak value={winStreak} label="Win streak" icon="⭐" />
    </div>
  );
}

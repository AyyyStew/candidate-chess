import { CalendarDays, Flame, type LucideIcon } from "lucide-react";

interface StreakDisplayProps {
  participationStreak: number;
  winStreak: number;
}

function Streak({
  value,
  label,
  icon: Icon,
}: {
  value: number;
  label: string;
  icon: LucideIcon;
}) {
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon size={14} />
      <span className="font-bold text-sm text-label tabular-nums">{value}</span>
    </div>
  );
}

export default function StreakDisplay({
  participationStreak,
  winStreak,
}: StreakDisplayProps) {
  if (participationStreak === 0 && winStreak === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <Streak
        value={participationStreak}
        label="Play streak"
        icon={CalendarDays}
      />
      <Streak value={winStreak} label="Win streak" icon={Flame} />
    </div>
  );
}

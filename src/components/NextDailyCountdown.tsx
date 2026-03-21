import { useEffect, useState } from "react";

function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function NextDailyCountdown() {
  const [seconds, setSeconds] = useState(getSecondsUntilMidnightUTC);

  useEffect(() => {
    const id = setInterval(() => {
      const s = getSecondsUntilMidnightUTC();
      if (s <= 0) {
        window.location.reload();
        return;
      }
      setSeconds(s);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-sm text-muted tabular-nums">
      Next puzzle in {formatCountdown(seconds)}
    </span>
  );
}

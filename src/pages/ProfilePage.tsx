import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <span className="text-muted text-sm">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
        <div className="bg-surface border border-edge-hi rounded-xl p-6 w-80 flex flex-col gap-4 shadow-2xl">
          <p className="text-sm text-muted">You are not signed in.</p>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="bg-surface border border-edge-hi rounded-xl p-6 w-80 flex flex-col gap-5 shadow-2xl">
        <h2 className="font-bold text-lg">Profile</h2>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted font-semibold uppercase tracking-wide">
              Name
            </span>
            <span className="text-sm font-semibold text-label">
              {user.displayName}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted font-semibold uppercase tracking-wide">
              Email
            </span>
            <span className="text-sm text-label">{user.email}</span>
          </div>
          <div className="h-px bg-edge-hi" />
          <div className="flex gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted font-semibold uppercase tracking-wide">
                Participation streak
              </span>
              <span className="text-sm font-semibold text-label">
                {user.participationStreak}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted font-semibold uppercase tracking-wide">
                Win streak
              </span>
              <span className="text-sm font-semibold text-label">
                {user.winStreak}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-3 rounded-lg border border-edge-hi bg-surface-hi hover:bg-surface text-sm font-semibold text-muted hover:text-label transition-all text-left"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

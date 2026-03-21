import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { deleteAccount } from "../services/api";
import {
  UserRound,
  Mail,
  CalendarDays,
  Flame,
  LogOut,
  LogIn,
  Trash2,
  X,
} from "lucide-react";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <LogIn size={15} />
            Sign in
          </button>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    navigate("/");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError(false);
    const ok = await deleteAccount();
    if (ok) {
      await logout();
      navigate("/");
    } else {
      setDeleteError(true);
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] px-4">
      <div className="bg-surface border border-edge-hi rounded-xl p-6 w-80 flex flex-col gap-5 shadow-2xl">
        <h2 className="font-bold text-lg">Profile</h2>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs text-muted font-semibold uppercase tracking-wide">
              <UserRound size={11} />
              Name
            </span>
            <span className="text-sm font-semibold text-label">
              {user.displayName}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1 text-xs text-muted font-semibold uppercase tracking-wide">
              <Mail size={11} />
              Email
            </span>
            <span className="text-sm text-label">{user.email}</span>
          </div>
          <div className="h-px bg-edge-hi" />
          <div className="flex gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-xs text-muted font-semibold uppercase tracking-wide">
                <CalendarDays size={11} />
                Participation streak
              </span>
              <span className="text-sm font-semibold text-label">
                {user.participationStreak}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1 text-xs text-muted font-semibold uppercase tracking-wide">
                <Flame size={11} />
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
          disabled={loggingOut}
          className="flex items-center gap-2 px-4 py-3 rounded-lg bg-interactive hover:bg-interactive-hi text-sm font-semibold text-label transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut size={15} />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-interactive hover:bg-red-600 text-sm font-semibold text-muted hover:text-white transition-all"
          >
            <Trash2 size={15} />
            Delete account
          </button>
        ) : (
          <div className="flex flex-col gap-3 border border-red-500/40 rounded-lg p-4">
            <p className="text-xs text-muted leading-relaxed">
              This will permanently delete your account and all solve history.
              Type{" "}
              <span className="font-mono font-bold text-label">DELETE</span> to
              confirm.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="px-3 py-2 rounded-lg border border-edge-hi bg-surface text-sm font-mono focus:outline-none focus:border-red-500 transition-colors"
            />
            {deleteError && (
              <p className="text-xs text-red-500">
                Something went wrong. Please try again.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== "DELETE" || deleting}
                className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                  setDeleteError(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-interactive hover:bg-interactive-hi text-sm font-semibold text-muted hover:text-label transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

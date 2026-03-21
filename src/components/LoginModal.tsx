interface LoginModalProps {
  onClose: () => void;
}

const providers = [
  {
    key: "google",
    label: "Google",
    href: "/api/v1/auth/google",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
    ),
  },
  {
    key: "lichess",
    label: "Lichess",
    href: "/api/v1/auth/lichess",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 50 50"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M38.956.5c-3.53.418-6.452 2.525-8.662 4.96C27.292 3.99 24 3.92 24 3.92s.284 2.718 1.25 5.247c-1.813 1.658-3.305 3.575-4.28 5.956C19.222 14.854 14 16.5 14 16.5s2.86 2.254 6.857 3.517C20.137 22.5 20 25.1 20 25.1s2.18-.824 4.932-2.299c.53 1.23 1.077 2.417 1.568 3.556-.937.914-1.61 1.955-1.5 3.143-3.173.566-5.28 3.207-5 6 .28 2.794 2.838 4.803 5.5 5 2.66.196 5.063-1.325 6.5-3 1.438-1.675 1.72-4 1-6-1.032-2.87-3.5-4-3.5-4s1.045-1.115 2.5-3.143c.483.258.98.5 1.5.643.037 2.5 1.72 4.65 4 5 2.28.35 4.5-1.14 5.28-3.28.78-2.14.07-4.47-1.78-5.72 1.12-1.688 1.78-3.52 2-5.5 2.5 1.5 4.5 4 4.5 4s-.426-5.638-3.25-10.5c.672-1.5.906-3.15.75-4.75-.367-3.8-3.044-6.668-6.044-7z" />
      </svg>
    ),
  },
];

export default function LoginModal({ onClose }: LoginModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-edge-hi rounded-xl p-6 w-80 flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">Sign in</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-label hover:bg-surface-hi transition-all"
            aria-label="Close"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-muted">
          Sign in to save your solve history.
        </p>

        <div className="flex flex-col gap-2">
          {providers.map((p) => (
            <a
              key={p.key}
              href={p.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-edge-hi bg-surface-hi hover:bg-accent hover:text-white hover:border-accent transition-all font-semibold text-sm"
            >
              {p.icon}
              Sign in with {p.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

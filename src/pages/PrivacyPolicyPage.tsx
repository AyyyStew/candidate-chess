export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-2xl mx-auto px-8 py-16 flex flex-col gap-8">
      <h1 className="font-black text-3xl tracking-tight">Privacy Policy</h1>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">What we collect</h2>
        <p className="text-muted text-sm leading-relaxed">
          When you sign in, we store your display name and email address from
          your OAuth provider (Google or Lichess). We also store your puzzle
          solve history so we can track your streaks and progress.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">How we use it</h2>
        <p className="text-muted text-sm leading-relaxed">
          Your data is used solely to provide the app's features — saving your
          solve history, displaying your streaks, and identifying your session.
          We do not sell or share your data with third parties.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Cookies &amp; sessions</h2>
        <p className="text-muted text-sm leading-relaxed">
          We use a session cookie to keep you signed in. No third-party tracking
          or advertising cookies are used.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Data deletion</h2>
        <p className="text-muted text-sm leading-relaxed">
          You can sign out at any time. To request deletion of your account and
          associated data, contact us via GitHub.
        </p>
      </div>
    </main>
  );
}

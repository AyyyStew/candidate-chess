export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-8 py-16 flex flex-col gap-8">
      <h1 className="font-black text-3xl tracking-tight">
        Terms &amp; Conditions
      </h1>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Use of the service</h2>
        <p className="text-muted text-sm leading-relaxed">
          Candidate Chess is a free chess training tool provided as-is. By using
          the app you agree not to abuse, scrape, or attempt to disrupt the
          service.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Accounts</h2>
        <p className="text-muted text-sm leading-relaxed">
          You are responsible for keeping your account secure. We reserve the
          right to suspend accounts that violate these terms.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Disclaimer</h2>
        <p className="text-muted text-sm leading-relaxed">
          This service is provided without warranty of any kind. We are not
          liable for any loss or damage arising from your use of the app.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="font-bold text-lg text-text">Changes</h2>
        <p className="text-muted text-sm leading-relaxed">
          These terms may be updated at any time. Continued use of the app
          constitutes acceptance of any changes.
        </p>
      </div>
    </main>
  );
}

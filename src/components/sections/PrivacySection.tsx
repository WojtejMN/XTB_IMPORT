export function PrivacySection() {
  return (
    <section
      id="prywatnosc"
      className="scroll-mt-28 mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8"
    >
      <div className="rounded-3xl border border-border bg-primary-soft/70 px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Prywatność</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          Historia konta nie opuszcza Twojego urządzenia
        </h2>
        <div className="mt-4 grid gap-6 text-sm leading-6 text-muted md:grid-cols-2">
          <p>
            Parser i wykres działają lokalnie w przeglądarce. Konto i newsletter są opcjonalne —
            e-mail zapisujemy tylko wtedy, gdy sam go podasz. Pliku XTB nigdy nie wysyłamy na
            serwer.
          </p>
          <p>
            Narzędzie nie jest produktem XTB i nie zastępuje informacji z xStation. Wyniki służą do
            własnego podglądu stóp zwrotu, a nie jako rekomendacja inwestycyjna.
          </p>
        </div>
      </div>
    </section>
  );
}

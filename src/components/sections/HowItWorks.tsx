const steps = [
  {
    number: "01",
    title: "Eksport z xStation",
    text: "W historii konta pobierz plik XLSX z całego okresu. To ten sam raport, który XTB udostępnia każdemu klientowi.",
  },
  {
    number: "02",
    title: "Wgranie na stronę",
    text: "Upuść plik w polu analizy. Dane zostają w przeglądarce — nie tworzymy konta i nie wysyłamy wyciągu dalej.",
  },
  {
    number: "03",
    title: "Wykres i wskaźniki",
    text: "Zobaczysz sumę wpłat, wyprodukowany zysk oraz łączną i roczną stopę zwrotu w jednym, czytelnym widoku.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="jak-to-dziala"
      className="scroll-mt-28 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Jak to działa</p>
      <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Trzy kroki, bez rejestracji
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
        Strona jest zaprojektowana dla osób, które chcą spokojnie sprawdzić własne wyniki — nie dla
        biur maklerskich i nie jako zamiennik platformy XTB.
      </p>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.number}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.25)]"
          >
            <p className="text-sm font-semibold text-primary">{step.number}</p>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

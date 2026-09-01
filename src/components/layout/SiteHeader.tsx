import { Logo } from "@/components/brand/Logo";

const nav = [
  { href: "#import", label: "Analiza" },
  { href: "#jak-to-dziala", label: "Jak to działa" },
  { href: "#prywatnosc", label: "Prywatność" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-header backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a href="#import" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Logo />
        </a>
        <nav aria-label="Główne" className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <p className="hidden rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary sm:block">
            Bez logowania
          </p>
          <a
            href="#import"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
          >
            Sprawdź wyniki
          </a>
        </div>
      </div>
      <nav
        aria-label="Sekcje"
        className="flex gap-4 overflow-x-auto border-t border-border px-4 py-2 text-sm font-medium text-muted md:hidden"
      >
        {nav.map((item) => (
          <a key={item.href} href={item.href} className="whitespace-nowrap hover:text-foreground">
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

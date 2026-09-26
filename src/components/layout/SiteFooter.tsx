import { NewsletterForm } from "@/components/NewsletterForm";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-footer">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            Narzędzie dla inwestorów indywidualnych, którzy chcą zobaczyć sumę wpłat, zysk i stopy
            zwrotu ze swojego konta XTB — bez zakładania konta i bez wysyłania historii na serwer.
          </p>
          <div className="mt-6 max-w-md">
            <NewsletterForm />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Nawigacja</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <a href="#import" className="hover:text-foreground">
                Analiza historii
              </a>
            </li>
            <li>
              <a href="#jak-to-dziala" className="hover:text-foreground">
                Jak to działa
              </a>
            </li>
            <li>
              <a href="#prywatnosc" className="hover:text-foreground">
                Prywatność
              </a>
            </li>
            <li>
              <a href="#newsletter" className="hover:text-foreground">
                Newsletter
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Zaufanie</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Analiza tylko w przeglądarce</li>
            <li>Bez konta i logowania</li>
            <li>Newsletter bez duplikatów e-maili</li>
            <li>Nie powiązane z XTB S.A.</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs leading-5 text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>
            © {new Date().getFullYear()} XTB Przegląd. Narzędzie niezależne, nie stanowi porady
            inwestycyjnej.
          </p>
          <p>XTB oraz xStation są znakami towarowymi ich właścicieli.</p>
        </div>
      </div>
    </footer>
  );
}

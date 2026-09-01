type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="h-8 w-8 shrink-0"
      >
        <rect width="32" height="32" rx="8" fill="#1a6fb5" />
        <path
          d="M7 21.5 12.2 16l3.3 3.1L25 10.5"
          fill="none"
          stroke="#eaf5fc"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="10.5" r="1.7" fill="#ffffff" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          XTB Przegląd
        </span>
        <span className="mt-0.5 text-[11px] font-medium tracking-wide text-muted">
          Wyniki Twojego konta
        </span>
      </span>
    </span>
  );
}

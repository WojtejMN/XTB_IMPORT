# Panel wyników XTB

Aplikacja webowa do importu historii z xStation (XTB). Po analizie pokazuje wykres **sumy wpłat** i **wyprodukowanego zysku** oraz na dole **łączną** i **roczną** stopę zwrotu.

Plan: [`docs/PLAN.md`](docs/PLAN.md)  
Zasady kodu i testów: [`Rules`](Rules)

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Recharts, Vitest.

Analiza działa w przeglądarce. Plik z historią nie jest wysyłany na serwer.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000).

## Testy i jakość

```bash
npm test
npm run lint
npm run build
```

## Eksport z XTB

1. xStation → **Historia konta**
2. Zakres: cała historia
3. **Eksportuj jako XLSX**
4. Wgraj plik na stronę

Parser czyta arkusze `CASH OPERATION HISTORY` i `CLOSED POSITION HISTORY`. Działa też CSV tych tabel.

# Plan: panel wyników XTB

## Problem

Inwestor XTB ma historię w xStation, ale platforma nie pokazuje w prosty sposób:

1. ile łącznie wpłacił w czasie,
2. jaki zysk ta historia faktycznie wyprodukowała,
3. jaka jest łączna i roczna stopa zwrotu.

Aplikacja ma to policzyć po wrzuceniu eksportu i pokazać na jednej czytelnej stronie.

## Zakres MVP

Wchodzi:

- import XLSX z xStation (oba arkusze) oraz CSV tych tabel
- wykres: kumulatywna suma wpłat vs kumulatywny zysk
- karty: łączna stopa zwrotu, roczna (XIRR), suma wpłat, zysk
- opcjonalne pole „aktualna wartość konta” (otwarte pozycje)
- analiza w 100% w przeglądarce
- przykładowe dane do szybkiego podglądu UI

Nie wchodzi w MVP:

- logowanie, baza, zapis plików na serwerze
- PIT-38 / podatek Belki
- porównanie z inflacją
- otwarte pozycje z osobnego eksportu (tylko szacunek przez saldo)
- wielowalutowość

## Przepływ użytkownika

```mermaid
flowchart TD
  A[Eksport XLSX/CSV z xStation] --> B[Wrzucenie pliku na stronę]
  B --> C[Parser CSV lub XLSX]
  C --> D[Klasyfikacja wpłat, wypłat, P/L, dywidend]
  D --> E[Wykres suma wpłat vs zysk]
  E --> F[Łączna i roczna stopa zwrotu]
```

## Definicje metryk

### Suma wpłat

Suma wszystkich operacji sklasyfikowanych jako `deposit`. Wypłaty **nie** pomniejszają tej linii — użytkownik pyta o sumę wpłat.

### Zysk wyprodukowany

```
zysk = Σ Net P/L zamkniętych pozycji
     + dywidendy + odsetki
     + withholding tax (ujemny)
     + inne przepływy kasowe poza wpłatą i wypłatą
```

`Net P/L = Gross P/L + prowizja + swap + rollover`

Jeśli użytkownik poda aktualne saldo:

```
zysk całkowity = saldo − (suma wpłat − suma wypłat)
niezrealizowany = zysk całkowity − zysk zrealizowany
```

### Łączna stopa zwrotu

```
łączna = zysk / suma wpłat
```

To prosta, czytelna miara. Nie jest money-weighted.

### Roczna stopa zwrotu

XIRR (jak Excel), rok = 365 dni.

Przepływy z perspektywy inwestora:

| Zdarzenie | Znak |
| --- | --- |
| Wpłata | ujemny |
| Wypłata | dodatni |
| Wartość końcowa | dodatnia (kapitał netto + zysk albo podane saldo) |

Kapitał netto = suma wpłat − suma wypłat.

## Format wejścia XTB

xStation: Historia konta → Eksportuj jako XLSX.

| Arkusz | Kluczowe kolumny |
| --- | --- |
| CASH OPERATION HISTORY | ID, Type, Time, Comment, Symbol, Amount |
| CLOSED POSITION HISTORY | Symbol, Type, Open/Close time, Commission, Swap, Gross P/L |

Typy kasowe (case-insensitive, tolerowane sufiksy): `deposit`, `withdrawal`, `DIVIDENT`, `Withholding Tax`, `Free-funds Interest`, podatki od odsetek.

Parser skanuje nagłówki zamiast zakładać stałe kolumny — eksport XTB zmieniał układ.

## Stack (aktualny na 2026)

| Warstwa | Wybór | Powód |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript | aktualny LTS, jeden język, hosting Vercel/Node |
| Styl | Tailwind CSS v4 | szybki, czytelny UI bez osobnego design systemu |
| Wykres | Recharts | prosty wykres liniowy w React |
| XLSX | fflate + XML | działa w przeglądarce, bez luk SheetJS |
| Testy | Vitest | szybkie testy czystych funkcji |

Świadomie bez bazy i API: plik nie opuszcza przeglądarki.

## Struktura kodu

- `src/lib/xtb` — parser i klasyfikacja
- `src/lib/analysis` — portfel i XIRR
- `src/components` — dropzone, wykres, karty
- `Rules` — zasady kodu i testów
- `src/**/*.test.ts` — testy jednostkowe

## Ryzyka

- XTB znowu zmieni nazwy arkuszy/kolumn → mapowanie po aliasach + test na fixturze
- Brak zamkniętych pozycji w CSV → ostrzeżenie, zysk tylko z cash
- XIRR bez przeciwnych przepływów → pokazujemy „—”
- Saldo otwartych pozycji nie jest w eksporcie historii → pole opcjonalne

## Później (nie teraz)

- PIT-38 / Belka
- inflacja GUS jako benchmark
- zapis lokalny (IndexedDB)
- wielowalutowość
- rozbicie zysku per symbol

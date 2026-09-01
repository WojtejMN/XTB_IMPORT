import type { ParsedXtbFile } from "./types";

function at(iso: string): Date {
  return new Date(iso);
}

export function sampleXtbHistory(): ParsedXtbFile {
  return {
    sourceName: "przyklad-xtb.csv",
    warnings: [],
    cashOperations: [
      {
        id: "1",
        kind: "deposit",
        rawType: "deposit",
        time: at("2023-01-10T10:00:00"),
        comment: "Wpłata",
        symbol: "",
        amount: 10_000,
      },
      {
        id: "2",
        kind: "deposit",
        rawType: "deposit",
        time: at("2023-03-15T09:30:00"),
        comment: "Wpłata",
        symbol: "",
        amount: 5_000,
      },
      {
        id: "3",
        kind: "dividend",
        rawType: "DIVIDENT",
        time: at("2023-06-20T00:00:00"),
        comment: "Apple",
        symbol: "AAPL.US",
        amount: 85,
      },
      {
        id: "4",
        kind: "withholding_tax",
        rawType: "Withholding Tax",
        time: at("2023-06-20T00:00:00"),
        comment: "Apple",
        symbol: "AAPL.US",
        amount: -12.75,
      },
      {
        id: "5",
        kind: "deposit",
        rawType: "deposit",
        time: at("2024-01-05T11:00:00"),
        comment: "Wpłata",
        symbol: "",
        amount: 8_000,
      },
      {
        id: "6",
        kind: "interest",
        rawType: "Free-funds Interest 2024-08",
        time: at("2024-08-30T00:00:00"),
        comment: "Odsetki",
        symbol: "",
        amount: 22.4,
      },
      {
        id: "7",
        kind: "withdrawal",
        rawType: "Withdrawal from 1844768",
        time: at("2024-11-10T12:00:00"),
        comment: "Wypłata",
        symbol: "",
        amount: -2_000,
      },
      {
        id: "8",
        kind: "deposit",
        rawType: "deposit",
        time: at("2025-06-01T08:15:00"),
        comment: "Wpłata",
        symbol: "",
        amount: 4_000,
      },
    ],
    closedPositions: [
      {
        position: "101",
        symbol: "EURUSD",
        type: "buy",
        volume: 0.1,
        openTime: at("2023-01-12T10:00:00"),
        closeTime: at("2023-01-20T16:00:00"),
        commission: 0,
        swap: -1.2,
        rollover: 0,
        grossProfit: 321.2,
        netProfit: 320,
        comment: "",
      },
      {
        position: "102",
        symbol: "US500",
        type: "buy",
        volume: 0.05,
        openTime: at("2023-07-01T09:00:00"),
        closeTime: at("2023-09-01T15:00:00"),
        commission: -2.5,
        swap: 0,
        rollover: 0,
        grossProfit: -147.5,
        netProfit: -150,
        comment: "",
      },
      {
        position: "103",
        symbol: "CDR.PL",
        type: "buy",
        volume: 10,
        openTime: at("2024-02-01T10:00:00"),
        closeTime: at("2024-04-12T11:20:00"),
        commission: -8,
        swap: 0,
        rollover: 0,
        grossProfit: 1_108,
        netProfit: 1_100,
        comment: "",
      },
      {
        position: "104",
        symbol: "NVDA.US",
        type: "buy",
        volume: 2,
        openTime: at("2024-12-02T14:00:00"),
        closeTime: at("2025-02-14T16:00:00"),
        commission: -4,
        swap: 0,
        rollover: 0,
        grossProfit: 644,
        netProfit: 640,
        comment: "",
      },
      {
        position: "105",
        symbol: "PZU.PL",
        type: "buy",
        volume: 40,
        openTime: at("2025-07-10T09:00:00"),
        closeTime: at("2025-12-20T15:45:00"),
        commission: -6,
        swap: 0,
        rollover: 0,
        grossProfit: 2_106,
        netProfit: 2_100,
        comment: "",
      },
    ],
  };
}

export const SAMPLE_CASH_CSV = `ID;Type;Time;Comment;Symbol;Amount;;;;
1;deposit;10.01.2023 10:00:00;Wpłata;;10000,00;;;;
2;deposit;15.03.2023 09:30:00;Wpłata;;5000,00;;;;
3;DIVIDENT;20.06.2023 00:00:00;Apple;AAPL.US;85,00;;;;
4;Withholding Tax;20.06.2023 00:00:00;Apple;AAPL.US;-12,75;;;;
5;deposit;05.01.2024 11:00:00;Wpłata;;8000,00;;;;
6;Free-funds Interest 2024-08;30.08.2024 00:00:00;Odsetki;;22,40;;;;
7;Withdrawal from 1844768;10.11.2024 12:00:00;Wypłata;;-2000,00;;;;
8;deposit;01.06.2025 08:15:00;Wpłata;;4000,00;;;;
Total;;;;;25094,65;;;;
`;

export const SAMPLE_TRADES_CSV = `Position;Symbol;Type;Volume;Open time;Close time;Open price;Close price;Commission;Swap;Gross P/L;Comment
101;EURUSD;buy;0.1;12.01.2023 10:00:00;20.01.2023 16:00:00;1.07000;1.08500;0;-1.2;321.20;
102;US500;buy;0.05;01.07.2023 09:00:00;01.09.2023 15:00:00;4400;4320;-2.5;0;-147.50;
103;CDR.PL;buy;10;01.02.2024 10:00:00;12.04.2024 11:20:00;120.00;231.00;-8;0;1108.00;
104;NVDA.US;buy;2;02.12.2024 14:00:00;14.02.2025 16:00:00;130.00;452.00;-4;0;644.00;
105;PZU.PL;buy;40;10.07.2025 09:00:00;20.12.2025 15:45:00;45.00;97.65;-6;0;2106.00;
`;

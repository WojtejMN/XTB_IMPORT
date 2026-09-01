"use client";

import { useId, useState } from "react";

type FileDropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export function FileDropzone({ onFiles, disabled }: FileDropzoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  function takeFiles(list: FileList | null) {
    if (!list || disabled) {
      return;
    }
    const files = Array.from(list);
    if (files.length > 0) {
      onFiles(files);
    }
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        takeFiles(event.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center shadow-[0_18px_40px_-28px_rgba(26,111,181,0.55)] transition ${
        isDragging
          ? "border-primary bg-primary-soft"
          : "border-primary/35 bg-surface hover:border-primary hover:bg-primary-soft/40"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        id={inputId}
        type="file"
        multiple
        accept=".xlsx,.xlsm,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 16V4m0 0 4 4M12 4 8 8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16" strokeLinecap="round" />
        </svg>
      </span>
      <span className="mt-4 text-base font-semibold text-foreground">
        Upuść jeden lub kilka eksportów XTB
      </span>
      <span className="mt-2 max-w-lg text-sm leading-6 text-muted">
        Możesz wgrać naraz historię portfela zwykłego, IKE i IKZE (XLSX lub CSV). Pliki zostają
        wyłącznie w przeglądarce. Typ konta rozpoznamy z nazwy — możesz go potem poprawić.
      </span>
    </label>
  );
}

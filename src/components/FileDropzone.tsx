"use client";

import { useId, useState } from "react";

type FileDropzoneProps = {
  onFile: (file: File) => void;
  disabled?: boolean;
};

export function FileDropzone({ onFile, disabled }: FileDropzoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

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
        const file = event.dataTransfer.files[0];
        if (file && !disabled) {
          onFile(file);
        }
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        isDragging
          ? "border-teal-600 bg-teal-50"
          : "border-stone-300 bg-white hover:border-teal-500 hover:bg-stone-50"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        id={inputId}
        type="file"
        accept=".xlsx,.xlsm,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFile(file);
          }
          event.target.value = "";
        }}
      />
      <span className="text-base font-semibold text-stone-900">
        Upuść eksport XTB albo kliknij, aby wybrać plik
      </span>
      <span className="mt-2 max-w-md text-sm leading-6 text-stone-600">
        Obsługiwane formaty: XLSX z xStation (Historia konta) oraz CSV operacji kasowych
        lub zamkniętych pozycji. Plik zostaje w przeglądarce.
      </span>
    </label>
  );
}

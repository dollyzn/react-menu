type Cell = string | number | null | undefined;

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3, useGrouping: false });

const cell = (value: Cell) => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? decimal.format(value) : value;
  return /[";\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * Downloads a CSV that Excel in pt-BR opens right away: `;` between columns,
 * decimal comma, UTF-8 with BOM (accents).
 */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const text = [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

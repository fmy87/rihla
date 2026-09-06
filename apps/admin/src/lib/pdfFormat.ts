/**
 * Converts report cell values to their PDF display form: null/undefined
 * become an em-dash rather than the literal string "null"/"undefined",
 * everything else is stringified as-is. Split out of pdf.ts so this rule
 * can be unit tested without pulling in jsPDF, which needs a canvas/DOM
 * and isn't meaningfully testable in the node test environment the rest
 * of this project's lib tests run in (see vitest.config.ts).
 */
export function cellsToDisplayRows(rows: (string | number | null | undefined)[][]): string[][] {
  return rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? '—' : String(cell))));
}

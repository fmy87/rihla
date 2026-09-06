import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cellsToDisplayRows } from './pdfFormat';

/**
 * Builds and downloads a simple titled table PDF. Deliberately mirrors
 * rowsToCsv/downloadCsv in shape (headers + row arrays) so callers — Reports
 * page — can reuse the same data they already assembled for CSV export.
 */
export function downloadTablePdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number | null)[][]
) {
  // Landscape fits wider report tables (6-8 columns) without wrapping every cell.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(title, 40, 40);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 58);

  autoTable(doc, {
    startY: 74,
    head: [headers],
    body: cellsToDisplayRows(rows),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42] }, // slate-900, matches the admin UI's dark headers
    alternateRowStyles: { fillColor: [248, 250, 252] }, // slate-50
    margin: { left: 40, right: 40 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Rihla — ${new Date().toISOString().slice(0, 10)} — Page ${i} of ${pageCount}`, 40, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(filename);
}


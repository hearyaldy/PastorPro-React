import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportSection {
  title: string;
  columns?: string[];
  rows?: (string | number)[][];
  text?: string;
  totals?: (string | number)[];
}
export interface PrintableReport {
  title: string;
  filename: string;
  subtitle?: string;
  metadata?: [string, string][];
  summary?: [string, string | number][];
  sections: ReportSection[];
  blueHeader?: boolean;
  orientation?: 'portrait' | 'landscape';
}

const printable = (value: string | number) => String(value)
  .replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...');

/** A4 report pages with repeated table headings and page numbers, not a screenshot of the app. */
export function buildReportPdf(report: PrintableReport, generatedAt = new Date()): jsPDF {
  const pdf = new jsPDF({ orientation: report.orientation || 'portrait', unit: 'pt', format: 'a4' });
  pdf.setProperties({ title: report.title, subject: report.subtitle || '', creator: 'PastorPro' });
  const margin = 32;
  const width = pdf.internal.pageSize.getWidth();
  let y = margin;
  const room = (height: number) => {
    if (y + height > pdf.internal.pageSize.getHeight() - 45) { pdf.addPage(); y = margin; }
  };
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  const titleLines = pdf.splitTextToSize(printable(report.title), width - margin * 2 - 24) as string[];
  const headerHeight = titleLines.length * 24 + (report.subtitle ? 30 : 12);
  if (report.blueHeader) { pdf.setFillColor(13, 71, 161); pdf.roundedRect(margin, y, width - margin * 2, headerHeight, 8, 8, 'F'); pdf.setTextColor(255); }
  pdf.text(titleLines, margin + (report.blueHeader ? 12 : 0), y + 24);
  y += titleLines.length * 24 + 10;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
  if (report.subtitle) { pdf.text(printable(report.subtitle), margin + (report.blueHeader ? 12 : 0), y + 4); y += 24; }
  pdf.setTextColor(25); y += 12;
  if (report.metadata?.length) {
    autoTable(pdf, { startY: y, margin, theme: 'plain', body: report.metadata.map(([label, value]) => [label, printable(value)]),
      styles: { fontSize: 10, cellPadding: 3 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 85 } } });
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }
  if (report.summary?.length) {
    autoTable(pdf, { startY: y, margin, head: [report.summary.map(([label]) => printable(label))], body: [report.summary.map(([, value]) => printable(value))],
      theme: 'plain', headStyles: { fillColor: [227, 242, 253], textColor: [13, 71, 161], halign: 'center', fontSize: 9 },
      bodyStyles: { fillColor: [227, 242, 253], textColor: [13, 71, 161], halign: 'center', fontSize: 15, fontStyle: 'bold' }, styles: { cellPadding: 8 } });
    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }
  for (const section of report.sections) {
    room(70);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(25);
    pdf.text(printable(section.title), margin, y + 12); y += 22;
    if (section.rows) {
      autoTable(pdf, { startY: y, margin: { top: margin, right: margin, bottom: 45, left: margin },
        head: section.columns ? [section.columns.map(printable)] : undefined,
        body: section.rows.map((row) => row.map(printable)), foot: section.totals ? [section.totals.map(printable)] : undefined,
        theme: 'grid', styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', lineColor: [210, 215, 220], lineWidth: 0.4 },
        headStyles: { fillColor: [238, 241, 245], textColor: [30, 40, 50], fontStyle: 'bold' },
        footStyles: { fillColor: [227, 242, 253], textColor: [13, 71, 161], fontStyle: 'bold' }, showFoot: 'lastPage', rowPageBreak: 'avoid' });
      y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    }
    if (section.text) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      for (const line of pdf.splitTextToSize(printable(section.text), width - margin * 2) as string[]) {
        room(15); pdf.text(line, margin, y + 10); y += 15;
      }
      y += 12;
    }
  }
  const pageCount = pdf.getNumberOfPages();
  const generated = generatedAt.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' });
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(100);
    pdf.text(`Generated: ${generated} (Bangkok)`, margin, pdf.internal.pageSize.getHeight() - 20);
    pdf.text(`Page ${page} of ${pageCount}`, width - margin, pdf.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  return pdf;
}

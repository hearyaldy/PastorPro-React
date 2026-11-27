import type { ReportSection } from '../lib/pdfReport';

export function ReportTables({ sections }: { sections: ReportSection[] }) {
  return <div className="space-y-4">{sections.map((section, index) => <section key={`${section.title}-${index}`} className="rounded-xl overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
    <h3 className="px-4 py-3 bg-[var(--bg-subtle)] text-sm font-semibold">{section.title}</h3>
    {section.text && <p className="px-4 py-3 text-sm whitespace-pre-wrap">{section.text}</p>}
    {section.rows && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      {section.columns && <thead><tr>{section.columns.map(label => <th key={label} className="p-3 text-xs text-[var(--text-secondary)]">{label}</th>)}</tr></thead>}
      <tbody>{section.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[var(--border-hairline)]">{row.map((cell, col) => <td key={col} className={`px-4 py-2.5 ${col === row.length - 1 ? 'text-right font-mono-tabular font-semibold' : ''}`}>{cell}</td>)}</tr>)}</tbody>
      {section.totals && <tfoot><tr className="bg-blue-50 text-blue-950">{section.totals.map((cell, col) => <td key={col} className={`p-3 font-semibold ${col === section.totals!.length - 1 ? 'text-right' : ''}`}>{cell}</td>)}</tr></tfoot>}
    </table></div>}
  </section>)}</div>;
}

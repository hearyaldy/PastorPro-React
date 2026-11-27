import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer, Share2, X } from 'lucide-react';
import type { PrintableReport } from '../lib/pdfReport';

export function ReportPreview({ report, onClose }: { report: PrintableReport; onClose: () => void }) {
  const [file, setFile] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setFile(null); setError('');
    import('../lib/pdfReport').then(({ buildReportPdf }) => {
      if (cancelled) return;
      const blob = buildReportPdf(report).output('blob');
      url = URL.createObjectURL(blob); setFile({ blob, url });
    }).catch(() => { if (!cancelled) setError('Unable to prepare this PDF. Close the preview and try again.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [report]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const focusable = Array.from(document.querySelectorAll<HTMLElement>('.report-preview button:not(:disabled), .report-preview iframe'));
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', escape); previous?.focus(); };
  }, []);
  const download = () => {
    if (!file) return;
    const link = document.createElement('a'); link.href = file.url; link.download = `${report.filename.replace(/\.pdf$/i, '')}.pdf`; link.click();
  };
  const share = async () => {
    if (!file) return;
    const pdf = new File([file.blob], `${report.filename.replace(/\.pdf$/i, '')}.pdf`, { type: 'application/pdf' });
    if (!navigator.canShare?.({ files: [pdf] })) { download(); return; }
    try { await navigator.share({ files: [pdf], title: report.title }); }
    catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) setError('Sharing is unavailable. You can download this PDF instead.'); }
  };
  return createPortal(<div className="report-preview" role="dialog" aria-modal="true" aria-label={`${report.title} print preview`}>
    <header className="report-preview-toolbar">
      <div className="min-w-0 flex-1"><h2 className="font-semibold truncate">{report.title}</h2><p className="text-xs opacity-80">A4 · {report.subtitle || 'Report preview'}</p></div>
      <button disabled={!file} onClick={download}><Download size={16} /> <span>Download PDF</span></button>
      <button disabled={!file} onClick={() => {
        try { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }
        catch { setError('Use the PDF viewer print button, or download the PDF to print it.'); }
      }}><Printer size={16} /> <span>Print</span></button>
      <button disabled={!file} onClick={share}><Share2 size={16} /> <span>Share</span></button>
      <button ref={close} onClick={onClose} aria-label="Close report preview"><X size={20} /></button>
    </header>
    {error && <div role="alert" className="bg-amber-50 text-amber-900 p-3 text-sm">{error}</div>}
    {file ? <iframe ref={frame} src={file.url} title={`${report.title} A4 PDF`} className="flex-1 w-full border-0" />
      : !error && <div role="status" className="flex-1 grid place-items-center">Preparing PDF…</div>}
  </div>, document.body);
}

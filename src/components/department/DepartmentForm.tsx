import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { retiredAnswerRows, validateAnswers, type DepartmentAnswers, type DepartmentQuestion, type DepartmentTemplate } from '../../lib/departmentReports';

export function DepartmentForm({ template, initialValues = {}, context, editing = false, preview = false, onSubmit, onClose }: {
  template: DepartmentTemplate; initialValues?: DepartmentAnswers; context: string; editing?: boolean; preview?: boolean;
  onSubmit: (values: DepartmentAnswers) => Promise<void>; onClose: () => void;
}) {
  const [values, setValues] = useState<DepartmentAnswers>(() => structuredClone(initialValues));
  const [step, setStep] = useState(0), [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [submitted, setSubmitted] = useState(false);
  useUnsavedChanges(dirty && !preview, busy);
  const close = () => { if (!busy && (preview || !dirty || window.confirm('Discard unsaved answers?'))) onClose(); };
  const update = (id: string, value: unknown) => { setValues(previous => ({ ...previous, [id]: value } as DepartmentAnswers)); setDirty(true); };
  const section = template.steps[step];
  const simple = (field: DepartmentQuestion, value: unknown, path: string, change: (value: unknown) => void) => <div className="df-question" key={path}>
    <label className="df-question-title" htmlFor={`answer-${path}`}>{field.label}{field.required && <span className="df-required"> *</span>}</label>
    {field.helpText && <p className="df-muted" id={`help-${path}`}>{field.helpText}</p>}
    {field.type === 'checkbox' ? <label className="df-check"><input id={`answer-${path}`} type="checkbox" checked={value === true} onChange={event => change(event.target.checked)} disabled={busy} />Yes</label>
      : field.type === 'dropdown' ? <select id={`answer-${path}`} aria-invalid={!!errors[path]} aria-describedby={errors[path] ? `error-${path}` : undefined} value={String(value ?? '')} onChange={event => change(event.target.value)} disabled={busy}><option value="">Choose</option>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select>
      : <div className="df-answer-line">{field.type === 'currency' && <span>{field.prefix || 'RM'}</span>}<input id={`answer-${path}`} aria-invalid={!!errors[path]} aria-describedby={errors[path] ? `error-${path}` : field.helpText ? `help-${path}` : undefined} type={field.type === 'number' || field.type === 'currency' ? 'number' : 'text'} min={field.type === 'text' ? undefined : 0} step={field.type === 'currency' ? '0.01' : '1'} maxLength={field.type === 'text' ? 4000 : undefined} value={typeof value === 'number' || typeof value === 'string' ? value : ''} placeholder={field.type === 'text' ? 'Your answer' : 'Enter a number'} onChange={event => change(event.target.value)} disabled={busy} /></div>}
    {errors[path] && <p className="df-error" id={`error-${path}`} role="alert">{errors[path]}</p>}
  </div>;
  const question = (field: DepartmentQuestion) => field.type !== 'repeatingGroup' ? <div className="df-card" key={field.id}>{simple(field, values[field.id], field.id, value => update(field.id, value))}</div>
    : <fieldset className="df-card df-group" key={field.id}><legend>{field.label}{field.required && <span className="df-required"> *</span>}</legend>{field.helpText && <p className="df-muted">{field.helpText}</p>}{Array.from({ length: field.repeatCount || 0 }, (_, index) => <div key={index} className="df-repeat"><h4>{field.repeatLabels?.[index] || `Month ${index + 1}`}</h4>{field.subFields?.map(sub => {
      const rows = Array.isArray(values[field.id]) ? values[field.id] as Record<string, unknown>[] : [];
      return simple(sub, rows[index]?.[sub.id], `${field.id}.${index}.${sub.id}`, value => { const copy = rows.map(row => ({ ...row })); copy[index] = { ...copy[index], [sub.id]: value }; update(field.id, copy); });
    })}</div>)}</fieldset>;
  const advance = () => {
    const found = preview ? {} : validateAnswers(template, values, step); setErrors(found);
    if (Object.keys(found).length) return;
    setStep(value => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = async () => {
    const found = validateAnswers(template, values); setErrors(found);
    if (Object.keys(found).length) { const first = template.steps.findIndex((_, index) => Object.keys(validateAnswers(template, values, index)).length > 0); setStep(Math.max(first, 0)); return; }
    setBusy(true); setError('');
    try { await onSubmit(values); setDirty(false); setSubmitted(true); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to submit. Your answers have been kept.'); } finally { setBusy(false); }
  };
  return <div className="department-forms"><div className="df-form-column">
    <button className="df-text-button" onClick={close} disabled={busy}>← {preview ? 'Back to editor' : 'Back to reports'}</button>
    <header className="df-card df-title"><div className="df-eyebrow"><FileText size={18} />{preview ? 'Form preview' : 'Quarterly department report'}</div><h2>{template.name}</h2>{template.description && <p>{template.description}</p>}<p className="df-context">{context}</p><div className="df-title-footer">{preview ? 'Preview only · answers are not saved' : submitted ? 'Response recorded' : <><span className="df-required">* Indicates required question</span><span>{dirty ? 'Unsaved answers' : editing ? 'Editing saved response' : 'New response'}</span></>}</div></header>
    {submitted ? <section className="df-card df-confirmation" role="status"><CheckCircle2 size={40} /><h3>{editing ? 'Your response has been updated' : 'Your response has been recorded'}</h3><p>{context}</p><p>You can reopen this report to view, edit, or print the saved response.</p><button className="df-primary" onClick={onClose}>Back to reports</button></section> : <>
      {section && <><div className="df-section-heading"><span>Section {step + 1} of {template.steps.length}</span><h3>{section.title}</h3>{section.subtitle && <p>{section.subtitle}</p>}</div>{section.fields.map(question)}</>}
      {retiredAnswerRows(template, initialValues).length > 0 && <details className="df-card"><summary>Earlier answers</summary><p className="df-muted">These answers come from questions outside the current form. They will be kept with this response.</p><dl>{retiredAnswerRows(template, initialValues).map(([label, value], index) => <div key={index} className="df-repeat"><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>}
      {error && <div className="df-card df-error" role="alert">{error}<p>Your answers remain in this form.</p></div>}
      <footer className="df-form-footer"><div>{step > 0 && <button className="df-secondary" disabled={busy} onClick={() => { setStep(value => value - 1); setErrors({}); }}>Back</button>}{step < template.steps.length - 1 ? <button className="df-primary" disabled={busy} onClick={advance}>Next</button> : <button className="df-primary" disabled={busy || preview || !section} onClick={() => void submit()}>{busy ? 'Submitting…' : preview ? 'Preview only' : editing ? 'Update response' : 'Submit'}</button>}</div><div className="df-progress"><progress aria-label="Form progress" value={step + 1} max={template.steps.length || 1} /><span>Page {step + 1} of {template.steps.length}</span></div><button className="df-text-button" disabled={busy} onClick={() => { if (window.confirm('Clear all answers in this form?')) { setValues({}); setDirty(true); setErrors({}); setStep(0); } }}>Clear form</button></footer>
      <p className="df-footnote">PastorPro · {preview ? 'Form preview' : 'Your response is saved when you submit.'}</p>
    </>}
  </div></div>;
}

import { useRef, useState } from 'react';
import { BORANG_B_SECTIONS, BORANG_B_TEXT_FIELDS, type BorangBForm } from '../lib/borangB';
import { formatCurrencyRM } from '../lib/exportUtils';

interface Props {
  value: BorangBForm;
  onChange: (field: keyof BorangBForm, value: string | number) => void;
  disabled: boolean;
  saving: boolean;
  status: 'draft' | 'submitted';
  errorMessage?: string;
  onReload?: () => void;
  onSave: () => void;
  onSubmit: () => void;
}

const sectionTitles = [...BORANG_B_SECTIONS.map(section => section.title), 'Additional Information', 'Review your report'];

/** Form presentation only: storage, autosave and conflict handling stay in BorangBPage. */
export function BorangBFormView({ value, onChange, disabled, saving, status, errorMessage, onReload, onSave, onSubmit }: Props) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const review = step === sectionTitles.length - 1;
  const section = BORANG_B_SECTIONS[step];
  const navigate = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  return <div className="bb-form-flow">
    <div className="df-card bb-section-picker no-print">
      <label htmlFor="borang-b-section">Go to section</label>
      <select id="borang-b-section" value={step} onChange={event => navigate(Number(event.target.value))}>
        {sectionTitles.map((title, index) => <option key={title} value={index}>{title}</option>)}
      </select>
      <div className="df-progress"><progress aria-label="Report section progress" value={step + 1} max={sectionTitles.length} /><span>Section {step + 1} of {sectionTitles.length}</span></div>
    </div>
    <section className="df-section-heading" aria-labelledby="borang-b-section-title">
      <span>{review ? 'Check your entries before submitting' : 'Monthly ministry report'}</span>
      <h3 id="borang-b-section-title" ref={heading} tabIndex={-1}>{sectionTitles[step]}</h3>
      <p>{review ? 'Review all sections below. Use “Go to section” to make a correction.' : section ? 'Enter this month’s totals. Use 0 when there is nothing to report.' : 'Add any activities, challenges or remarks you would like to include. These questions are optional.'}</p>
    </section>
    {review ? <div className="bb-review">
      {BORANG_B_SECTIONS.map(item => <section key={item.title} className="df-card">
        <h4>{item.title}</h4>
        <dl>{item.fields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{field === 'tithe' || field === 'offerings' ? formatCurrencyRM(value[field]) : value[field]}</dd></div>)}</dl>
      </section>)}
      <section className="df-card"><h4>Additional Information</h4><dl>{BORANG_B_TEXT_FIELDS.map(([field, label]) => <div key={field} className="bb-review-text"><dt>{label}</dt><dd>{value[field] || 'No additional information'}</dd></div>)}</dl></section>
    </div> : <fieldset disabled={disabled} aria-label={sectionTitles[step]} className="bb-questions disabled:opacity-60">
      {section ? section.fields.map(([field, label]) => <div key={field} className="df-card df-question">
        <label htmlFor={`borang-b-${field}`} className="df-question-title">{label}</label>
        <div className="df-answer-line">
          {(field === 'tithe' || field === 'offerings') && <span aria-hidden="true">RM</span>}
          <input id={`borang-b-${field}`} type="number" min={0} step={field === 'tithe' || field === 'offerings' ? '0.01' : '1'} inputMode={field === 'tithe' || field === 'offerings' ? 'decimal' : 'numeric'} value={value[field]} onChange={event => onChange(field, Math.max(0, Number(event.target.value) || 0))} />
        </div>
      </div>) : BORANG_B_TEXT_FIELDS.map(([field, label]) => <div key={field} className="df-card df-question">
        <label htmlFor={`borang-b-${field}`} className="df-question-title">{label}</label>
        <textarea id={`borang-b-${field}`} rows={4} maxLength={10000} value={value[field]} placeholder="Your answer" onChange={event => onChange(field, event.target.value)} />
      </div>)}
    </fieldset>}
    {review && errorMessage && <div role="alert" className="df-card df-error">{errorMessage}{onReload && <button type="button" className="df-text-button" disabled={saving} onClick={onReload}>Reload Report</button>}</div>}
    <div className="df-form-footer no-print">
      <div>{step > 0 && <button type="button" className="df-secondary" onClick={() => navigate(step - 1)}>Back</button>}
        {review ? <button type="button" className="df-primary" disabled={disabled} onClick={onSubmit}>{saving ? 'Saving…' : status === 'submitted' ? 'Update Submission' : 'Submit Report'}</button>
          : <button type="button" className="df-primary" onClick={() => navigate(step + 1)}>{step === sectionTitles.length - 2 ? 'Review report' : 'Next'}</button>}
      </div>
      <button type="button" className="df-text-button" disabled={disabled} onClick={onSave}>Save Draft / Changes</button>
    </div>
    <p className="df-footnote">Changes are saved automatically when connected. Review all sections before submitting.</p>
  </div>;
}

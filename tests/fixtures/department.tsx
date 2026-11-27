import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { DepartmentForm } from '../../src/components/department/DepartmentForm';
import { DepartmentTemplateEditor } from '../../src/components/department/DepartmentTemplateEditor';
import type { DepartmentTemplate } from '../../src/lib/departmentReports';
const template: DepartmentTemplate = { id: 'demo', key: 'demo', name: 'Quarterly Ministry Response', description: 'A focused form for your church’s quarterly report.', isActive: true, order: 0, steps: [
  { id: 'details', title: 'Church activities', fields: [
    { id: 'name', label: 'Report prepared by', type: 'text', required: true, helpText: 'Enter your full name.' },
    { id: 'count', label: 'Meetings held', type: 'number', required: true },
    { id: 'choice', label: 'Ministry focus', type: 'dropdown', required: true, options: ['Outreach', 'Discipleship'] },
    { id: 'check', label: 'Reviewed by the church', type: 'checkbox', required: false },
  ] },
  { id: 'giving', title: 'Quarterly giving', fields: [{ id: 'amount', label: 'Special offering', type: 'currency', required: true, prefix: 'RM' }, { id: 'months', label: 'Monthly activity', type: 'repeatingGroup', required: true, repeatCount: 2, repeatLabels: ['October', 'November'], subFields: [{ id: 'visits', label: 'Visitations', type: 'number', required: true }] }] },
] };
function Fixture() {
  const [mode, setMode] = useState('home'), [output, setOutput] = useState(''), [fail, setFail] = useState(false);
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: 12 }}>
    {mode === 'home' ? <div className="department-forms"><h1>Department form workspace</h1><div className="df-template-actions"><button className="df-primary" onClick={() => setMode('form')}>Open sample form</button><button className="df-secondary" onClick={() => setMode('builder')}>Open builder</button><label><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />Simulate save failure</label></div></div> : mode === 'form' ? <DepartmentForm template={template} context="Sample Church · Kiulu · Q4 2026" onClose={() => setMode('home')} onSubmit={async values => { if (fail) throw new Error('Save denied for this sample account.'); setOutput(JSON.stringify(values)); }} /> : <DepartmentTemplateEditor initial={template} onClose={() => setMode('home')} onSave={async value => { setOutput(JSON.stringify(value)); }} />}
    <output aria-label="Saved form data">{output}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

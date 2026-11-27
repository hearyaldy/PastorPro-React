import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { BorangBFormView } from '../../src/components/BorangBFormView';
import { emptyBorangB } from '../../src/lib/borangB';
import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext';

function Fixture() {
  const [form, setForm] = useState(emptyBorangB);
  const [blocked, setBlocked] = useState(false);
  const [fail, setFail] = useState(false);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const { toggleTheme } = useTheme();
  const save = (status: string) => {
    if (fail) { setError('Save failed. Your answers are kept.'); return; }
    setError(''); setSaved(JSON.stringify({ ...form, status }));
  };
  return <main>
    <div className="flex flex-wrap gap-4 p-4"><label><input type="checkbox" checked={blocked} onChange={event => setBlocked(event.target.checked)} />Simulate conflict</label><label><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />Simulate save failure</label><button onClick={toggleTheme}>Toggle dark mode</button></div>
    <div className="department-forms borang-b-forms"><div className="df-form-column">
      <header className="df-card df-title"><p className="df-eyebrow">Monthly reporting</p><h2>Borang B Monthly Report</h2><p>Sample Mission · Pastor Sample · Kiulu · November 2026</p></header>
      <BorangBFormView value={form} onChange={(field, value) => setForm(previous => ({ ...previous, [field]: value }))} disabled={blocked} saving={false} status="draft" errorMessage={error} onSave={() => save('draft')} onSubmit={() => save('submitted')} />
      <output aria-label="Saved report" style={{ overflowWrap: 'anywhere' }}>{saved}</output>
    </div></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<ThemeProvider><Fixture /></ThemeProvider>);

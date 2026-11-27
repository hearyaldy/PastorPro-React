import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AccountDeletionPanel } from '../../src/components/AccountDeletionPanel';
import '../../src/index.css';
function Fixture() {
  const [accepted, setAccepted] = useState(false), [fail, setFail] = useState(true);
  return <main className="max-w-2xl mx-auto p-5"><label className="block mb-4"><input type="checkbox" checked={fail} onChange={event => setFail(event.target.checked)} />Simulate unavailable service</label>{accepted ? <div role="status"><h1>Deletion request accepted for processing</h1></div> : <AccountDeletionPanel email="sample@example.com" providers={['password', 'google.com']} onRequest={async () => { if (fail) throw Object.assign(new Error('Not available'), { code: 'functions/not-found' }); setAccepted(true); }} />}</main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

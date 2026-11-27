import { useEffect } from 'react';
export function useUnsavedChanges(dirty: boolean, busy = false) {
  useEffect(() => {
    const navigate = (event: Event) => { if (busy || (dirty && !window.confirm('Discard unsaved changes?'))) event.preventDefault(); };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('pastorpro:before-navigate', navigate); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('pastorpro:before-navigate', navigate); window.removeEventListener('beforeunload', unload); };
  }, [dirty, busy]);
}

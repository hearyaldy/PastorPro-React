import { Home } from 'lucide-react';

export const LANDING_PAGE_URL = 'https://hearyaldy.github.io/PastorPro-React/';

/** A normal same-tab link keeps the browser's unsaved-work protection active. */
export function LandingHomeLink() {
  return <a
    href={LANDING_PAGE_URL}
    aria-label="Home — PastorPro landing page"
    title="Go to the PastorPro landing page"
    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
  >
    <Home className="h-4 w-4" aria-hidden="true" />
    <span>Home</span>
  </a>;
}

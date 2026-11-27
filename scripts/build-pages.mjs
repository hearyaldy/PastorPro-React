import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// GitHub Pages serves the standalone landing page at root and the app under app/.
execFileSync('npm', ['run', 'build', '--', '--base=/PastorPro-React/app/'], { stdio: 'inherit' });
rmSync('dist-pages', { recursive: true, force: true });
mkdirSync('dist-pages', { recursive: true });
for (const name of ['index.html', 'styles.css', 'script.js', 'config.js', 'mark.svg', '.nojekyll', 'README.md']) {
  cpSync(`landing/${name}`, `dist-pages/${name}`);
}
cpSync('dist', 'dist-pages/app', { recursive: true });
// Pages has no SPA rewrite support. Public pages need actual index documents.
for (const page of ['privacy-policy', 'account-deletion']) {
  mkdirSync(`dist-pages/app/${page}`, { recursive: true });
  cpSync('dist/index.html', `dist-pages/app/${page}/index.html`);
}
writeFileSync('dist-pages/.nojekyll', '');
console.log('GitHub Pages artifact ready in dist-pages/.');

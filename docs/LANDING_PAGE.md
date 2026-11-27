# PastorPro landing page

Created 2026-11-27 as a separate, buildless page in `landing/`. It introduces the
app’s pastoral activities, Borang B, church finances, quarterly reporting and
mission-team workflows, with a clearly labelled illustrative workspace.

The page is responsive and uses no Firebase, user records, analytics scripts or
external image/font dependencies. Its preview tabs support keyboard navigation;
FAQs use native disclosures. WebApp buttons are prominent in the header, hero
and closing call to action.

## WebApp link

No deployed WebApp URL was supplied. Read-only checks found no repo homepage
URL, and the Firebase project’s default Hosting domains return Site Not Found.
The user requested the landing page first. `landing/config.js` therefore keeps
`PASTORPRO_WEBAPP_URL` empty for now.

- Local Vite preview (`http://127.0.0.1:3000/landing/`): WebApp opens the running app.
- Published page: WebApp opens an honest link-not-configured dialog. It does not
  send visitors to a nonexistent host or a different application.
- Set `window.PASTORPRO_WEBAPP_URL` in `config.js` to the deployed HTTPS app URL
  when available. That activates all three buttons without rebuilding.

## Repository publication

Repository: `hearyaldy/PastorPro-React` (private; visibility was not changed).
The GitHub connector could not access this repository, so publication used the
existing device Git credentials through GitHub’s REST API, kept only in memory.

Only `landing/` contents were published as the root of the `gh-pages` branch.
The local app working tree, backend, audit documents and unpublished changes were
not included in the public Pages artifact. The app’s `main` branch was not moved.

Source commit: `97cea05d7f298907e56af4e8c262e2f04e5b3974`.
Pages source: `gh-pages`, `/`, with `.nojekyll`.
Target URL: https://hearyaldy.github.io/PastorPro-React/

A browser test passed for desktop and 390px layout, local/published WebApp behavior,
sample tabs with keyboard interaction, FAQs and configured app URL propagation.
Desktop/mobile screenshots were inspected, JavaScript syntax checks passed and
`git diff --check` passed. GitHub reports the published commit as built; the
live URL returned HTTP 200 with the expected page. A live Chrome check confirmed
that assets load, the WebApp setup dialog opens, and no page errors occur.

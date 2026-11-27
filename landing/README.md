# PastorPro landing page

A standalone, buildless landing page for the PastorPro app. It does not load
Firebase or read account data. The preview uses explicitly labelled sample data.

- `index.html`: app information and illustrative workspace tabs.
- `styles.css`: responsive presentation.
- `script.js`: accessible tabs, privacy disclosure and WebApp launch behavior.
- `config.js`: set `window.PASTORPRO_WEBAPP_URL` to the deployed HTTPS app URL.

Live WebApp: https://pastor-report-e4c52.web.app/ . All WebApp buttons use this URL.

Local preview: start the existing Vite server and visit `/landing/`. With no live
URL configured, WebApp opens that local app. On a published host, it opens an
honest setup message until the URL is configured, rather than linking to a fake
or nonexistent deployment. Entering the real URL in `config.js` activates every
WebApp button without rebuilding.

For GitHub Pages, publish the contents of this folder as the root of `gh-pages`
with `.nojekyll`. This intentionally excludes the private app source, data, backend
functions and repository working documents from the published site.

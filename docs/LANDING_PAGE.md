# PastorPro landing page

Created 2026-11-27 as a separate, buildless page in `landing/`. It introduces the
app’s pastoral activities, Borang B, church finances, quarterly reporting and
mission-team workflows, with a clearly labelled illustrative workspace.

The page is responsive and uses no Firebase, user records, analytics scripts or
external image/font dependencies. Its preview tabs support keyboard navigation;
FAQs use native disclosures. WebApp buttons are prominent in the header, hero
and closing call to action.

## WebApp link

The React WebApp is deployed to https://pastor-report-e4c52.web.app/ .
`landing/config.js` connects all three WebApp buttons to this URL, including
when previewing the landing page locally.
All three anchors also contain the live URL directly, so the WebApp link works
without JavaScript. Configuration/script URLs are versioned to refresh older
browser caches after the initial unconfigured landing release.

- If the configured URL is removed, localhost falls back to the local app;
  published hosts display the link-not-configured dialog.
- Deploy the app with `npm run build` followed by
  `firebase deploy --only hosting --config firebase.hosting.json --project pastor-report-e4c52`.
  This separate config publishes `dist/` with SPA rewrites; it does not deploy
  Firestore rules or account-deletion functions.
- Firebase Hosting release: `779bc49bf68e9972` (2026-11-27).

Live Chrome verification passed: the published landing button opens the app's
sign-in screen, Home returns to the landing page, and `/privacy-policy` and
`/account-deletion` render over HTTPS with HTTP 200 and no page errors. Firebase
Auth's public configuration includes the Hosting domain. Signed-in report
workflows were not exercised with a real user account.

## Repository publication

Repository: `hearyaldy/PastorPro-React` (private; visibility was not changed).
The GitHub connector could not access this repository, so publication used the
existing device Git credentials through GitHub’s REST API, kept only in memory.

Only `landing/` contents were published as the root of the `gh-pages` branch.
The local app working tree, backend, audit documents and unpublished changes were
not included in the public Pages artifact. The app’s `main` branch was not moved.

Source commit: `97cea05d7f298907e56af4e8c262e2f04e5b3974`.
WebApp link update: `e12dee0607d694edf4d0c6570607b01805c40eb1`.
Pages source: `gh-pages`, `/`, with `.nojekyll`.
Target URL: https://hearyaldy.github.io/PastorPro-React/

A browser test passed for desktop and 390px layout, local/published WebApp behavior,
sample tabs with keyboard interaction, FAQs and configured app URL propagation.
Desktop/mobile screenshots were inspected, JavaScript syntax checks passed and
`git diff --check` passed. GitHub reports the published commit as built; the
live URL returned HTTP 200 with the expected page. A live Chrome check confirmed
that assets load, the WebApp setup dialog opens, and no page errors occur.

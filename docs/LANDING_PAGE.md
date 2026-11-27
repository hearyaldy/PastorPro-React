# PastorPro website hosting

The landing page and React WebApp are hosted together on GitHub Pages in
`hearyaldy/PastorPro-React`. The repository stays private; the generated website
is public. No Firebase Hosting access is needed to publish updates.

- Landing page: https://hearyaldy.github.io/PastorPro-React/
- WebApp: https://hearyaldy.github.io/PastorPro-React/app/
- Privacy: https://hearyaldy.github.io/PastorPro-React/app/privacy-policy/
- Account deletion: https://hearyaldy.github.io/PastorPro-React/app/account-deletion/

## Build and publish

Run `npm ci` after checking out the repository, then:

```sh
npm run test:pages
npm run deploy:pages
```

`build:pages` builds React with base `/PastorPro-React/app/`, combines the build
with the standalone `landing/` files in ignored `dist-pages/`, and emits physical
index documents for the public privacy/deletion routes. Internal app navigation
uses component state, so it needs no server SPA rewrites. Public links use Vite's
base path and remain valid in local development and on subpath hosts.

`publish-pages.mjs` clones the current `gh-pages` branch into a temporary directory,
replaces its generated app and landing files, commits and pushes with ordinary
Git credentials, then removes the temporary checkout. It preserves unrelated
published files and uses a normal push, so concurrent changes are not overwritten.
Pages must use `gh-pages`, `/`, with `.nojekyll`. It may take a short time for the
Pages build and CDN to show the new commit. Main-branch pushes alone do not deploy;
run the publish command when a new web version is ready.

All three WebApp buttons contain the direct GitHub Pages app URL and also support
an override in `landing/config.js`. Scripts use versioned URLs so browsers refresh
the configuration from the previous Firebase-hosted release. The landing page is
buildless and does not load Firebase or user data. Its sample workspace is labelled
illustrative. Only generated web artifacts are published; source documents,
Firebase credentials, backend code and local environment files are excluded.

## Authentication and backend

Firebase project `pastor-report-e4c52` continues to supply Auth and Firestore.
The host `hearyaldy.github.io` was added to its authorized sign-in domains and
verified by read-back while preserving existing domains. Account deletion still
requires the separate, pending functions/rules deployment described in
`PRIVACY_ACCOUNT_DELETION.md`. Web hosting does not deploy those services.
Signing in on the new origin requires signing in again; browser-local storage,
caches and downloaded files from the old origin do not migrate automatically.

## Validation

`test:pages` serves the generated artifact under the actual repository prefix
and checks the sign-in screen, nested privacy/deletion pages and refreshes, WebApp
links, asset requests, mobile overflow and browser errors. It can also target a
published host with `PAGES_TEST_ORIGIN=https://hearyaldy.github.io` when running
`node --import tsx --test tests/pagesHosting.browser.ts`.

Migration published as Pages commits `3645a5f` (app) and `0298882` (instructions).
Deployment job `46025193837` succeeded. Live Chrome passed app/asset loading,
landing-to-app and Home navigation, direct privacy/deletion links and refreshes,
mobile layout, and no page errors. TypeScript and all 37 unit tests also passed.
Signed-in workflows still require verification with the user's own account.

## Earlier publication

The standalone landing page was first published to `gh-pages` at
`97cea05d7f298907e56af4e8c262e2f04e5b3974`. The React app was initially deployed
to Firebase Hosting release `779bc49bf68e9972`, but the user could not manage that
hosting and explicitly requested migration to GitHub Pages. The prior Hosting
configuration is retained as historical setup; current app links use GitHub Pages.
The earlier Firebase Hosting copy has not been disabled by this migration.

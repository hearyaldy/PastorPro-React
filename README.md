# PastorPro landing page

Buildless app information and illustrative workspace, hosted on GitHub Pages:
https://hearyaldy.github.io/PastorPro-React/

All WebApp buttons open https://hearyaldy.github.io/PastorPro-React/app/ directly.
`config.js` can override the target. The landing page does not load Firebase or
read user records. Its sample content is explicitly illustrative.

From the main repository, run `npm run test:pages` to check the combined site and
`npm run deploy:pages` to build and publish it to `gh-pages`. Do not publish this
folder alone: doing so would omit the app. See `docs/LANDING_PAGE.md` in main for
hosting and Firebase Auth setup. Account deletion backend deployment is separate.

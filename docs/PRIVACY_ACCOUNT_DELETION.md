# Privacy policy and account deletion

Implemented locally on 2026-11-27. No production account was deleted and no backend
or permission deployment has been performed.

## User decisions

- Keep submitted church reports, with structured account attribution removed.
- Delete the account profile and personal cloud workspace data.
- Operator name and privacy email will be provided later. Until then, the policy
  directs users to their mission administrator. Optional public build settings
  are `VITE_PRIVACY_OPERATOR` and `VITE_PRIVACY_EMAIL`; no invented contact appears.

## Pages and confirmation

- `/privacy-policy`: public page, available before sign-in.
- `/account-deletion`: public instructions, sign-in and account ownership check.
- Settings and the sign-in footer link to both pages. Pending/deactivated accounts
  also have a path to the deletion page; submission does not require a ministry role.
- The user reviews retained/deleted data, selects a confirmation checkbox, types
  DELETE and reauthenticates with Google or their existing email/password provider.
- The callable accepts only the authenticated UID and verifies auth_time within
  five minutes. Client-supplied target UIDs are ignored. Passwords remain in the
  reauthentication input/SDK, not application records or logs.
- The response confirms that a request was accepted, then signs the browser out.
  It does not claim background processing already completed. Missing-service,
  credential and ambiguous-network failures have different messages.

## Server implementation

`functions/index.js` exports two second-generation functions in `asia-southeast1`:
`requestAccountDeletion` and `processAccountDeletion`. Runtime: Node 22.
`ACCOUNT_DATABASE_ID` defaults to `(default)`, matching this repository’s config.

The callable atomically creates a server-only `account_deletion_jobs/{uid}` marker
and closes the profile’s active/approved flags. A retried Firestore create trigger:

1. Acquires a lease, disables the Auth user and revokes refresh tokens.
2. Recursively removes UID-owned personal records in activities, appointments,
   todos, personal events, ministry teams, notes, notifications, devices and
   location requests; unknown profile subcollections are removed with the profile.
3. Scans shared reports, FAM records, administrative metadata, hierarchy, template
   creators and nested mission departments/reports. It replaces matching UID/name
   attribution, including history entries, while preserving unrelated authors,
   amounts, statistics, report answers and free-text content. Matching staff email
   entries are de-identified and made inactive. Known UID-bearing Borang B IDs
   are replaced with opaque document IDs to retain the report without that UID.
4. Uses collection checkpoints and write-time preconditions to retry safely
   rather than overwrite concurrent edits. Duplicate trigger deliveries are leased.
5. Deletes the Firebase Auth account, recursively deletes the profile and marks
   the restricted job complete. The random attribution replacement is removed
   from the job on completion; the minimal marker remains to block old tokens.

The worker does not rewrite free text to guess which names belong to the deleted
person. The policy explicitly says retained report content may need separate
administrator review. Browser caches, exported files, printed copies and files
stored locally by Flutter (including its local profile photo) cannot be remotely
wiped by this web feature; the pages instruct users to clear shared-device data.

## Rules and deployment scope

The root local rule candidate gains an account-deletion guard in `isSignedIn`.
Do **not** deploy the broad root candidate as part of this feature.

A separate, minimal candidate in `firebase/account-deletion/firestore.rules` is
based on the read-only verified live release updated at
`2026-11-27T13:56:18.407929Z`. Its only difference is adding a deletion-job existence
check to `isAuthenticated`. Existing Union, template, report and other collection
permissions are preserved. SHA-256 baseline/candidate hashes are recorded in
`firebase/account-deletion/baseline.json`. Jobs remain inaccessible to clients.

Before deployment, reread the live release and compare its hash with the recorded
baseline. If it changed, rebase the one-line guard on the new live rules and rerun
its tests. Deploy the guard before enabling the deletion backend so stale sessions
cannot recreate records during cleanup. Never remove deletion markers or undo
the guard while old sessions may still be valid.

After explicit production approval, the intended commands are:

```sh
firebase deploy --project pastor-report-e4c52 --config firebase.account-guard.json --only firestore:rules
firebase deploy --project pastor-report-e4c52 --config firebase.account-services.json --only functions:account-services
```

These commands are documented, not executed. They need the project’s Functions/
Eventarc service permissions and supported billing configuration. The functions’
service account needs Firestore data access and Firebase Auth user administration.
Review the generated deployment IAM changes before proceeding. The UI’s function
region must match `VITE_ACCOUNT_FUNCTIONS_REGION` (default `asia-southeast1`).

The web host must serve the app for `/privacy-policy` and `/account-deletion`
(SPA fallback). Adding source files does not publish a web host deployment.

## Verification

- 37 React unit tests, 2 server unit tests and 38 root rules/storage tests passed.
- 3 tests against the minimal production-rule candidate passed: ordinary access
  remains; queued users cannot read/write/recreate private records; clients cannot
  forge deletion jobs; candidate differs only by its authentication guard.
- 2 Auth/Firestore/Functions emulator tests passed with invented accounts. They
  exercise the callable and background event, nested data cleanup, retained church
  records, history/department/staff attribution, and protection of another account.
- 6 Chrome tests passed, including public routes, required confirmation, password
  selection, truthful unavailable-service errors and a mocked accepted receipt.
- TypeScript, production build and whitespace checks passed. Local emulator uses
  host Node 25 with a warning; deployment runtime is explicitly Node 22.

Reproduce with `npm test`, `npm --prefix functions test`, `npm run test:rules`,
`npm run test:account-guard`, `npm run test:account-services`, and
`npm run test:browser`. Backend dependencies use `functions/package-lock.json`.

Firebase guidance: [reauthentication and deletion](https://firebase.google.com/docs/auth/web/manage-users),
[callable authentication](https://firebase.google.com/docs/functions/callable).

## Pending

- Production approval/deployment and read-back verification of the minimal guard.
- Real sign-in popup/password checks and a user-authorized production deletion.
- Operator/contact details, organizational retention periods and their policy review.
- Flutter-specific local-file cleanup remains a companion-app follow-up.

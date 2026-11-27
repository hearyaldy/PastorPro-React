# React and Flutter synchronization fix plan

Created: 2026-11-27 (Asia/Bangkok)
Last updated: 2026-11-27 (Asia/Bangkok)

## Objective and decisions

Make PastorPro React and the existing Flutter application safely read and write
the same Firebase data. Both configurations point to `pastor-report-e4c52` and
the default Firestore database.

React: this repository. Flutter: `../pastor_report-latest`.

Use the existing Flutter data format as the initial compatibility baseline,
preserve existing records, and confirm the contract against representative
stored records before implementation. Matching screens alone is insufficient.
Production migration and deployment follow demonstrated compatibility and
require appropriate authorization.

## Progress overview

| Phase | Status | Completion requirement |
| --- | --- | --- |
| 1. Establish the baseline | In progress | Agreed data contract covering existing records and both apps |
| 2. Restore reliable builds | Complete | Both projects install and build reproducibly |
| 3. Fix authorization | In progress | Emulator tests reject escalation, inactive access, and unauthorized cross-mission access |
| 4. Align React data layer | In progress | Both apps interpret the same records and use consistent document IDs |
| 5. Complete remaining sync gaps | In progress | Every feature intended to sync uses compatible cloud storage |
| 6. Handle existing data | Pending | Existing records remain readable without duplicate reports or lost fields |
| 7. Validate and release | Pending | End-to-end checks pass and coordinated release is reviewable |

Build setup is verified for React and Flutter web. Security and activity
compatibility changes are tested locally; the complete synchronization plan is
not finished. Production data inspection, full report compatibility, migration,
and release remain pending. See `SYNC_DATA_CONTRACT.md` for implemented and
pending schemas.

## Phase 1 Establish the baseline

Source-based contract recorded in `SYNC_DATA_CONTRACT.md` for users, activities,
Borang B, financial/FAM, and quarterly reports. Remaining collection inventory
and actual stored-record verification are still needed. Conflict policy:
financial and submitted reports must reject stale revisions in a transaction;
implementation remains pending.

- [x] Preserve and account for Flutter's existing uncommitted changes.
- [ ] Document collection paths, field names and types, timestamps, document IDs,
      report statuses, role encodings, and permissions in both applications.
- [ ] Inspect representative existing Firestore records using authorized access.
- [ ] Agree on the shared contract, compatibility behavior, and supported fields.
- [ ] Choose concurrent-edit behavior; detect conflicts for financial and
      submitted reports instead of silently overwriting changes.

## Phase 2 Restore reliable builds

- [x] Resolve React's Vite/esbuild dependency conflict.
- [x] Verify a reproducible dependency install using the intended package manager
      and lockfile.
- [x] Run React TypeScript checks and production build.
- [x] Correct Flutter's Dart SDK constraint and verify dependency resolution.
- [x] Run Flutter static checks and appropriate target builds; record outstanding
      warnings separately from build failures.

## Phase 3 Fix authorization

Completed local changes:

- [x] Make `userRole` authoritative; remove display/flag and failed-read admin bypasses.
- [x] Enforce mission scope for report reads, shared resources/events, users,
      location requests, and audit logs; add matching React queries.
- [x] Deny protected personal/report access to unverified, pending, rejected,
      inactive, and Flutter `isApproved: false` accounts.
- [x] Prevent mission admins assigning global roles or moving users across missions,
      and prevent assigned leaders changing their own access scope.
- [x] Validate 21 security/compatibility emulator tests, including a permitted
      mission-admin update and legacy Flutter profile edits.
- [x] Add index definitions for new mission-scoped audit and request queries.

The remaining broad items below include full Flutter registration/admin-service
reconciliation, the rest of the protected collection audit, legacy mission alias
backfill, deployment-index inventory, and compatible report validators. The
React rules have not been deployed or copied over Flutter's modified rules.

- [x] Close privilege escalation through the alternate `role` field and test
      profile creation, role assignment, and profile updates.
- [x] Choose one authoritative role representation and compatibility handling
      for existing values.
- [ ] Enforce mission boundaries on protected reads and writes.
- [ ] Enforce account approval and activation in backend rules for both clients.
- [ ] Align user mission, region, district, and church assignments.
- [ ] Align Firestore queries and required indexes with those permissions.
- [ ] Ensure rules accept the agreed schemas from both apps.
- [x] Run Firebase emulator tests for ownership, role escalation, inactive and
      pending users, and unauthorized cross-mission access.

Do not deploy the current React rules to the shared backend as a compatibility fix.

## Phase 4 Align React data layer

Completed local work:

- [x] Add `userProfiles.ts` and `queryScope.ts`; write Flutter role names and
      synchronized mission/district/region aliases from React admin updates.
- [x] Respect both `approvalStatus` and Flutter's new `isApproved` field, and
      synchronize both representations when React admins change access.
- [x] Add `activities.ts` readers/writers and wire the activity page, dashboard,
      and ministry activity lists to them.
- [x] Read and preserve Flutter activity description, mileage, notes, calendar
      day, and actual document identity; prefer later Flutter edits over stale aliases.
- [x] Add mileage entry, display, and export to React; preserve unedited fields
      through partial updates.
- [x] Pass eight unit tests plus the emulator activity edit/ownership test.

Mileage entry, reimbursement calculations, monthly totals, exports, and A4
preview/printing are now implemented in React with Flutter's default local rate
of RM 0.50/km. Each client still keeps its rate locally, matching Flutter's
existing behavior. Real app-to-app and offline validation remain pending.

Introduce explicit Firestore readers and writers; keep conversions outside page
components. Preserve fields that React does not edit. Implement in this order:

- [ ] Users, role normalization, and church assignments.
- [x] Activities: support Flutter's `activities`, `mileage`, and `note`, including
      mileage calculations and compatible date handling.
- [x] Borang B: align date representation, field names, membership statistics,
      other existing statistics, and document identifiers.
- [ ] Financial reports: align timestamp months, offering fields, report statuses,
      receipt/custom finance fields, and edit-history structure.
- [ ] FAM: align named income and expense fields, report linkage, and totals.
- [ ] Quarterly reports: align department identifiers, document IDs, nested
      fields, and age groups; define how React's additional departments coexist.
- [ ] Verify bidirectional reading and writing for each module using fixtures
      representing both clients and legacy records.

## Phase 5 Complete remaining sync gaps

- [ ] Compare and align appointments and tasks.
- [ ] Compare and align local and global events.
- [ ] Compare and align resources and departments.
- [ ] Compare and align unions, missions, regions, districts, churches, and staff.
- [ ] Move Flutter ministry-team storage from local preferences into compatible
      Firestore storage, with a one-time import preserving existing local data.
- [x] Explicitly document current device-local settings (appearance and Flutter mileage rate).

## Phase 6 Handle existing data

- [ ] Inventory mixed-format records and potential duplicate report IDs.
- [ ] Prefer compatibility readers where migration is unnecessary.
- [ ] Where migration is necessary, prepare a repeatable migration, backup,
      dry-run output, and rollback steps.
- [ ] Verify preservation of unknown fields and existing financial/report totals.
- [ ] Verify deterministic IDs prevent duplicate monthly and quarterly reports.
- [ ] Obtain appropriate authorization before executing production migrations.

## Phase 7 Validate and release

- [ ] Create in Flutter, then view and edit in React.
- [ ] Create in React, then view and edit in Flutter.
- [ ] Verify supported delete operations and permissions in both directions.
- [ ] Compare totals, dates, statuses, ownership, and document IDs.
- [ ] Verify access restrictions for every supported role and mission scope.
- [ ] Test offline edits, reconnection, simultaneous edits, and conflict handling.
- [ ] Prepare coordinated app, security-rule, and index releases plus rollback.
- [ ] Obtain deployment authorization and record actual release verification.

## Initial review evidence

Reviewed on 2026-11-27:

- React tracked working tree was clean at `560c17e`; Flutter's latest inspected
  commit was `9f6bdd4` and its working tree contained modified and untracked work,
  including quarterly reporting. Recheck status before changes.
- Both app configurations reference Firebase project `pastor-report-e4c52`.
  Deployed rules and actual stored records have not been verified.
- React security rules trust `role` in `isSuperAdmin()` while profile creation
  restricts `userRole` without restricting the alternate `role` consistently.
- Financial and Borang B read rules allow mission leadership without comparing
  the record's mission to the caller's mission.
- Shared collections contain incompatible client schemas: activities, Borang B,
  financial reports, FAM, and quarterly department reports.
- React `npm install --ignore-scripts --no-package-lock --no-audit --no-fund`
  failed with ERESOLVE: the resolved Vite 8.4.0 expected optional peer esbuild
  `^0.27.0 || ^0.28.0`, conflicting with the root `^0.25.0` dependency.
  React build and TypeScript checks were not completed.
- Flutter `dart analyze lib test` using its existing cached dependencies reported
  0 errors, 42 warnings, and 686 informational findings (728 total).
  The installed Dart SDK was 3.11.0, while `pubspec.yaml` required
  `>=2.19.0 <3.0.0`; clean dependency resolution and builds remain unverified.
- Flutter ministry-team storage uses SharedPreferences; React uses
  `ministry_team` in Firestore.
- No application source changes, production migration, or deployment were made
  during the initial review.

## Update procedure

After each relevant fix, update its checkbox and phase status, the last-updated
date, and the change log. Include changed files, verification performed and its
result, and any remaining work. Use Pending, In progress, Complete, or Blocked
with a concrete explanation. Mark Complete only when all completion requirements
for that phase are verified. Reopen a completed phase if a regression is found.

## Change log

- 2026-11-27: Compared the current Flutter My Mission reporting dashboard with
  React's directory page. Recorded missing YTD finances, monthly reconciliation,
  district discrepancies/Excel export, ministry aggregates, reporting completion,
  contextual actions, and role-aware reporting scopes in `MY_MISSION_COMPARISON.md`.
  This is a source-review checkpoint; no feature implementation or deployment
  was performed during this comparison.
- 2026-11-27: Compared all main Flutter statistics and print layouts. Added shared
  colored statistics cards, grouped report tables, A4 PDF preview/download/print/
  share, and previews across dashboard, activities, Borang B/browser/tracker,
  finances/FAM, quarterly reports, mission/ministry, administration, and resources.
  Fixed truncated dashboard counts, Flutter completion/name aliases, monthly
  activity reimbursement, financial timestamp/offerings/custom-label reads, and
  canonical quarterly preview fields. Added full Borang B readers/writers, actual
  existing-ID lookup, conditional creation, revision-checked transaction updates,
  duplicate-month selection, visible errors, and unsaved-navigation warnings.
  Verification: 20 unit, 26 rule/storage, 5 deployed-rules compatibility, and 2
  Chrome browser tests passed; React type check and production build passed.
  No production writes or deployment were performed by these tests. See
  `STATISTICS_PRINT_PARITY.md`; finance/quarterly write synchronization remains open.

- 2026-11-27: User approved the Union-only production deployment. Detected a newer
  live rules release, preserved its Flutter approval changes, refreshed the
  rollback snapshot, and reran all 11 Union emulator tests successfully. Deployed
  only `firebase/union-hotfix/firestore.rules` at 20:12 Asia/Bangkok and verified
  an exact read-back hash match. Browser retry is pending. Details are in
  `UNION_HOTFIX.md` and `firebase/union-hotfix/deployment.json`.

- 2026-11-27: Diagnosed Add Union against the live rules using a read-only lookup:
  the deployed release has no Union collection rule. Fixed inline error/progress
  feedback and separated audit failures from the primary save. Prepared a
  Union-only rules candidate and rollback snapshot under `firebase/union-hotfix`.
  Verification: 11 unit tests, 11 Union emulator tests, type check, and React
  build passed. Deployment awaits production approval; see `UNION_HOTFIX.md`.
- 2026-11-27: Saved the user-requested seven-phase plan and initial review
  evidence. Added root `AGENTS.md` instructions to read and maintain this tracker
  during synchronization work.
- 2026-11-27: Completed build setup; added the source-based data contract,
  authorization fixes, mission-scoped React queries/index definitions, user and
  activity compatibility adapters, mileage UI/export, and local test tooling.
  Verification: 8 unit tests, 21 emulator tests, React type check/production build,
  and Flutter dependency resolution/web build passed. Remaining work is recorded
  in each phase and the verification checkpoint below.

## Verification checkpoint 2026 11 27

- React: removed the unnecessary direct esbuild pin; `npm install` succeeds
  without peer-dependency overrides. `npm ci --offline --no-audit --no-fund`
  reproduced the install. `package-lock.json` replaces the obsolete `bun.lock`;
  npm is recorded as the package manager.
- React: `npm run lint`, `npm test` (8 passed), and `npm run build` passed after
  the changes. Build still reports the existing large-bundle and Vite config
  deprecation warnings.
- Security: `npm run test:rules` passed 21 tests using the local Firestore
  emulator with demo project `demo-pastorpro-sync`. No production credentials or
  data were used by the fixtures.
- Flutter: changed only the SDK constraint directly (`>=3.9.0 <4.0.0`).
  `flutter pub get --offline` succeeded; dependency resolution also updated
  `pubspec.lock` and generated plugin registration for the working tree's
  Google sign-in dependency. `flutter build web --release --no-pub` passed.
- Flutter static analysis at this checkpoint: 0 errors, 45 warnings, 693 info
  findings (738 total). These are recorded for follow-up, not claimed resolved.
- Additional uncommitted Flutter Google sign-in, mission selection, and approval
  changes appeared during this work. They were preserved. The inspected Flutter
  approval field is `isApproved`; React's adapter and rules now handle it. Recheck
  that work before the next cross-client change because it is being edited separately.
- `git diff --check` passed. Production rules, indexes, data, and hosting were not changed.

Next implementation: finish the full user/approval write contract with Flutter,
then complete financial/FAM and quarterly write compatibility. Borang B now has
compatible readers/writers, full statistics, existing-record lookup, and stale
edit protection. Simultaneous first-time Flutter UUID/React creation still needs
a shared protocol before duplicate prevention is complete across both clients.

## Union creation checkpoint

- [x] Read live default Firestore rules without modifying Firebase and confirm
      the missing Union rule. Observed release update: 2026-06-30T09:52:58.562971Z.
- [x] Make failed Union saves visible, preserve input, and prevent duplicate
      submissions while a write is pending.
- [x] Keep failed or delayed audit writes from obscuring a successful Union save.
- [x] Prepare and emulator-test an additive Union-only rules patch against the
      deployed baseline, preserving other production collection rules.
- [x] Obtain production deployment approval, recheck the live baseline, deploy
      only the tested hotfix, and read back the released rules.
- [ ] Verify Union creation in the user's signed-in browser.

The local feedback fix and Union-only production rules deployment are complete.
Read-back verification matches the candidate exactly; signed-in browser creation
is awaiting the user retry. This checkpoint does not complete the broader
authorization or synchronization phases.

## Statistics printing and Borang B checkpoint

- [x] Compare Flutter dashboard cards, activity mileage summary and PDF, full
      Borang B form/preview/PDF, financial summary/PDF, and quarterly model fields.
- [x] Apply shared Flutter-style statistics cards and grouped read-only tables.
- [x] Add A4 preview, download, print, and device sharing controls; paginate long
      reports with repeated table headings and page-number footers.
- [x] Cover all main statistical/report views, including mission/ministry,
      administration, resource directory, and submission tracking.
- [x] Compute dashboard totals from full data streams; normalize Flutter task,
      appointment, staff, church, role, and date aliases for display.
- [x] Match activity distance/cost summaries with selected month, local RM/km
      setting, CSV/Excel exports, and PDF table totals.
- [x] Add complete canonical Borang B statistics, compatible dates/field aliases,
      actual document identity, and field-preserving writes.
- [x] Prevent overwriting stale edits and racing React creates; reject creating
      another report when an existing Flutter report is found for that month.
- [x] Exercise storage against both local root rules and the saved deployed rules
      snapshot. Inspect responsive preview screenshots and PDF downloads in Chrome.
- [ ] Reconcile financial and quarterly writers and the complete Flutter user
      approval write flow; these are not completed by print/read compatibility.
- [ ] Verify real signed-in Flutter-to-React use, offline behavior, physical
      printing/device sharing, and simultaneous first-time creation in both apps.

Details, source comparisons, and remaining limits: `STATISTICS_PRINT_PARITY.md`.

## My Mission feature parity checkpoint

- [x] Compare Flutter's rendered My Mission widgets and report data flows with
      the current React page; document existing and missing features.
- [x] Add role-aware reporting scopes, assignment handling, and reporting period.
- [x] Add monthly and YTD financial/report streams and aggregates.
- [x] Add treasurer/Borang B comparison, reporting coverage, and completion.
- [x] Add district discrepancy details, missing-church lists, filters, and exports.
- [x] Add grouped ministry totals, pastor report status, contextual actions,
      and explicit refresh behavior.

Comparison and recommended order: `MY_MISSION_COMPARISON.md`.

### My Mission implementation checkpoint — 2026-11-27

- Added mission/district/church reporting views restricted by authoritative role
  and assignments; Super Admin mission override/reset and explicit unassigned state.
- Added live financial/Borang B streams, month navigation, YTD income, separate
  monthly comparisons, reporting progress, source-coverage counts, district
  mismatch/missing-report filters, missing church details, Excel and A4 PDF.
- Added full grouped ministry measures, district pastor report status, scoped
  organization counts, explicit refresh, and period-preserving navigation.
- Added a My Mission church financial editor for canonical Flutter records:
  timestamp month, offerings, special/custom labels, receipts, notes, draft/submit,
  canonical history, existing-document lookup, conditional creation, transaction
  revision checks, approved-record lock, and preservation of unknown/FAM fields.
  Existing older React ledger records still use their existing editor. FAM
  writing and full financial-page writer replacement remain open.
- Local root rules now allow assigned district report reads (including legacy
  church-finance queries) and validate canonical main financial saves. These
  broader root rules have **not** been deployed. The existing Union deployment
  and its snapshot are unchanged.
- Tests: 25 unit, 31 root rules/storage, 3 financial storage compatibility tests
  against the saved deployed-rules snapshot, and 3 Chrome browser checks passed;
  TypeScript, production build and diff whitespace checks passed. Browser
  fixtures contain invented records and do not write to production.
- [ ] Verify My Mission with actual signed-in leadership, district pastor and
      treasurer accounts. Current production permissions may expose only partial
      financial data to directors/officers/ministerial secretaries; the UI labels
      partial, denied, loading and cached data instead of claiming full coverage.
- [ ] Coordinate any production read-permission patch separately; no broad
      permission deployment is implied by this local implementation.
- [ ] Reconcile simultaneous first saves with Flutter, which still uses an
      unconditional write; React cannot prevent the other client overwriting it.

## Hierarchy name display checkpoint — 2026-11-27

- [x] Audit assignment labels across Borang B, report browser/tracker, quarterly
      reports, financial reports, hierarchy administration, staff search,
      dashboard, My Mission, My Ministry, profile and workspace navigation.
- [x] Add shared display-only hierarchy resolution using current directory names,
      IDs and legacy name/code references. Prefer current directory names over
      stale saved labels. Distinguish missing assignments from unavailable names;
      never substitute an unresolved document ID as the display name.
- [x] Apply resolved labels to report search, detail views, CSV/Excel/JSON rows,
      PDF metadata and financial/quarterly PDF filenames. Stored assignment IDs,
      source records, authorization queries and document identity stay intact.
- [x] Verify the reported auto-ID shape, directory renames, deleted/unavailable
      assignments, aliases, non-mutating report enrichment and PDF labels.
      Validation: 28 unit tests and 3 Chrome browser tests passed, including
      checking the downloaded Borang B PDF contains the resolved district name
      and excludes the sample opaque district ID. TypeScript, production build
      and whitespace checks passed.
- [ ] Confirm name availability with the user's signed-in live account. If a
      referenced directory document is missing or inaccessible, the UI reports
      that its name is unavailable instead of guessing another assignment.

## Department report template redesign audit — 2026-11-27

- [x] Review the latest Flutter working-tree department templates, dynamic forms,
      quarterly schema, summaries, printing, providers, services and local rules.
- [x] Compare React’s current quarterly reader/writer; reproduce missing
      department, empty displayed payload and false draft status for a sample
      new-format Flutter report. Answers remain in sourceData, not rendered.
- [x] Run targeted Dart analysis: 0 errors, 0 warnings, 1 style info.
- [x] Replace React’s hardcoded department contract with template/value support,
      including admin template management, forms, summaries and PDFs.
- [ ] Reconcile legacy records and children’s department ID suffixes; preserve
      actual IDs, unknown/retired answers and historical template definitions.
- [ ] Replace unconditional overwrites, add revision safeguards and stream errors,
      and reconcile/emulator-test template and quarterly permissions.

Full audit and synchronization order: `DEPARTMENT_REPORT_COMPARISON.md`.
The previous nested children/stewardship print support does **not** cover this
new Flutter template/value contract. No Flutter or production data was modified.


## Google Forms style department workspace — 2026-11-27

- [x] Replace the fixed department form with responsive question cards, purple
      title/section headers, required validation, step progress, Next/Back/Clear,
      submission confirmation and editing of saved responses.
- [x] Add Admin/Super Admin form builder, Questions/Responses navigation, previews,
      section/question ordering, duplicate/remove, six Flutter question types,
      required/help/options/repeat settings and accepting-responses control.
- [x] Connect Admin Console, administration sidebar and reporting page to the same
      form manager. Add starter forms without replacing existing definitions.
- [x] Add template-aware responses, summaries, church coverage/missing lists,
      per-response and consolidated PDFs, and labelled-column Excel/CSV exports.
- [x] Adapt new Flutter `values` records and submitted semantics. Preserve legacy
      aliases/actual IDs, unknown/retired values, nonmatching historical age bands,
      and question snapshots on React edits. Guard stale edits and racing React
      report/template creates; show stream errors and retained-entry failures.
- [x] Prepare and test local template/quarterly rules with role/district/approval
      boundaries. No production rule deployment or data migration performed.
- [x] Validation: 34 unit, 37 root-rule/storage, 5 Flutter-local-rules compatibility
      and 5 Chrome browser tests passed; TypeScript/build/diff checks passed.
- [ ] Verify with live signed-in accounts and deployed template permissions.
- [ ] Coordinate Flutter reader/writer migration, snapshot preservation and shared
      first-create/revision protocol before marking cross-client parity complete.

Implementation, user flow and verification details: `DEPARTMENT_FORMS_UI.md`.

## General Departments directory audit — 2026-11-27

- [x] Recheck Flutter’s main Departments route and its admin management page,
      separately from the completed React quarterly form workspace.
- [x] Confirm collection/field mismatch: Flutter mission subcollections/formUrl/
      icon/color versus React top-level departments/resourceUrl. React currently
      lacks mission filtering, active-state management and Flutter card settings.
- [x] Identify Flutter add/delete ID-versus-name fallback risk and React edits
      that can reset mission ownership and reactivate inactive departments.
- [x] Review local nested rules incompatibility; no production rules changed.
- [x] Targeted Dart analysis: 0 errors, 0 warnings, 1 deprecation info.
- [ ] Reconcile directory readers/writers, source paths, admin controls and rules,
      then validate signed-in cross-client behavior. The quarterly Forms UI does
      not complete this separate directory sync task.

Detailed findings and fix order: `DEPARTMENT_DIRECTORY_COMPARISON.md`.

## Disabled Fill report follow-up — 2026-11-27

- [x] Confirm the affected action is Quarterly Depts → Fill report.
- [x] Read live Firestore rules without changes: template reads are enabled and
      quarterly scoped permissions exist (release updated 2026-11-27T13:56:18Z).
- [x] Read published template definitions only, not responses/user records:
      Children’s Ministry, Stewardship, SSPM and Women’s Ministry are active and
      pass React template validation. No production writes performed.
- [x] Fix the unexplained disabled state: use the assigned church by default
      when it belongs to the current scope; display precise account/role,
      assignment, loading, read-error and template blockers beside the button.
      Add Choose church and a one-church selection shortcut. Admin management
      response filters continue to default to all churches.
- [x] Validation: 37 unit tests, TypeScript/build and whitespace checks passed.
- [ ] User retry: refresh Quarterly Depts, select an available church if needed,
      then fill the form. The live signed-in user's exact role/selection state
      was not available to this source/read-only diagnosis.

## Privacy policy and account deletion — 2026-11-27

- [x] Record user decisions: retain submitted church reports with account
      attribution removed; delete profile/personal workspace data; add operator
      name/privacy email later.
- [x] Add public privacy/deletion pages and Settings/sign-in links, identity
      reauthentication, confirmation safeguards and truthful request/error states.
- [x] Add server-side queued cleanup with leases, retries/checkpoints, concurrent
      write protection, account disabling, private recursive deletion, retained
      report/history attribution cleanup and Auth/profile removal.
- [x] Prepare a one-line deletion guard against verified deployed rules; preserve
      all unrelated permissions and the prior Union hotfix. No production deploy.
- [x] Test: 37 React unit, 2 server unit, 38 root-rule/storage, 3 minimal-guard,
      2 Auth/Firestore/Functions emulator and 6 Chrome browser tests passed.
      TypeScript, build and whitespace checks passed; screenshots inspected.
- [ ] Obtain approval, reread live rules, deploy/read-back the minimal guard and
      two account-services functions, then verify live user-controlled deletion.
- [ ] Add operator/privacy contact and finalized organization retention details.
- [ ] Coordinate cleanup of files held locally by the companion Flutter app.

Implementation, retention boundaries and exact deployment scope:
`PRIVACY_ACCOUNT_DELETION.md`. Real accounts and production records were not changed.

## Separate app landing page — 2026-11-27

- [x] Create a standalone PastorPro landing page with app information, team roles,
      reporting flow, FAQs and prominent WebApp buttons.
- [x] Keep the app preview explicitly illustrative and independent of Firebase.
- [x] Validate responsive layout, keyboard-accessible preview tabs, privacy FAQ,
      and safe local/published WebApp-link behavior in Chrome.
- [x] Publish landing files only to `gh-pages` in `hearyaldy/PastorPro-React` at
      commit `97cea05d7f298907e56af4e8c262e2f04e5b3974`; enable GitHub Pages using
      that branch’s root. Repository visibility remains private; main is unchanged.
- [x] Verify Pages build `built` at the published commit, HTTP 200, expected
      page content/assets and live Chrome behavior with no page errors.
- [x] Deploy the React app to https://pastor-report-e4c52.web.app/ and configure
      all landing WebApp buttons with that live URL (user authorized deployment).

## WebApp hosting — 2026-11-27

- [x] Add isolated `firebase.hosting.json` for built app assets, SPA routes,
      cache behavior and response headers; ignore local Firebase deployment cache.
- [x] Build and deploy Hosting release `779bc49bf68e9972`; leave pending database
      rules and account-services function deployments unchanged.
- [x] Verify Firebase Auth authorizes `pastor-report-e4c52.web.app`.
- [x] Chrome regression test passes for configured WebApp buttons, responsive
      landing layout and unconfigured URL fallback.
- [x] Publish the WebApp link to `gh-pages`, commit
      `e12dee0607d694edf4d0c6570607b01805c40eb1`.
- [x] Verify GitHub Pages built that commit; live Chrome navigation from landing
      to app and back succeeds, privacy/deletion routes return HTTP 200 and
      render correctly, and no page errors occur.
- [ ] Verify signed-in workflows with the user's account; deployment checks
      did not sign in or modify production user/report records.
- [x] Follow-up: embed the live URL directly in all three landing anchors and
      version the configuration/scripts to refresh cached assets. Links also
      work with JavaScript disabled; keep configured-URL regression coverage.

Source and setup: `LANDING_PAGE.md`. Local preview: `/landing/`.

## WebApp return-to-home navigation — 2026-11-27

- [x] Add a shared Home link to the published PastorPro landing page in the
      signed-in workspace header and sign-in screen, visible on desktop/mobile.
- [x] Include the same Home link on privacy/account-deletion pages while retaining
      their separate WebApp links. Normal same-tab navigation keeps existing
      browser unsaved-work protection available.
- [x] TypeScript, production build and whitespace checks passed.
- [x] Verify the mobile Home link is visible without horizontal overflow and
      opens the published landing page in Chrome.

Destination: https://hearyaldy.github.io/PastorPro-React/ .


## Move WebApp hosting to GitHub Pages — 2026-11-27

User could not access Firebase Hosting and explicitly approved hosting the app
beside the landing page in their GitHub repository.

- [x] Build app under `/PastorPro-React/app/` and retain the landing page at root.
- [x] Resolve public links against Vite's base; emit actual privacy/deletion page
      documents so direct links and refreshes work without SPA server rewrites.
- [x] Point all landing buttons at the Pages app URL and refresh script versions.
- [x] Add repeatable `build:pages`, `test:pages`, and `deploy:pages` commands;
      generated app/landing files only go to `gh-pages` through normal Git auth.
- [x] Add and read back Firebase Auth authorized domain `hearyaldy.github.io`,
      preserving all existing domains. Auth/Firestore remain on the same project.
- [x] TypeScript and local artifact Chrome checks pass for assets, nested routes,
      refreshes, mobile layout and page errors.
- [x] Publish Pages app at `3645a5f`, then hosting instructions at `0298882`;
      GitHub deployment job `46025193837` succeeded. Live Chrome verifies
      landing-to-app/Home navigation, public routes and refreshes, mobile layout,
      no missing assets or page errors. All 37 unit tests and TypeScript pass.
- [ ] Verify authenticated workflows with the user's own account.

Current destinations and publication instructions: `LANDING_PAGE.md`.

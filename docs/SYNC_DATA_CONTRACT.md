# React and Flutter shared data contract

Updated: 2026-11-27 (Asia/Bangkok)

This contract follows the Flutter source at `../pastor_report-latest` and the
React source in this repository. It is the implementation baseline; production
records and deployed rules still need inspection before release.

## Common rules

- Both clients use Firebase project `pastor-report-e4c52`, default database.
- The Firestore document ID is the identity used for updates. Embedded `id`
  values in older documents must not redirect writes to another document.
- Read adapters support older shapes. Writes use Flutter-compatible canonical
  fields, merge changes, and preserve fields the current form does not own.
- Optional React fields may coexist with Flutter fields. When both are present,
  canonical Flutter fields win, including empty strings and zero values.
- Never infer an authoritative role from a display label or boolean flag.
- Missing approval/activity fields on legacy profiles mean approved/active for
  compatibility. Explicit pending, rejected, or inactive fields or Flutter `isApproved: false` deny protected
  data access, including for super administrators.
- Scope queries on the server. A client-side filter does not satisfy Firestore
  authorization and does not prevent data exposure.

## Users and assignments

Collection: `users/{Firebase Auth UID}`.

| Meaning | Canonical write | Compatible read |
| --- | --- | --- |
| Role | `userRole`: Flutter enum name | Exact supported camelCase and snake_case aliases |
| Mission | `missionId` and matching `mission` | `missionId`, falling back to `mission` when absent |
| District | `districtId` and matching `district` | `districtId`, falling back to `district` when absent |
| Region | `regionId` and matching `region` | `regionId`, falling back to `region` when absent |
| Church | `churchId` | `churchId` |
| Display metadata | `role`, `roleTitle`, `level`, `isAdmin` | Display only; no privilege grants |
| Access | `approvalStatus`, `isActive`, matching Flutter `isApproved` | Respect explicit restrictions; legacy missing values supported |

Stored role names: `superAdmin`, `admin`, `missionAdmin`,
`ministerialSecretary`, `director`, `officer`, `editor`, `districtPastor`,
`churchTreasurer`, `user`. React keeps snake_case role names in its view model.

Legacy Flutter users can lack `uid`, `level`, `createdAt`, `updatedAt`, and
`isActive`, and can contain null assignment values and legacy boolean flags.
Updating their personal details must preserve these records without demanding
a destructive profile replacement. New React profiles still require explicit
identity, approval state, and server timestamps.

Global admins manage users across missions. Mission admins manage lower roles
inside their own mission and cannot transfer users between missions. Global
admins handle unassigned pending accounts. Saved assignments are admin-managed;
generic users may choose assignments during initial onboarding.

Mission-admin list queries use `missionId`. Legacy profiles containing only
`mission` still need a reviewed alias backfill for mission-admin discovery.
Global admins and the account owner can read these legacy profiles directly.

Implemented: `src/lib/userProfiles.ts`, `src/lib/queryScope.ts`, and the role
helpers in `src/types/index.ts`. Flutter registration and admin update services
still need full reconciliation of both approval representations and timestamp write requirements before
the new rules can be released to the shared backend.

## Activities

Collection: `activities/{document ID}`. Ownership: `userId`.

| Field | Stored format | React compatibility |
| --- | --- | --- |
| `id` | String | New writes use the document ID; reads ignore stale embedded IDs |
| `date` | ISO calendar date/time string | Calendar-day input uses the first ten characters |
| `activities` | Description string | Falls back to old React `title` |
| `mileage` | Nonnegative number of kilometres | Missing legacy React value defaults to zero |
| `note` | String | Falls back to old React `notes` |
| `location` | String or null on old records | Null becomes an empty form value |
| `createdAt`, `updatedAt` | Server timestamps | Preserve creation timestamp on edits |

React also stores `title`, `notes`, `category`, `durationMinutes`, and
`participants` for compatibility with earlier React data. Flutter's updates
are merged and can leave these aliases stale, so canonical fields take priority.
React-only duration/reach fields do not replace Flutter's mileage.

Implemented: `src/lib/activities.ts`, activity editor/export, dashboard, and
ministry activity lists. Mileage entry, display, and export are supported.
Flutter's reimbursement rate is device-local (`km_cost_rate`, default 0.50).
React now provides the same default, a local configurable rate, monthly distance/
cost statistics, matching exports, and an A4 activities PDF. Rates remain local
in both clients.

## Borang B

Collection: `borang_b_reports`. Ownership: `userId`.

- Flutter stores `month` as an ISO date string and identifies reports with a
  UUID; its lookup uses owner and the month's ISO date range.
- React currently stores numeric `month`, separate `year`, and a deterministic
  `{uid}_{year}_{MM}` document ID. It must find and reuse existing Flutter IDs
  before creating a report, rather than silently creating duplicates.
- Canonical name: `userName`; React currently uses `pastorName`.
- Canonical statistics include membership beginning/end and movements,
  `professionOfFaith`, `sabbathServices`, `prayerMeetings`, `bibleStudies`,
  visitations including prisons, `dedications`, literature distributions,
  `tithe`, and `offerings`.
- Canonical text: `otherActivities`, `challenges`, `remarks`.
- Status: `draft` or `submitted`. Flutter serializes creation, update, and
  submission dates as ISO strings. Existing React writes use server timestamps.

Implemented: `borangB.ts` and `borangBStorage.ts` normalize both month formats,
cover every canonical Flutter statistic, reuse existing UUID records, preserve
unknown fields through merge writes, and compare full revisions during updates.
New React records use deterministic IDs and conditional creation. Existing
Flutter records prevent automatic creation of another report for the same month;
already-duplicated months require explicit record selection. The root rules now
accept canonical Borang B data locally, and storage tests also pass against the
saved deployed rules snapshot. Distinct concepts such as sermons and Sabbath
services are not implicitly mapped.

Pending: coordinated first-time creation in Flutter and React, real signed-in
cross-client verification, and offline conflict handling. Statistics and A4 print
layouts follow Flutter; see `STATISTICS_PRINT_PARITY.md`.

## Financial reports and FAM

Collections: `financial_reports` and `fam_data`. Financial ownership:
`submittedBy`; access also follows the assigned church and mission.

- Financial `month` is a Firestore timestamp for the month's first day;
  `year` is numeric. React currently writes a numeric month.
- Flutter stores `tithe`, `offerings`, `specialOfferings`, receipt-number
  ranges, and `customFinanceTypes`. React's combined-budget, mission-offering,
  local-offering, and singular `specialOffering` fields need explicit mapping
  and preservation; an aggregate offering must not be counted twice.
- Canonical status: `draft`, `submitted`, `approved`. React currently uses
  `verified` for approval.
- Canonical history: `editedBy`, `editorName`, timestamp `editedAt`, `action`,
  optional map `changes`. React currently uses different names and string changes.
- FAM links to the financial report through `reportId`; Flutter locates it by
  that field. Reuse existing FAM document IDs instead of assuming `fam_{reportId}`.
- FAM canonical fields include building, welfare, mission, education, youth,
  children, women, men, senior, and music funds, other income, maintenance,
  utilities, insurance, salaries, rent, supplies, transportation, communication,
  printing, equipment, other expenses, and notes.
- React's generic fund/expense arrays and opening/closing balances need an
  explicit model; they cannot replace named Flutter fields implicitly.

Read/print compatibility is implemented in `reportViews.ts` and
`reportDocuments.ts`: calendar-month timestamps, canonical offering totals,
custom finance labels, approved status/history, and FAM lookup by reportId.
Canonical Flutter financial records are previewable/printable. The financial
ledger's older combined financial/FAM editor remains blocked for canonical
records. My Mission now has a separate canonical main-report editor: Flutter
Timestamp month/created/submitted/updated dates, canonical custom labels and
history, actual-document lookup, conditional creation, transactional stale-edit
protection, unknown-field preservation and approved-record read-only handling.
It does not modify FAM records. Its storage tests pass against both local root
rules and the saved deployed-rules snapshot.

Pending: complete ledger/FAM writer replacement, atomic financial/FAM updates,
real signed-in round trips, and a shared first-create protocol with Flutter.

## Quarterly department reports

**New Flutter working-tree contract (reviewed 2026-11-27):** department reports
now use `department_report_templates` and quarterly `templateId`,
`departmentKey`, `departmentName`, `values` (typed scalars/repeating groups), and
Timestamp dates. The model no longer stores a draft/submitted status. React
now implements this contract, including a form builder, response/summary views,
labelled exports and PDF printing. See `DEPARTMENT_FORMS_UI.md`. The nested-field notes below describe the
previous Flutter model only. See `DEPARTMENT_REPORT_COMPARISON.md` for migration,
overwrite, template-history and permission gaps before extending either writer.


Previous model (retained for legacy readers), collection
`quarterly_department_reports`:

- Previous document ID:
  `{churchId}_{year}_Q{quarter}_{department.name}`.
- Flutter department names: `kanakKanak`, `penatalayanan`.
  React's `kanak_kanak` must be normalized to `kanakKanak` for writes and IDs.
- Canonical children's data is nested under `kanakKanakData` with age groups
  0–2, 3–5, 6–9, 10–12, and 13–14, separate SDA/non-SDA APTA families,
  KID enrolment, and family worship. React's current age groups cannot be
  converted losslessly; preserve older data and request corrected input.
- Canonical stewardship data is nested under `penatalayananData`: three monthly
  entries (`titheAmount`, `titheGivers`, `offeringAmount`, `systematicGivers`),
  `employedPermanent`, `selfEmployed`, `unemployed`, `sermonsDelivered`,
  `seminarsHosted`, and `familyVisitations`.
- React's `sspm` and `wanita` departments are extensions. Flutter must explicitly
  recognize or exclude unsupported department records; the previous parser
  defaulted unknown departments to children's ministry. The new dynamic parser
  uses departmentKey instead, so any matching published template can be supported.

Read/print adapters now recognize `kanakKanak` and preserve its exact nested age
groups, as well as stewardship monthly amounts/giver counts and employment/activity
fields. The new template/value writer maps equivalent legacy field IDs, discovers
existing records by church/period/key and preserves their actual IDs and unknown
answers. Nonmatching old React age bands remain visible earlier answers and are
not silently converted. React snapshots templates and protects stale edits;
Flutter migration/overwrite/snapshot behavior still requires coordination.

## Remaining collections and verification

Appointments, tasks, events, resources, staff, hierarchy, and ministry teams
need their full compatibility review. Flutter ministry teams currently live in
SharedPreferences; React uses `ministry_team`. Appearance preferences and
Flutter mileage reimbursement rates are currently device-local.

Before release, validate stored records, existing aliases, and IDs. For financial
and submitted reports, compare the loaded revision with the current server
revision in a transaction, reject stale saves, and ask the user to reload.
This conflict policy is selected but not yet implemented. No automatic financial
merge or production migration is authorized by this document.

## Concurrent Flutter work

During implementation, separate uncommitted Flutter changes added Google sign-in,
mission selection, and an `isApproved` account flag. React reads that flag and
writes it alongside access updates; the backend also denies access when it is
false. Those Flutter changes were preserved. Reinspect them before extending the
contract or replacing Flutter's modified security rules.

## Local checks

Use Node compatible with Vite 8, npm, Java, and Firebase CLI (verified with CLI
15.8.0). `package-lock.json` is the authoritative React lockfile.

```sh
npm ci
npm run lint
npm run build
npm test
npm run test:rules
```

The security tests use only `demo-pastorpro-sync` and require a local emulator.
Never point those fixtures at the production project. The checked-in index file
contains the new mission-scoped audit/request queries, not a complete inventory
of all production indexes. Merge with the existing deployed index definitions
during release preparation.

# Department forms workspace

Implemented in React on 2026-11-27, using the current Flutter template/value
contract. No Flutter files or production records/rules were changed.

## Where to use it

- **Quarterly Depts → Fill a report:** choose year, quarter and church, then open
  an active department form. Required questions validate section by section.
  Submit records one response for that church/quarter/department. Existing
  responses reopen for editing. There is no separate draft status for new
  submissions, matching Flutter.
- **Administration → Report Form Builder:** Admin/Super Admin accounts can create
  blank forms, add starter Children’s Ministry/Stewardship forms, edit question
  wording/types, configure dropdown choices, currency prefixes, required flags,
  repeating groups, section order and acceptance of responses. Preview uses the
  same respondent component and does not save answers.
- **Admin Console → Open Form Builder** and **Quarterly Depts → Manage forms**
  lead to the same management page. Editors link directly to their Responses view.
- **Responses:** filter form/period/mission/district/church, inspect individual
  responses, view aggregated numeric/currency/checkbox/dropdown/repeating totals,
  church submission coverage and missing churches, and export CSV/Excel or A4 PDF.
  Excel/CSV use human question labels as columns. Closed forms retain responses.

## Compatibility and save behavior

- Reads live `department_report_templates`; writes canonical `templateId`,
  `departmentKey`, `departmentName`, `values` and Timestamp dates. New report IDs
  follow Flutter’s church/year/quarter/key identity.
- Server lookup discovers legacy records before create, including `kanakKanak`
  and existing UUID IDs. Multiple existing responses require an explicit
  response selection. React edits preserve the actual stored ID.
- Old nested children/stewardship values map by equivalent field IDs. Old React
  age bands are not silently converted into different age bands. Earlier/retired
  fields and unknown repeated sub-fields/rows are retained and visible.
- React response edits compare the full saved revision in a transaction and merge
  known updates. New conditional commits prevent racing React creates. Admin
  template edits have revision protection and immutable published department keys;
  new React templates use a stable key-based document identity.
- React responses include a `templateSnapshot` and normalized template revision;
  PDFs use that snapshot to preserve question wording after later template edits.
  Template timestamps are checked by local candidate rules for new-create races.
- Explicit loading/error/cache states prevent denied queries from becoming
  authoritative empty totals. Failed submits retain typed answers; navigation
  and unload guards protect unsaved work.

## Verification

- 34 unit tests passed, including six new form/schema/validation/history/export tests.
- 37 root-rule/storage tests passed, including six department storage/security tests.
- Five department storage tests passed against the current **Flutter local rules**
  in an emulator, including new admin form creation. The compatibility run does
  not represent a production rule check.
- Five Chrome browser tests passed, including required-question navigation,
  repeating inputs, failed-submit retention, confirmation, question editing,
  dropdown options, preview and save. Desktop and 390px screenshots inspected.
- TypeScript, production build and whitespace checks passed. Existing bundle-size
  and Vite configuration deprecation warnings remain.

## Still pending

- Actual signed-in account/production template-permission verification. Local root
  rules include template and canonical quarterly access, but are **not deployed**.
- Flutter still has unconditional report writes and no legacy-field reader or
  snapshot preservation. Flutter can overwrite a React revision/snapshot or
  recreate a canonical ID for a legacy-ID record. Cross-client concurrency and
  legacy migration are not claimed complete by React’s safeguards.
- No bulk migration or automatic conversion of incompatible historic age bands.

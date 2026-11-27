# Department report changes — 2026-11-27

Reviewed the current Flutter working tree, including its uncommitted template,
quarterly report, form, summary, PDF, provider, service, navigation and rules work.
Compared with the current React quarterly reader, editor, previews and local rules.
No Flutter files, production rules or application data were changed.

## Implementation follow-up

React now implements the template/value contract, a Google Forms style report
filler and related admin builder/response workspace. It has generic summaries,
question-labelled spreadsheet exports, PDFs, legacy-ID lookup, retained earlier
answers, snapshots and transactional React edit safeguards. See
`DEPARTMENT_FORMS_UI.md` for the verified implementation and outstanding Flutter
writer/live-permission work. The comparison below records the **original audit**.

## New Flutter behavior

- Admin/Super Admin template management: create departments, activate/deactivate,
  delete, reorder steps and fields, configure required flags/help/options/prefixes,
  and seed Children’s Ministry and Stewardship defaults.
- Shared Firestore collection `department_report_templates` drives live forms.
- Generic multi-step forms support text, number, currency, checkbox, dropdown and
  repeating groups, with simple sub-fields and configurable repeat labels/counts.
- District quarterly screen lists churches and active department submission chips.
  Report existence means submitted; absence means pending. There is no stored
  draft/submitted status in the new report model.
- District and mission summary components aggregate numeric/currency totals,
  checked counts, dropdown tallies and repeated fields, with per-church details
  and coverage. District entry is through quarterly reports; mission entry is
  through admin template management.
- Individual and consolidated A4 PDF previews use the template’s step/field labels.

## Shared data contract has changed

New quarterly documents use `templateId`, `departmentKey`, `departmentName` and
`values`, with Timestamp submitted/created/updated dates and optional editedBy.
`values` holds scalars or arrays of sub-field maps. IDs remain
`{churchId}_{year}_Q{quarter}_{departmentKey}`; the default children’s key is now
`kanak_kanak`. Templates identify fields independently of their labels.

React still writes `department`, numeric `payload`, `status` and `notes` using
four hardcoded department definitions. Its earlier read/print compatibility
supports the previous Flutter `kanakKanakData`/`penatalayananData` model, not this
new template-driven model.

A local sample in the new Flutter shape produced this React adapter result:
`department: null/undefined`, `status: draft`, `payload: {}`. The answers survive
only in `sourceData.values`, which the current preview does not render. This is
a display/contract failure; the review did not alter real records.

## Findings and required follow-up

1. **High: React readers and writers are incompatible.** Add template/value
   types and streams, generic rendering/validation, correct submission semantics,
   template-aware details/exports/PDF and summaries. Keep old records readable.
2. **High: no legacy migration/reader in the new Flutter model.** It reads only
   `departmentKey` and `values`; older `department`, nested children/stewardship
   data and React `payload` are not adapted. Old reports can appear pending or
   blank. The former `kanakKanak` ID suffix also differs from `kanak_kanak`.
   Define explicit mappings, preserve actual IDs, and avoid duplicate creation.
3. **High: overwrite/stale-edit risk.** Flutter `saveReport` uses unconditional
   `.set(report.toMap())`, without merge or a revision transaction. Editing can
   remove older-client/unknown fields and overwrite another device’s changes.
   React merging its old `payload` does not update Flutter’s `values` either.
4. **Medium: template history is not pinned.** Reports store templateId/key/name
   but no immutable template version or field snapshot. Removing/changing fields
   affects historical rendering; rebuilding values on edit can drop retired
   answers. Archive templates and preserve unknown answers; define versioning.
5. **Medium: stream error/loading handling.** Template and district-report
   providers listen without onError handlers; the summary also lacks query/error
   handling and clears its loading state before the first report snapshot.
   Permission failures may leave spinners or initially misleading empty totals.
6. **Rules gap in React’s local candidate.** No `department_report_templates`
   rule exists, and quarterly validation still requires old department/payload/
   status fields. Flutter’s local rules now include template reads/admin writes.
   Reconcile and emulator-test both contracts before any root-rule deployment.
   Current production deployment of these new Flutter rules was not verified.

## Recommended synchronization order

- [ ] Agree the versioned template/value contract and legacy mappings.
- [ ] Add compatible readers and previews before enabling writes.
- [ ] Add React template management, dynamic forms and field-type validation.
- [ ] Add safe, field-preserving writes, revision checks and existing-ID lookup
      in both clients; settle submission/draft semantics explicitly.
- [ ] Match summaries, church submission tracking, exports and individual PDFs.
- [ ] Test role/mission/district boundaries and template permissions in emulator.
- [ ] Verify legacy/new cross-client round trips with signed-in accounts.

Validation: targeted Dart analysis of the department models/providers/services,
forms/admin screens, summary/PDF and helpers found **0 errors, 0 warnings and
1 info** (`unnecessary_underscores` in quarterly_reports_screen.dart). No Flutter
build, signed-in runtime test or production deployment was performed in this audit.

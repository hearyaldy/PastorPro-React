# My Mission feature comparison

Reviewed: 2026-11-27 (Asia/Bangkok).

Sources: React `src/pages/MyMissionPage.tsx` and Flutter
`../pastor_report-latest/lib/screens/my_mission_screen.dart`, including the
widgets actually called by Flutter's `build` method and their data services.
This was a source review; no application data or production permissions changed.

React's My Mission currently provides a mission directory, organizational counts,
department/event links, and an organizational PDF. Flutter's screen combines
organizational information with financial reconciliation and ministry reporting.
The previous styling/printing work did not implement these additional reporting
features on React's My Mission page.

## Implementation status

The missing dashboard features below are now implemented in React. The original
comparison is retained as the audit baseline. `MissionReportingDashboard.tsx`,
`useMissionReports.ts`, and `missionReporting.ts` provide role/assignment scopes,
month/year navigation, monthly/YTD reports, source coverage, ministry measures,
church completion, reconciliation filters/details, and Excel/A4 PDF exports.
My Mission retains its organizational directories. Reporting organization counts
follow the selected scope; the separately labelled mission directory remains
mission-wide.

`MissionFinancialEditor.tsx` and `financialStorage.ts` add contextual church/month
creation and editing for canonical Flutter financial reports. They preserve
actual document IDs and unknown fields, write Flutter timestamps and history,
reject stale edits, protect racing React creates, and block approved records.
The older React ledger/FAM editor remains a separate, unfinished write contract.

No production rules or data were changed by this implementation. The local root
rules have tested district read access and canonical financial validation; the
new editor also passes against the saved deployed rules. Some mission-level
roles lack financial read access under that deployed snapshot; partial/error
states disclose this instead of showing an authoritative zero. Live signed-in
verification and any production permission change remain pending.

Validation: 25 unit tests, 31 root rules/storage tests, 3 financial compatibility
tests, 3 Chrome browser checks, TypeScript and production build. See
`SYNC_FIX_PLAN.md` for the persistent checklist.

## Original audit: missing and partial features

| Feature | Flutter behavior | React My Mission status at audit |
| --- | --- | --- |
| Month selection | Previous/next month controls update monthly figures and the selected YTD endpoint. | Missing. Current directory has no reporting-period state. |
| Mission, district, and church reporting scopes | Separate views recalculate financial, ministry, and organization figures for the selected scope. Assignment/role controls determine available selections. | Partial directory filtering only; tabs list districts/churches/staff without recalculating reporting dashboards. |
| Year-to-date financial summary | January through the selected month: tithe, offerings, special offerings, grand total. | Missing. The page does not consume financial reports. |
| Monthly financial comparison | Treasurer versus Borang B: tithe, offerings, total, monetary differences and discrepancy percentages. | Missing. The page consumes neither financial nor Borang B reports. |
| Report-source coverage | Counts for both report sources, treasurer only, Borang B only, and discrepancies. | Missing. |
| Detailed discrepancy report | District-based reconciliation, church reporting coverage, missing churches, amount/field mismatches, search and All/Discrepancy/Missing/Match filters. | Missing. |
| Discrepancy Excel export | Selected-month workbook with district, church count, status, both report amounts, differences and discrepancy percentage. | Missing. Organizational PDF printing is already available, but no reconciliation spreadsheet exists. |
| Ministry Activities Summary | Aggregated Borang B baptisms/professions, membership beginning/end/net change, services/studies/meetings, home/hospital/prison visits, literature, weddings/funerals/dedications. | Missing on this page. React's Borang B editor and browser now have compatible individual data; the My Mission aggregation is not implemented. |
| Reporting completion | Churches reported versus total churches, percentage and progress bar, for the selected context/month. | Missing. |
| District pastor Borang B status | Selected-month status and action to open the pastor's report in district view. | Missing on this page. A current-month status exists elsewhere in React's dashboard/ministry views. |
| Financial report actions | Role-aware Add New Report, View Reports, Edit Reports, with manageable-church selection and period context. | Missing on this page. React has a separate financial page, with full Flutter write compatibility still pending. |
| Financial/ministry live updates and refresh | Context-specific financial and Borang B streams, cached month reaggregation, explicit refresh and pull-to-refresh. | Partial. React hierarchy/directory data already streams through MissionContext; there are no financial/ministry streams here and no page refresh action. |

## Scope and assignment behavior differences

- Flutter exposes its mission override selector to Super Admins and supplies
  Reset to My Mission. React displays a selector whenever multiple missions exist,
  without matching role gating or a reset action.
- Flutter has a No Mission Assigned state. React silently falls back to the first
  available mission when the assignment is absent or does not resolve.
- React's region/district filters affect directory rows; the organizational
  statistics and printed directory continue using the full active mission.
  They are not district/church financial reporting scopes.
- The Flutter implementation has district/submitter and user/month fallbacks
  for legacy report assignments. Equivalent compatibility handling is needed
  when React adds these reporting queries.

## Already present in React

- Mission name, parent Union, headquarters, and assignment banner.
- Region, district, church, staff, and membership organization information.
- Searchable district/church/staff directories and available staff contact links.
- Mission departments and event/calendar links.
- Flutter-style statistics cards and A4 organizational-directory PDF preview,
  download, printing, and sharing.

## Recommended implementation sequence

1. Define role-aware mission/district/church scopes, assignment resolution,
   No Mission Assigned handling, and selected month/year controls.
2. Add scoped report streams and compatible readers. Implement monthly and
   YTD aggregates with tests for date boundaries and legacy assignments.
3. Add financial comparison and reporting completion. Keep treasurer figures
   separate from Borang B figures to avoid counting the same money twice.
4. Add district discrepancy details, missing-church coverage, search/status
   filters, and matching Excel/PDF exports.
5. Add grouped ministry aggregates, district pastor status/report links,
   refresh behavior, and contextual report actions as writer compatibility permits.

Reuse the existing canonical Borang B reader, financial read adapter, shared
statistics cards, report tables, and A4 preview. Determine access in backend
rules as well as UI capabilities before enabling financial reporting scopes.
The original review did not mark these features implemented; see the implementation status above for the completed local work and remaining verification.

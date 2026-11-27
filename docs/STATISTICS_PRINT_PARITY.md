# Flutter statistics and printing parity

Updated: 2026-11-27 (Asia/Bangkok).

The React statistics and print views now follow the Flutter source layouts.
Statistics use rounded cards, centered colored icons, prominent values, and
responsive spacing. Activity and finance totals use a blue gradient summary,
matching Flutter's summary treatment. Read-only reports use grouped tables.

## Screen coverage

| React screen | Flutter comparison and resulting behavior |
| --- | --- |
| Dashboard | `dashboard_screen_improved.dart`: Pending Todos, upcoming events/appointments, activities; counts use complete streams rather than five recent entries or eight tasks. Flutter completion flags are understood. |
| Activities | `activities_list_screen.dart` and `activity_export_service.dart`: monthly selection, distance, configurable local RM/km rate (default 0.50), total reimbursement, A4 blue report header, pastor details, activity/location/KM/cost table and totals. |
| Borang B | `borang_b_screen.dart`, `borang_b_preview_screen.dart`, and `borang_b_service.dart`: complete membership, baptisms, services, visits, special events, literature, finance, and narrative sections, with pastor/mission/district/month/status information. |
| Mission Borang B browser | `all_borang_b_reports_screen.dart`: report count, baptisms, peak reported membership, financial totals, full individual report tables and PDF; filtered submission tracker also prints. Membership across months is not added together. |
| Financial/FAM | `treasurer_dashboard.dart` and `treasurer/export_report_screen.dart`: total financial, tithe, offerings, special offerings, approved status, notes, and A4 report. Linked FAM details are found by `reportId`, including Flutter's named funds and expense categories. |
| Quarterly reports | Children's ministry age groups and stewardship monthly records from `quarterly_department_report_model.dart` are printed without changing their meaning. Browser summaries, current form previews, and individual report previews are available. |
| My Mission and My Ministry | Shared statistics styling, church/membership/team summaries, and printable directories. Flutter church/staff name and assignment aliases are recognized; streams do not exclude records merely because they lack React's name fields. |
| Administration and resources | Shared summary cards and printable statistics/resource lists. |

## Report controls

`ReportPreview` opens the generated PDF with Download PDF, Print, Share, and
Close controls. Sharing uses the device's file sharing support when available;
otherwise it downloads the file. Reports use A4 pages, 32-point margins, table
headings repeated across pages, and generated-time/page-number footers.

The PDF contains report data rather than navigation bars, editable inputs, or
application drawers. Activity/finance totals and the selected browser filters
are taken from the same data used for the on-screen statistics. Long tables and
narratives continue onto subsequent pages. Financial ledgers use landscape A4.

PDF generation is loaded when a preview opens. `pdfReport.ts` builds PDFs;
`reportDocuments.ts` defines the shared report sections; `ReportTables` renders
the same sections on screen. Chrome checks cover desktop and mobile widths,
preview keyboard dismissal, focus restoration, and downloads for the four main
report types. Physical-printer output and platform-native sharing have not been
tested on a device.

## Borang B synchronization

`borangB.ts` reads Flutter ISO months and older React numeric months into a
common view. It maps equivalent aliases explicitly; sermons are not assumed to
be Sabbath services. Writes use Flutter names, ISO dates, complete statistics,
the actual Firestore document ID, and existing creation/submission dates.

Before creating a report, `borangBStorage.ts` queries the owner's reports from
the server and checks the selected month. Existing Flutter UUID reports are
edited in place. Already-duplicated months require explicit selection of an
existing record rather than another automatic creation.

New React records use deterministic IDs and a conditional `exists: false` commit
under the signed-in user's token. This avoids overwriting a racing React create
without requiring permission to read a nonexistent document. Existing records
use transactions comparing the complete loaded revision, so a later phone edit
causes a conflict instead of being silently overwritten. Fields outside the
form are preserved by merge updates.

Auto-save is debounced, errors keep entries visible, and changing months first
saves pending changes. Navigation and browser close warn about unsaved entries.
Offline saves cannot complete until connected; existing in-memory entries are
kept on failure. This is not an offline draft database.

## Remaining synchronization limits

- Financial and quarterly write formats still require their full compatibility
  work. Canonical Flutter financial records can be previewed and printed;
  their incompatible React editor is blocked to prevent changing their format.
- Older quarterly age groups cannot be redistributed losslessly into Flutter's
  age bands. Printing retains the recorded fields; no automatic conversion was made.
- Simultaneous first-time creation by Flutter using a UUID and React using a
  deterministic ID still needs a shared creation protocol in both clients.
- Complete user/approval write reconciliation and offline conflict handling
  remain open in the main synchronization plan.
- The root `firestore.rules` now validates canonical Borang B writes locally.
  The broader root rules have not been deployed. The Borang B save tests also
  pass against the saved, currently deployed Flutter-compatible rules snapshot,
  so no new production rules deployment is required for this feature.

## Verification

- `npm run lint` and `npm run build`.
- `npm test`: 20 unit tests, including date boundaries, aliases, complete field
  retention, financial totals, quarterly age groups, mileage, and multipage PDFs.
- `npm run test:rules`: 26 local rule/storage tests, including existing Flutter
  report edits, stale saves, duplicate detection, conditional creates, and ownership.
- `npm run test:borang-compat`: 5 storage tests against the saved production rules.
- `npm run test:browser`: 2 Chrome tests covering responsive cards and PDF downloads.

Browser checks require the local Vite server. Set `CHROME_PATH` if Chrome is not
installed at the default macOS location, and `REPORT_TEST_ORIGIN` if the server
uses a different origin. Fixtures contain invented data and perform no production
Firestore writes. No production data migration or deployment was performed.

# Flutter Departments directory review — 2026-11-27

Reviewed the main `/departments` route (`DepartmentsListScreen`), its
`DepartmentManagementScreen` admin entry, `DepartmentService`, mission subcollection
services, department model, form viewer, and the corresponding React page/context.
The quarterly form/template feature is a separate route and data contract.
This review changed documentation only; no Flutter or production data was modified.

## Main finding

The Google Forms style quarterly workspace does not synchronize the general
Departments directory. That directory still uses different collections and fields
between the clients.

| Area | Current Flutter | Current React | Gap |
| --- | --- | --- | --- |
| Primary directory storage | `missions/{missionId}/departments/{departmentId}`; legacy top-level fallback | Only top-level `departments/{departmentId}` | Mission departments can be absent from React, and React creates can be absent from Flutter’s mission list. |
| Form link | `formUrl` | `resourceUrl`, optional `secondaryUrl` | Flutter links are not mapped into React portal actions; React links are not Flutter form links. |
| Mission scope | Selected/assigned mission; ID/name resolution in stream | Context listens to the complete top-level collection; page has no mission filter | Display can mix missions. React saves default to profile/first mission, even when editing another mission’s record. |
| Card appearance | Stored `icon`, ARGB `color`, colorful rounded cards | Plain resource cards, no icon/color configuration | Visual/admin settings do not match. |
| Active state | Active-only default, inactive toggle/badge, activation controls | No active filter/control; every save writes `isActive: true` | Editing can reactivate a department unintentionally. |
| Browse/actions | Search, refresh, details, in-app form viewer with department switcher | No directory search/details viewer; portal links open a new tab | Behavior differs; browser embed restrictions must be considered before promising embedded external forms. |
| Admin setup | Name, form URL, icon, color, status, selected mission | Name/code/director/description/resource URLs; no icon/color/status or explicit mission selection | Different editors and save payloads. |

## Flutter issues found in the directory code

1. **Adding by selected mission ID can target the wrong collection.** The admin
   screen passes `_selectedMissionId` to `addDepartment`, but that service calls
   `getMissionByName` (a name-only query). If the ID is not also the name, the
   service falls back to the top-level legacy collection. The visible mission
   list continues streaming the subcollection, so a successful add can appear
   missing. `addDepartmentToMissionById` already exists but is not used by that
   screen’s add flow. This is a source-level finding; no live save was attempted.
2. **Delete has the same ID/name ambiguity.** `deleteDepartment` resolves its
   `missionName` argument by name only, then falls back to the legacy collection.
   Update is more robust: it checks a direct mission document ID before name lookup.
3. **Some Flutter department details print `dept.mission` directly**, which can
   contain an ID instead of a readable mission name.

## Local React rule candidate

The nested department rules currently require `missionId` inside each department,
exact create/update timestamps, and the older React-only field whitelist. Flutter
nested writes use the parent mission path plus `formUrl`, `icon`, `color` and may
not contain `missionId` or an initial `updatedAt`. The local candidate would reject
those Flutter reads/writes if deployed unchanged. It has not been deployed.

## Next fixes

- [ ] Define a common department reader/writer and retain actual collection paths.
- [ ] Read mission subcollections with explicit legacy fallback/deduplication;
      normalize formUrl/resourceUrl and mission ID/name aliases without moving data.
- [ ] Fix Flutter add/delete mission resolution and preserve React edit ownership.
- [ ] Reconcile nested/legacy rules with scoped admin permissions in emulator.
- [ ] Add directory search, active filtering, icon/color/status management and
      explicit mission selection; connect related admin navigation.
- [ ] Match form-opening behavior with a working new-tab fallback, and verify
      real signed-in cross-client creates/edits without production test writes.

Validation: targeted Dart analysis of department model/service, list/admin screens
and in-app viewer found **0 errors, 0 warnings, 1 info** (deprecated Color.value in
department_service.dart). Quarterly report service still uses unconditional set;
its previously documented cross-client revision/snapshot issues remain open.

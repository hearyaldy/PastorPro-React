# Pastor Report — Technical Specification

**Version documented:** 3.2.0+21
**Last updated:** 2026-11-27

Church management platform for the Sabah Adventist Mission (SAM/NSM), covering pastoral activity logging, monthly ministerial reporting (Borang B), church financial reporting, quarterly departmental reporting, and mission-wide administration (users, staff, church hierarchy, events, resources).

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Flutter (3.32.x stable), Dart ≥2.19 |
| Platforms | Android, iOS, Web (GitHub Pages), macOS, Linux, Windows |
| Backend | Firebase (Firestore, Auth, Cloud Functions) |
| State management | `provider` (ChangeNotifier) |
| Local storage | `shared_preferences` (settings, to-dos, cached lists) |
| Offline | Firestore persistence enabled, unlimited cache size |
| Document export | `pdf`, `printing`, `excel` |
| Calendar | `table_calendar` |
| In-app browser | `webview_flutter` (+ Android/WKWebView backends) |
| File handling | `file_picker`, `path_provider`, `share_plus`, `image_picker` |
| UI | Material Design 3 |
| CI/CD | GitHub Actions → `flutter build web` → GitHub Pages (on push to `main`) |

## 2. Architecture

- **Pattern:** Provider-based MVVM. Screens consume `ChangeNotifier` providers; providers call stateless `*Service` classes that wrap Firestore/Auth calls.
- **Core providers** (`lib/providers/`): `AuthProvider` (session/user profile), `ThemeProvider` (light/dark, persisted), `MissionProvider` (mission-scoped reference data), `QuarterlyDepartmentReportProvider` (department report streams/mutations).
- **Services** (`lib/services/`, ~35 files): one service per domain (auth, role, church/district/region/mission hierarchy, staff, financial reports, FAM, Borang B, quarterly department reports, activities, events, appointments, to-dos, resources, departments, user/staff management, data import, caching, settings). Services talk directly to `cloud_firestore` / `firebase_auth`; no repository abstraction layer beyond this.
- **Routing:** Named routes registered in `MaterialApp` (`lib/main.dart`), plus `onGenerateRoute` for two parameterized routes (`/edit-activity`, in-app WebView). No deep-link/router package (e.g. go_router) — flat route table keyed by `AppConstants.route*` strings.
- **Offline-first:** Firestore persistence is enabled at startup with `cacheSizeBytes: CACHE_SIZE_UNLIMITED`; the app remains usable offline and syncs on reconnect.
- **Multi-tenancy model:** data is scoped hierarchically — **Mission → Region → District → Church** — with `missionId`/`regionId`/`districtId`/`churchId` denormalized onto most report documents to support filtering at any level without joins.
- **Cloud Functions** (`functions/index.js`, Node, 1 callable): `deleteUserCompletely` — admin-triggered cascade delete of a user's Auth record + Firestore profile.

## 3. Firestore Data Model

Top-level collections (see `firestore.rules` for the authoritative access rules):

| Collection | Purpose |
|---|---|
| `users/{userId}` | Profile, role, mission/region/district/church assignment, premium flag, onboarding status |
| `missions/{missionId}` | Mission records; subcollections `departments/{departmentId}` and `reports/{reportId}` |
| `regions/{regionId}` | Region hierarchy under a mission |
| `districts/{districtId}` | District hierarchy under a region |
| `churches/{churchId}` | Church records; assigned treasurer, district/region/mission links |
| `staff/{staffId}` | Staff directory (imported from CSV/JSON, assignable to districts) |
| `departments/{departmentId}` | Church department directory + external resource URLs |
| `financial_reports/{reportId}` | Monthly tithe/offerings per church (treasurer module) |
| `fam_data/{famId}` | Financial Accounting Method breakdown (funds & expenses) linked to a financial report |
| `quarterly_department_report/{reportId}` | Quarterly Kanak-Kanak / Penatalayanan department reports (new module, see §5.9) |
| `borang_b_reports/{reportId}` | Monthly ministerial pastoral report (Borang B) |
| `activities/{activityId}` | Pastoral activity log entries |
| `appointments/{appointmentId}` | Pastoral appointment records |
| `todos/{todoId}` | Personal to-do items |
| `events/{eventId}` | User/local events |
| `global_events/{eventId}` | Mission-wide events (admin-managed) |
| `resources/{resourceId}` | Shared downloadable/linked resources |
| `locationRequests/{requestId}` | "My church/district isn't listed" requests from onboarding |
| `settings/{settingId}` (incl. `settings/emailDomains`) | App-wide configuration, allowed email domains |
| `admin_activity/{activityId}` | Audit log of admin actions |

## 4. Roles & Permissions

Ten roles, each with a numeric `level` (1–5) used for coarse-grained checks, plus named capability checks (`canManageUsers`, `canAccessFinancialReports`, `canAccessDepartmentReports`, `canAccessBorangBReports`, etc.) on `UserModel`.

| Role | Level | Key capabilities |
|---|---|---|
| Super Admin | 5 | Full access; only role that can create another Super Admin |
| Admin | 4 | Manage users/missions, data import, cannot assign Admin/Super Admin |
| Mission Admin | 3 | Manage staff/users within own mission; assign roles below Mission Admin |
| Ministerial Secretary | 3 | Read all Borang B reports across the mission |
| Director | 3 | Mission-level read/write |
| Officer | 3 | Mission-level read-only |
| Editor | 2 | Edit content within assigned mission |
| District Pastor | 2 | Manage district-level reports; submit quarterly department reports per church in district |
| Church Treasurer | 1 | Submit/view own church's financial reports |
| User | 1 | Submit personal activities/reports, view own data |

Role resolution (`UserModel.fromMap`) supports both the current `userRole` enum field and legacy boolean/string fields (`isAdmin`, `roleTitle`, `role`) for backward compatibility with older documents. `firestore.rules` mirrors this by checking both `userRole` and the legacy `role`/`roleTitle` strings in its helper functions.

## 5. Features

### 5.1 Authentication & Onboarding
- Email/password auth via Firebase Auth with email verification.
- Multi-step onboarding: Region → District → Church selection, with a "location not listed" request flow (`locationRequests`) reviewed by admins.
- Role assigned at registration, confirmed/adjusted by an admin.

### 5.2 Pastoral Activities
- Log, categorize, edit, and delete pastoral activities (visits, meetings, evangelism, etc.).
- Export activity logs (`activity_export_service.dart`).

### 5.3 Monthly Report — Borang B
- Digital SAB Ministerial Pastoral Monthly Report, entered month-by-month with auto-save to Firestore.
- PDF export/sharing (`borang_b_preview_screen.dart`, `printing`/`pdf` packages).
- Per-user submission history; Ministerial Secretary / Officer / Director / Super Admin can view all submissions mission-wide (`all_borang_b_reports_screen.dart`).

### 5.4 Financial Reporting (Treasurer module)
- Church Treasurer dashboard with monthly tithe/offerings entry and history.
- FAM (Financial Accounting Method) form capturing fund-by-fund income and expense breakdown, linked 1:1 to a financial report.
- PDF/Excel export.
- Edit history tracked per report (`FinancialReportHistory`: who, when, what action).
- Admin "all reports" view, filterable by mission/region/district/month (`screens/admin/financial_reports_all_tab.dart`).

### 5.5 Quarterly Department Reports *(new, in development — not yet merged to `main`)*
- District Pastors submit quarterly data per church for two departments so far: **Kanak-Kanak** (Children's Ministry — age-band demographics, APTA family counts, KID enrollment, regular family worship) and **Penatalayanan** (Stewardship — combined Borang AP monthly tithe/offering + Borang BP leader/employment and activity stats).
- Deterministic document ID per church+year+quarter+department (`{churchId}_{year}_Q{quarter}_{department}`) to prevent duplicate submissions and make upserts idempotent.
- Realtime per-district stream via `QuarterlyDepartmentReportProvider`.
- **Known gap:** no read-only report browser/viewer yet for District Pastors or mission staff to review past submissions — only entry forms exist today. See §7.
- Designed as the first phase of a broader "Central Data" plan (see `lib/Central Data.md`) intended to eventually cover SSPM and Wanita (Women's Ministry) departments on the same unified schema.

### 5.6 Events & Calendar
- Local events (create/edit/delete) plus mission-wide global events managed by admins.
- Month/week calendar view combining events and appointments.
- Pre-loaded "special events" imported from bundled PDF/JSON assets.

### 5.7 Appointments & To-Do
- Appointment tracking with contacts, upcoming/past views.
- Personal to-do list persisted locally via `shared_preferences`.

### 5.8 Departments
- Browse church departments and their resources; in-app WebView for department links.
- Admin: add/edit/manage department URLs.

### 5.9 Church Hierarchy & Mission Administration (Admin)
- CRUD for Regions, Districts, Churches; District Pastor assignment per district.
- Mission management (create/edit missions, assign staff).
- Staff directory with CSV/JSON bulk import and name/region/district reconciliation utilities (`lib/utils/*staff*`, `region_migration_service.dart`).

### 5.10 User & Staff Management (Admin)
- Search/filter all users, assign roles and mission/region/district/church, toggle premium status.
- Bulk data import tool for churches and staff records.
- Full account deletion via the `deleteUserCompletely` Cloud Function.

### 5.11 Resource Management (Admin)
- Upload/manage shared resources available to all users.

### 5.12 Profile & Settings
- Profile photo (image picker), display name.
- Dark/light theme toggle, persisted across sessions.
- About screen with version info.

### 5.13 Offline Support
- Firestore offline persistence with unlimited cache; app remains functional offline and syncs changes on reconnect.

## 6. Security Model

Enforced in `firestore.rules`:
- Users read/write only their own `users/{uid}` document (plus admin override).
- Mission-scoped reads for staff, departments, and resources based on the requesting user's `mission` field.
- Role checks (`isAdmin`, `isMissionAdmin`, `isMinisterialSecretary`, `isMissionPresident`, etc.) read the caller's own `users/{uid}` document via `get()` and accept either the current `userRole` enum or legacy `role`/`roleTitle` strings for backward compatibility.
- Elevated write access (church hierarchy, staff, global events, user role changes) restricted to Admin/Super Admin, with Mission Admin scoped to their own mission.
- Financial and quarterly department report writes are scoped to the submitting church/district relationship, not just role, to stop a treasurer or district pastor from writing another church's data.

## 7. Known Gaps / Roadmap

- **Department report browser:** Quarterly Department Reports (§5.9) currently only support submission, not browsing/review. A read-only list/detail view (by district, church, quarter) is the next planned increment.
- **Additional departments:** SSPM and Wanita (Women's Ministry) quarterly reports are scoped in `lib/Central Data.md` but not yet modeled or built — current implementation covers Kanak-Kanak and Penatalayanan only.
- **Legacy screen variants:** `dashboard_screen_improved.dart.bak2/3/4` and `financial_report_edit_screen.dart.bak` are stale backups left in `lib/screens/` — candidates for cleanup, not part of the active app.

## 8. Build & Release

- **Versioning:** `pubspec.yaml` `version: 3.2.0+21` (semantic version + Android version code).
- **Android:** `flutter build appbundle --release`, signed via `android/key.properties`.
- **iOS:** `flutter build ipa --release`.
- **Web:** `flutter build web --release`, auto-deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

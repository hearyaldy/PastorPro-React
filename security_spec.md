# Security Specification — Pastor Report (Sabah Adventist Mission)

## 1. Data Invariants

1. **Identity, Login Approval & Privilege Isolation**: No user may self-assign an elevated role (`super_admin`, `admin`, `mission_admin`, `ministerial_secretary`, `director`, `officer`, `editor`, `district_pastor`, `church_treasurer`), `level > 1`, `isAdmin: true`, `isPremium: true`, `isActive: true`, or `approvalStatus: "approved"` during profile creation or self-update. Newly signed-up users begin as `approvalStatus: "pending"` and `isActive: false` until approved by a verified `super_admin` (including bootstrapped `haw33inc@gmail.com`), `admin`, or `mission_admin`.
2. **PII Protection**: User documents (`users/{userId}`) contain email/phone PII and are strictly readable only by the profile owner (`request.auth.uid == userId`) or Mission/Super Admins.
3. **Hierarchical Ownership & Governance**:
   - `unions` and `missions` are readable by signed-in users and writable only by verified `admin` / `super_admin` (`delete` reserved for `super_admin`).
   - Personal records (`activities`, `appointments`, `todos`, `events`, `ministry_team`, `borang_b_reports`, `locationRequests`) belong strictly to `userId == request.auth.uid` (with read access on `borang_b_reports` for Ministerial Secretary / Director / Officer / Admin / Super Admin).
   - `financial_reports` and `fam_data` writes require either an Admin/Mission Admin or a verified Church Treasurer assigned to `churchId` (verified via `get(/databases/$(database)/documents/churches/$(churchId))` or matching user `churchId`).
   - `quarterly_department_report` writes require either an Admin/Mission Admin or a District Pastor assigned to `districtId` (verified via `districts/{districtId}` or matching user `districtId`), using deterministic document ID `{churchId}_{year}_Q{quarter}_{department}`.
4. **Immutable Audit & Temporal Integrity**: `createdAt == request.time` on creation; `createdAt` and original owner IDs cannot be altered on update; `updatedAt == request.time` on update. `admin_activity` logs are append-only for admins and immutable/non-deletable.
5. **Path & Payload Bounds**: Every document ID matches `^[a-zA-Z0-9_-]+$` (`<= 128` chars), every string has strict `.size()` bounds, and every create/update checks exact `keys().hasAll(...)` / `keys().hasOnly(...)` or `affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Privilege Escalation on Create (`users/{uid}`)**: `{ uid, email, displayName, userRole: "super_admin", level: 5, isAdmin: true, ... }` -> MUST be rejected (`PERMISSION_DENIED`).
2. **Self-Elevation on Update (`users/{uid}`)**: Updating own profile with `{ userRole: "admin", level: 4 }` -> MUST be rejected (`PERMISSION_DENIED`).
3. **Shadow Ghost Field Injection (`activities/{id}`)**: Valid activity payload + `{ isVerified: true, adminOverride: 1 }` -> MUST be rejected (`hasOnly` check).
4. **Email Spoofing (`users/{uid}`)**: Request with `request.auth.token.email == "haw33inc@gmail.com"` and `email_verified == false` -> MUST be rejected.
5. **Cross-User PII Read (`users/{otherUid}`)**: Standard user calling `get` or `list` on another user's document -> MUST be rejected.
6. **Cross-Pastor Borang B Tampering (`borang_b_reports/{id}`)**: User A trying to create or update a Borang B with `userId: "user_b"` -> MUST be rejected.
7. **Cross-Church Financial Report Forgery (`financial_reports/{id}`)**: Treasurer of Church A submitting or editing a financial report for Church B -> MUST be rejected.
8. **Cross-District Quarterly Report Forgery (`quarterly_department_report/{id}`)**: District Pastor of District A writing a report for District B -> MUST be rejected.
9. **ID Poisoning (`churches/{1500_char_junk_id}`)**: Creating a document with an oversized or special-character ID (`../admin`) -> MUST be rejected by `isValidId()`.
10. **Denial-of-Wallet Oversized String (`activities/{id}`)**: Creating an activity with `notes` of 100,000 characters -> MUST be rejected by `.size() <= 2000`.
11. **Timestamp Forgery (`borang_b_reports/{id}`)**: Submitting `createdAt` backdated to `2020-01-01` instead of `request.time` -> MUST be rejected.
12. **Audit Log Tampering (`admin_activity/{id}`)**: Non-admin creating a log entry, or any user attempting to `update` or `delete` an `admin_activity` record -> MUST be rejected.

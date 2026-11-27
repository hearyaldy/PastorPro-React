# Union creation fix

Status: deployed and verified on 2026-11-27 at 20:12 (Asia/Bangkok).
Browser verification of Add Union is pending the user retry.

## Confirmed cause

The default Firestore release for `pastor-report-e4c52`, inspected read-only on
2026-11-27, was last updated on 2026-06-30 at 09:52:58 UTC. It contains no
`match /unions/{unionId}` rule, so Union reads and writes are denied. The Add
Union handler caught the rejection and rethrew it from an async event handler,
which did not display a form error. The form stayed filled with no explanation.

## Local fixes

- Show a persistent inline error on denied writes and keep form entries.
- Show saving progress and prevent duplicate submissions while a write is pending.
- Validate required fields and active Admin/Super Admin capabilities before writing.
- Separate the Union save result from its optional audit entry. A failed or slow
  audit does not keep a successful save pending or encourage duplicate records.

Changed files: `src/pages/AdminManagementPage.tsx`, `src/lib/auditedSave.ts`,
`src/lib/saveErrors.ts`, and `tests/unit/unionSave.test.ts`.

## Production candidate

`firebase/union-hotfix/deployed-before.rules` is the downloaded production
snapshot immediately before deployment. The original preparation snapshot is
retained as `initial-baseline.rules`. `unions.rules` is the complete addition. `firestore.rules` in that
directory is the snapshot plus that addition; it does not contain the broader
unreleased root rules changes. `baseline.json` records hashes for review.

The addition allows authenticated accounts to read the Union hierarchy and active,
verified Admin/Super Admin accounts to create and update validated Union records.
Super Admins may delete Unions. It trusts `userRole`, not display labels or legacy
admin flags. Existing collection rules are preserved byte-for-byte.

Validation passed:

- React TypeScript check and production build.
- All 11 unit tests, including failed primary writes and failed/delayed audits.
- All 11 Union emulator tests, including valid admin saves, invalid data,
  unauthorized/inactive/pending accounts, and exact preservation of the baseline.

## Deployment and rollback after approval

Before deploying, read the live default rules again and compare their SHA-256
with `baselineSha256` in `baseline.json`. If they differ, regenerate and retest
the candidate against the new live release before applying anything.

Review the exact difference:

```sh
diff -u firebase/union-hotfix/deployed-before.rules firebase/union-hotfix/firestore.rules
```

Deploy only this tested rules candidate after approval:

```sh
firebase deploy --project pastor-report-e4c52 --config firebase.union-hotfix.json --only firestore:rules
```

Read the deployed rules back to verify that they match the candidate, then verify
Union creation through the user's signed-in browser. No test Union has been
created in production by the agent.

If rollback is necessary and no later deployment has changed the live rules,
restore the recorded baseline:

```sh
firebase deploy --project pastor-report-e4c52 --config firebase.union-rollback.json --only firestore:rules
```

Do not use the default `firebase.json` for this hotfix; it points to the broader
synchronization rules that still require cross-client compatibility work.

## Deployment result

The user approved production deployment on 2026-11-27. The pre-deployment check
found a newer live release containing Flutter approval checks, updated at
2026-11-27T13:04:29.175518Z. The baseline and rollback snapshot were refreshed to
that release, preserving its existing rules. The same Union-only addition was
applied, and all 11 Union emulator tests passed again.

Deployment completed at 20:12 on 2026-11-27 (Asia/Bangkok). The default Firestore
release now points to ruleset `f1e16d2e-012f-4eb7-b3fb-45a808fd249d`. A read-back
verified an exact SHA-256 match with the candidate. `deployment.json` records
the release and verification details. No application records were created or
migrated. The broader root synchronization rules were not deployed.

The user should refresh the workspace and retry Add Union. End-to-end browser
verification remains pending until that action succeeds. Future Flutter rules
deployments must retain the Union block to avoid reintroducing the denial.

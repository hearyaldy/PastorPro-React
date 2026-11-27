# Project memory

The user requested that the React and Flutter synchronization fix plan be retained
and updated as sections are fixed. The persistent tracker is
`docs/SYNC_FIX_PLAN.md`. Read it before synchronization work and update it in the
same change whenever relevant implementation or verification progresses.

- Preserve existing user changes in both projects.
- Record completed work, validation results, remaining tasks, and blockers.
- Mark a phase complete only after its completion requirements are verified.
- Keep partially completed phases in progress and leave outstanding tasks unchecked.
- Use the existing Flutter data as the compatibility baseline, subject to checking
  actual stored records. Do not silently change the agreed shared data contract.
- This memory request does not authorize production migrations or deployment.

React repository: this directory.
Flutter repository: `../pastor_report-latest`.

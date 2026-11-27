export function unionSaveError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.endsWith('permission-denied')) {
    return 'Firebase denied this save. Union changes require an active Admin or Super Admin account and deployed Union permissions. Your entries have been kept.';
  }
  if (code.endsWith('unavailable')) {
    return 'Firebase is unavailable. Check your connection and try again. Your entries have been kept.';
  }
  return 'Could not save the union. Your entries have been kept. Please try again.';
}

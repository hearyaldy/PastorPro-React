/** A failed audit must not turn a successful write into a retry of that write. */
export async function saveWithOptionalAudit<T>(
  save: () => Promise<T>,
  audit: (saved: T) => Promise<void>,
): Promise<{ saved: T; auditResult: Promise<{ error?: unknown }> }> {
  const saved = await save();
  const auditResult = Promise.resolve().then(() => audit(saved)).then(
    () => ({}),
    (error: unknown) => ({ error }),
  );
  return { saved, auditResult };
}

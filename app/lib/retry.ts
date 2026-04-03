/**
 * Retries an async function up to `attempts` total tries with `delayMs` between each.
 * Logs a warning on each failure except the last, and a success log if a retry succeeds.
 * Throws the final error if all attempts fail.
 *
 * Note: all errors are retried regardless of whether they are transient. Deterministic
 * failures (bad input, RLS violations) will waste one retry attempt before failing
 * permanently. Acceptable trade-off for MVP simplicity.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  { attempts = 2, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {}
): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await fn();
      if (i > 1) {
        console.warn(`[${label}] Succeeded on retry (attempt ${i}/${attempts})`);
      }
      return result;
    } catch (err) {
      if (i < attempts) {
        console.warn(`[${label}] Attempt ${i}/${attempts} failed, retrying in ${delayMs}ms:`, err);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
  // Unreachable — satisfies TypeScript's return type
  throw new Error("unreachable");
}

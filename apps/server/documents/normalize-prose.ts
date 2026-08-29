// Deterministic safety net against the AI writing tell: repeated
// "- label — description" bullets (em dash as a label/description
// separator). The prompt guide asks the model to avoid this, but that's
// probabilistic — this normalizes it in code so the output is guaranteed
// consistent regardless of what the model actually produced.

const DASH_BULLET_RE = /^(\s*(?:[-*]|\d+\.)\s+.{2,80}?)[ \t]+—[ \t]+/gm;

/**
 * Rewrites "- label — description" into "- label: description" throughout
 * the document, but only if the pattern repeats at least 3 times — a single
 * or double occurrence is normal writing, not the AI tell we're guarding
 * against.
 */
export function normalizeDashBullets(text: string): string {
  const matches = text.match(DASH_BULLET_RE);
  if (!matches || matches.length < 3) return text;
  return text.replace(DASH_BULLET_RE, (_full, prefix: string) => `${prefix}: `);
}

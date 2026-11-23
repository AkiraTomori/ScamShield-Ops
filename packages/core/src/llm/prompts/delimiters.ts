/** Matches any delimiter-looking token, whatever its nonce, so content cannot fake a block edge. */
const DELIMITER_PATTERN = /<<<\s*\/?\s*(?:TIN_NHAN|HET|DU_LIEU)_[^>\n]{0,64}>>>/gi;

/**
 * Removes every delimiter-like token from user-controlled text before it is placed in a block.
 * Repeats until nothing changes: removing a token can join its neighbours into a new one
 * (`<<<HE<<<HET_x>>>T_n>>>`), which a single pass would leave behind. Each pass that changes the
 * text shortens it, so the loop always ends.
 */
export function stripDelimiters(text: string): string {
  let current = text;
  for (;;) {
    const next = current.replace(DELIMITER_PATTERN, "");
    if (next === current) return current;
    current = next;
  }
}

/** Keeps the nonce to a safe alphabet so it cannot itself break the block syntax. */
export function safeNonce(random: string): string {
  const cleaned = random.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  return cleaned === "" ? "0" : cleaned;
}

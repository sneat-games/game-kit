// Commit-reveal primitives, extracted from bidding-tictactoe/web/src/pvp/
// peer.ts. Used to hide a hidden-bid (and, for games that want it, a hidden
// move) from the opponent until both sides have committed:
//
//   1. Each peer sends { kind: "commit", hash: commitPayload(parts, salt) }.
//   2. Once BOTH commits are received, each peer sends
//      { kind: "reveal", ...parts, salt }.
//   3. Each peer recomputes commitPayload(revealedParts, salt) and checks it
//      equals the commit hash it received in step 1 — proof the reveal was
//      not chosen after seeing the opponent's commit.
//
// What goes into `parts` is entirely up to the caller: BTTT-style bidding
// (Hex) commits `[bid, cell]` so the move is fully hidden until reveal;
// auction-for-control (Dots & Boxes) commits `[bid]` alone, since the move
// itself is decided only after the auction resolves. The kit does not know
// or care — it only hashes and verifies whatever the game hands it.

/** SHA-256 hex digest of a UTF-8 string. Uses Web Crypto (available in both
 *  browsers and Node >=19 as a global). */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const out = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(out))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Random salt for one reveal. A fresh salt per turn is what makes the
 *  commit hash unguessable even for a low-entropy bid like 0. */
export function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The commitment hash for an arbitrary tuple of JSON-serialisable values
 * plus a salt. `parts` is serialised with `JSON.stringify`, so its order
 * and shape must be identical between the committer and the verifier —
 * callers should use a fixed, documented shape (e.g. always `[bid, cell]`)
 * rather than an object, so key order can never introduce a mismatch.
 */
export function commitPayload(parts: unknown[], salt: string): Promise<string> {
  return sha256Hex(`${JSON.stringify(parts)}|${salt}`);
}

/** Verify a revealed `(parts, salt)` pair against a previously received
 *  commitment hash. */
export async function verifyPayload(hash: string, parts: unknown[], salt: string): Promise<boolean> {
  const actual = await commitPayload(parts, salt);
  return actual === hash;
}

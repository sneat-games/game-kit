// BTTT's own peer.ts had no test file (a real WebRTC handshake is not
// practical to unit test, and this kit's version is no different — hostPeer/
// guestPeer/makeHandle all need a real RTCPeerConnection). `splitIceCandidates`
// is the exception: it is the actual fix for the bug this kit's peer.ts
// exists to correct over BTTT's (BTTT's version neither split multi-line ICE
// responses nor de-duplicated across polls — see peer.ts's module doc
// comment), and it is pure, so it gets full coverage here.
import { describe, it, expect } from "vitest";
import { splitIceCandidates } from "./peer.js";

describe("splitIceCandidates", () => {
  it("returns every line as new when nothing has been consumed yet", () => {
    const { newLines, total } = splitIceCandidates('{"a":1}\n{"a":2}', 0);
    expect(newLines).toEqual(['{"a":1}', '{"a":2}']);
    expect(total).toBe(2);
  });

  it("returns only the lines beyond what was already consumed", () => {
    // This is the actual fix: the relay's GET always returns the FULL
    // accumulated history, not just what's new, so re-parsing from the top
    // every time would re-add every candidate on every poll.
    const raw = '{"a":1}\n{"a":2}\n{"a":3}';
    const { newLines, total } = splitIceCandidates(raw, 2);
    expect(newLines).toEqual(['{"a":3}']);
    expect(total).toBe(3);
  });

  it("returns nothing new once fully consumed", () => {
    const raw = '{"a":1}\n{"a":2}';
    const { newLines, total } = splitIceCandidates(raw, 2);
    expect(newLines).toEqual([]);
    expect(total).toBe(2);
  });

  it("treats an empty response as zero candidates", () => {
    const { newLines, total } = splitIceCandidates("", 0);
    expect(newLines).toEqual([]);
    expect(total).toBe(0);
  });

  it("handles a single candidate (no newline at all)", () => {
    const { newLines, total } = splitIceCandidates('{"a":1}', 0);
    expect(newLines).toEqual(['{"a":1}']);
    expect(total).toBe(1);
  });

  it("drops a trailing empty line rather than counting it as a candidate", () => {
    // Defensive: the relay never actually produces a trailing "\n", but a
    // poller that did see one must not treat it as an unconsumed candidate.
    const { newLines, total } = splitIceCandidates('{"a":1}\n', 0);
    expect(newLines).toEqual(['{"a":1}']);
    expect(total).toBe(1);
  });
});

// BTTT's peer.ts shipped sha256Hex/newSalt/commitFor/verifyReveal without a
// dedicated test file; this kit exports them as public API, so they get one
// here.
import { describe, it, expect } from "vitest";
import { sha256Hex, newSalt, commitPayload, verifyPayload } from "./commit-reveal.js";

describe("sha256Hex", () => {
  it("matches a known SHA-256 vector", async () => {
    // echo -n "abc" | sha256sum
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is deterministic for the same input", async () => {
    expect(await sha256Hex("hello")).toBe(await sha256Hex("hello"));
  });

  it("differs for different input", async () => {
    expect(await sha256Hex("hello")).not.toBe(await sha256Hex("hellO"));
  });
});

describe("newSalt", () => {
  it("returns a 32-char hex string (16 random bytes)", () => {
    const s = newSalt();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is different on each call", () => {
    const seen = new Set(Array.from({ length: 20 }, () => newSalt()));
    expect(seen.size).toBe(20);
  });
});

describe("commitPayload / verifyPayload", () => {
  it("verifies a matching reveal", async () => {
    const salt = newSalt();
    const hash = await commitPayload([7, 4], salt);
    expect(await verifyPayload(hash, [7, 4], salt)).toBe(true);
  });

  it("rejects a tampered part", async () => {
    const salt = newSalt();
    const hash = await commitPayload([7, 4], salt);
    expect(await verifyPayload(hash, [8, 4], salt)).toBe(false);
  });

  it("rejects a tampered salt", async () => {
    const salt = newSalt();
    const hash = await commitPayload([7, 4], salt);
    expect(await verifyPayload(hash, [7, 4], newSalt())).toBe(false);
  });

  it("supports a single-value payload (bid only, as used for auction-for-control)", async () => {
    const salt = newSalt();
    const hash = await commitPayload([12], salt);
    expect(await verifyPayload(hash, [12], salt)).toBe(true);
    expect(await verifyPayload(hash, [13], salt)).toBe(false);
  });

  it("supports opaque object parts (games choose what is public at commit time)", async () => {
    const salt = newSalt();
    const parts = [{ bid: 5 }, { cell: 4 }];
    const hash = await commitPayload(parts, salt);
    expect(await verifyPayload(hash, parts, salt)).toBe(true);
    expect(await verifyPayload(hash, [{ bid: 5 }, { cell: 5 }], salt)).toBe(false);
  });
});

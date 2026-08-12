// Ported from bidding-tictactoe/web/src/pvp/room.test.ts, plus new coverage
// for `reserveRoomId`'s gameId-namespacing and 409 retry (BTTT's own room.ts
// had no relay-facing test at all).
import { describe, it, expect, vi, afterEach } from "vitest";
import { newRoomId, roomIdFromLocation, shareLinkFor, reserveRoomId, ROOM_ID_LENGTH } from "./room.js";

describe("room ids", () => {
  it("newRoomId is the right length and alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const id = newRoomId();
      expect(id).toHaveLength(ROOM_ID_LENGTH);
      expect(/^[A-HJ-NP-Z2-9]{6}$/.test(id)).toBe(true);
    }
  });

  it("roomIdFromLocation reads #room=... from the href", () => {
    expect(roomIdFromLocation("https://hex.sneat.games/#room=ABC234")).toBe("ABC234");
  });

  it("returns null when there is no room fragment", () => {
    expect(roomIdFromLocation("https://hex.sneat.games/")).toBeNull();
  });

  it("returns null when the code is malformed (bad alphabet or wrong length)", () => {
    expect(roomIdFromLocation("https://hex.sneat.games/#room=ABC1")).toBeNull(); // length 4
    expect(roomIdFromLocation("https://hex.sneat.games/#room=ABC23O")).toBeNull(); // contains 'O'
    expect(roomIdFromLocation("https://hex.sneat.games/#room=abc234")).toBeNull(); // lowercase
  });

  it("shareLinkFor builds a URL ending with the room fragment", () => {
    expect(shareLinkFor("https://hex.sneat.games", "ABC234")).toBe(
      "https://hex.sneat.games/#room=ABC234",
    );
    expect(shareLinkFor("https://hex.sneat.games/", "ABC234")).toBe(
      "https://hex.sneat.games/#room=ABC234",
    );
  });
});

describe("reserveRoomId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /reserve/{gameId}/{roomId} on the given relayBase and returns the id on success", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        return new Response(null, { status: 200 });
      }),
    );
    const id = await reserveRoomId({ gameId: "hex", relayBase: "http://localhost:8787" });
    expect(id).toHaveLength(ROOM_ID_LENGTH);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(`POST http://localhost:8787/reserve/hex/${id}`);
  });

  it("retries on 409 with a fresh code each time", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts++;
        return new Response(null, { status: attempts < 3 ? 409 : 200 });
      }),
    );
    const id = await reserveRoomId({ gameId: "dots-and-boxes", relayBase: "http://localhost:8787" });
    expect(attempts).toBe(3);
    expect(id).toHaveLength(ROOM_ID_LENGTH);
  });

  it("gives up after MAX_RETRY (10) consecutive 409s", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts++;
        return new Response(null, { status: 409 });
      }),
    );
    await expect(reserveRoomId({ gameId: "hex", relayBase: "http://localhost:8787" })).rejects.toThrow();
    expect(attempts).toBe(10);
  });

  it("throws immediately on a non-409 error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    await expect(reserveRoomId({ gameId: "hex", relayBase: "http://localhost:8787" })).rejects.toThrow(/500/);
  });
});

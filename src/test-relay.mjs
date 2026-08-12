#!/usr/bin/env node
// In-memory mimic of webrtc-relay/index.ts's routes, for local dev and
// Playwright e2e tests. Games point their Playwright webServer at this
// instead of standing up the real Cloudflare Worker + KV namespace.
//
// Same route shapes and gameId/roomId namespacing as the real relay:
//   POST   /reserve/{gameId}/{roomId}                 -> 200 | 409 | 400
//   POST   /signal/{gameId}/{roomId}/{role}/{type}     -> publish (ICE appends)
//   GET    /signal/{gameId}/{roomId}/{role}/{type}     -> read what {role} published
//   DELETE /signal/{gameId}/{roomId}                   -> tear the room down
//
// Two deliberate simplifications versus the real relay, both safe for a
// test double: everything lives in a plain in-memory Map (no KV, no TTL —
// the process exits when the test run ends), and offer/answer GETs return
// 404 immediately when nothing has been posted yet rather than long-polling
// for ~25s. peer.ts already retries client-side on a 404/empty response, so
// behaviour is unchanged — this just keeps local test runs fast.
//
// No dependencies; runs directly under node. CLI: `node test-relay.mjs
// [port]` (default 8787). Logs one line per request.

import { createServer } from "node:http";

const PORT = Number(process.argv[2]) || 8787;
const GAME_ID_RE = /^[a-z0-9_-]{1,32}$/i;
const ROOM_ID_RE = /^[A-HJ-NP-Z2-9]{6}$/;

/** `${gameId}:${roomId}` -> true, for reserved rooms. */
const rooms = new Set();
/** `${role}:${type}:${gameId}:${roomId}` -> string (ICE values are
 *  newline-appended, matching the real relay). */
const store = new Map();

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...CORS_HEADERS, ...extraHeaders });
  res.end(body ?? undefined);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "content-type": "application/json" });
}

function isValidId(gameId, roomId) {
  return GAME_ID_RE.test(gameId) && ROOM_ID_RE.test(roomId);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  console.log(`${req.method} ${url.pathname}`);

  try {
    if (req.method === "OPTIONS") return send(res, 204);

    const p = url.pathname.split("/").filter(Boolean);

    // POST /reserve/{gameId}/{roomId}
    if (p[0] === "reserve") {
      if (req.method !== "POST" || p.length !== 3) return sendJson(res, 404, { error: "route not found" });
      const gameId = decodeURIComponent(p[1]);
      const roomId = decodeURIComponent(p[2]);
      if (!isValidId(gameId, roomId)) return sendJson(res, 400, { error: "invalid gameId or roomId format" });
      const key = `${gameId}:${roomId}`;
      if (rooms.has(key)) return sendJson(res, 409, { error: "room id already taken" });
      rooms.add(key);
      store.set(`host:offer:${gameId}:${roomId}`, "");
      return sendJson(res, 200, { gameId, roomId });
    }

    if (p[0] === "signal") {
      // DELETE|POST|GET /signal/{gameId}/{roomId}  (teardown; path length 3)
      if (p.length === 3) {
        const gameId = decodeURIComponent(p[1]);
        const roomId = decodeURIComponent(p[2]);
        if (!isValidId(gameId, roomId)) return sendJson(res, 400, { error: "invalid gameId or roomId format" });
        if (req.method !== "DELETE") return sendJson(res, 405, { error: "method not allowed" });
        rooms.delete(`${gameId}:${roomId}`);
        for (const role of ["host", "guest"]) {
          for (const type of ["offer", "answer", "ice"]) {
            store.delete(`${role}:${type}:${gameId}:${roomId}`);
          }
        }
        return send(res, 204);
      }

      // POST|GET /signal/{gameId}/{roomId}/{role}/{type}
      if (p.length === 5) {
        const gameId = decodeURIComponent(p[1]);
        const roomId = decodeURIComponent(p[2]);
        const role = p[3];
        const type = p[4];
        if (role !== "host" && role !== "guest") return sendJson(res, 404, { error: "route not found" });
        if (type !== "offer" && type !== "answer" && type !== "ice") {
          return sendJson(res, 404, { error: "route not found" });
        }
        if (!isValidId(gameId, roomId)) return sendJson(res, 400, { error: "invalid gameId or roomId format" });
        if (!rooms.has(`${gameId}:${roomId}`)) return sendJson(res, 404, { error: "room not found or expired" });

        const key = `${role}:${type}:${gameId}:${roomId}`;
        if (req.method === "POST") {
          const body = await readBody(req);
          if (type === "ice") {
            const prev = store.get(key);
            store.set(key, prev ? `${prev}\n${body}` : body);
          } else {
            store.set(key, body);
          }
          return send(res, 204);
        }
        if (req.method === "GET") {
          const v = store.get(key);
          if (!v) return send(res, 404);
          return send(res, 200, v, { "content-type": "text/plain" });
        }
        return sendJson(res, 405, { error: "method not allowed" });
      }
    }

    return sendJson(res, 404, { error: "route not found" });
  } catch (e) {
    console.error("test-relay error:", e);
    return sendJson(res, 500, { error: "internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`test-relay listening on http://localhost:${PORT}`);
});

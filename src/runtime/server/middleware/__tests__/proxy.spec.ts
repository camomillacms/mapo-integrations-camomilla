import { describe, it, expect, vi, beforeEach } from "vitest";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { createEvent } from "h3";
import { CAMOMILLA_USER_CURRENT_PATH } from "../../../constants";

vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: () => ({ camomilla: { server: "http://django:8000" } }),
}));

// Imported after vi.mock (hoisted by vitest) so the runtime config is stubbed.
import proxy from "../proxy";

/**
 * Builds the event shape h3 hands a server middleware mounted at `app.baseURL`
 * (h3 1.15.11 dist/index.mjs:1994-2016): `originalUrl` keeps the full wire target,
 * `req.url` is base-stripped and still percent-encoded.
 */
function eventUnderBase(rawTarget: string, base = "/backoffice") {
  const req = new IncomingMessage(new Socket());
  req.method = "GET";
  req.url = rawTarget;
  (req as IncomingMessage & { originalUrl?: string }).originalUrl =
    base + rawTarget;
  req.headers.host = "localhost:3000";
  return createEvent(req, new ServerResponse(req));
}

/**
 * Same event, but with a method and a body already attached — `readRawBody`
 * reads `req.rawBody` when it is set, so nothing waits on a stream that a
 * synthetic socket never ends.
 */
function eventWithMethod(method: string, target = "/api/camomilla/articles/") {
  const req = new IncomingMessage(new Socket());
  req.method = method;
  req.url = target;
  req.headers.host = "localhost:3000";
  (req as IncomingMessage & { rawBody?: Buffer }).rawBody =
    Buffer.from("payload");
  return createEvent(req, new ServerResponse(req));
}

describe("proxy middleware", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.reject(new Error("upstream down")));
    vi.stubGlobal("fetch", fetchMock);
  });

  it("still matches /api when the app is deployed under app.baseURL", async () => {
    await proxy(eventUnderBase("/api/profiles/me"));

    expect(fetchMock).toHaveBeenCalledWith(
      `http://django:8000${CAMOMILLA_USER_CURRENT_PATH}`,
      expect.anything(),
    );
  });

  // Regression guard: the path must be normalised BEFORE the /api check, or a dot
  // segment walks out of the allowlist and reaches the backend as "/adminlotrek/".
  it("rejects dot segments that escape the /api prefix", async () => {
    await proxy(eventUnderBase("/api/%2e%2e/adminlotrek/"));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Regression guard: an encoded "?" must stay in the path, not split the query.
  it("keeps percent-encoding in the proxied path", async () => {
    await proxy(eventUnderBase("/api/camomilla/pages/foo%3Fbar/"));

    expect(fetchMock).toHaveBeenCalledWith(
      "http://django:8000/api/camomilla/pages/foo%3Fbar/",
      expect.anything(),
    );
  });

  // Regression guard: `readRawBody` asserts the method against h3's PayloadMethods
  // and throws 405 for everything else, so reading a body for "not GET/HEAD" broke
  // every OPTIONS call — which is how MapoDetail asks an endpoint to describe itself.
  it("proxies OPTIONS instead of 405ing on the body read", async () => {
    await proxy(eventWithMethod("OPTIONS"));

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("http://django:8000/api/camomilla/articles/");
    expect((call[1] as RequestInit).method).toBe("OPTIONS");
    expect((call[1] as RequestInit).body).toBeUndefined();
  });

  it("still forwards the body of a write", async () => {
    await proxy(eventWithMethod("POST"));

    const body = (fetchMock.mock.calls[0]![1] as RequestInit).body;
    expect(Buffer.from(body as Uint8Array).toString()).toBe("payload");
  });
});

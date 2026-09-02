import {
  defineEventHandler,
  getRequestHeaders,
  readRawBody,
  setResponseHeaders,
  setResponseStatus,
  appendResponseHeader,
  send,
  parseCookies,
} from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { applyPathRewrite } from "../utils/pathRewrite";
import {
  buildRequestCookies,
  processResponseCookies,
} from "../utils/cookieSync";
import type { CamomillaRuntimeConfig } from "../../../types";
import { CAMOMILLA_AUTH_PATHS } from "../../constants";

/**
 * Incoming headers not forwarded to upstream because they are hop-by-hop
 * or recalculated by `fetch` for the outgoing proxied request.
 */
const SKIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "content-length",
]);

/**
 * Methods whose body h3 will hand over.
 *
 * An allowlist, not "everything except GET/HEAD": `readRawBody` runs
 * `assertMethod` against exactly this list and throws 405 for anything else, so
 * asking it for an OPTIONS body killed the request before it was ever proxied.
 * OPTIONS is how MapoDetail reads `lang_info` and the form `schema`, so the
 * whole describe-the-endpoint path 405'd behind this proxy.
 */
const PAYLOAD_METHODS = new Set(["PATCH", "POST", "PUT", "DELETE"]);

/**
 * Upstream response headers dropped before forwarding.
 *
 * `fetch` transparently decodes the upstream body (gzip/br/deflate), so the
 * body we forward is already decompressed: passing the original
 * `content-encoding` through would make the browser try to decode plain bytes
 * and fail. `content-length` is dropped for the same reason — it describes the
 * compressed payload. Both are recomputed by Nitro when it sends the response.
 * The rest are hop-by-hop headers that must not be proxied.
 */
const SKIP_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

/**
 * API proxy middleware for Camomilla integration.
 *
 * Flow overview:
 * - Intercepts eligible `/api/*` requests.
 * - Rewrites path according to built-in and custom rules.
 * - Forwards request headers/body and normalized cookies.
 * - Proxies to configured Camomilla backend.
 * - Rewrites/aliases Set-Cookie headers on auth paths.
 * - Returns backend status, headers, and raw response body.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event).camomilla as CamomillaRuntimeConfig;
  const {
    server,
    base = "",
    syncCamomillaSession = false,
    pathRewrite: customPathRewrite = {},
    forwardedHeaders = [],
    skipPaths = [],
  } = config;

  // `event.node.req.url` is the app-relative, still-percent-encoded request target:
  // h3 has already stripped `app.baseURL` from it (dist/index.mjs:2016).
  //
  // `getRequestURL()` must NOT be used here — it prefers `req.originalUrl`, which
  // Nitro captures BEFORE that strip, so on a sub-path deploy
  // (`app: { baseURL: "/backoffice/" }`) it yields "/backoffice/api/…", the `/api`
  // guard below never matches, and every proxied call — login included — falls
  // through to the page router and 404s.
  //
  // `event.path` is not a substitute either: h3 percent-decodes it, so an encoded
  // "?" in a permalink would split as a query separator, and it leaves dot segments
  // unresolved — which would let "/api/../x" past the guard below and reach the
  // backend as "/x". Parsing through `URL` keeps the encoding and normalises both.
  const url = new URL(
    (event.node.req.url || event.path).replace(/^[/\\]+/g, "/"),
    "http://nitro.internal",
  );

  // Only intercept /api paths; anything served by the Nuxt app itself
  // (internal routes, local server routes, mocks) stays local.
  if (!url.pathname.startsWith("/api")) return;
  if (skipPaths.some((prefix) => url.pathname.startsWith(prefix))) return;

  const rewrittenPath = applyPathRewrite(url.pathname, base, customPathRewrite);
  const targetUrl = `${server}${rewrittenPath}${url.search}`;

  // --- Request cookies ---
  const cookies = parseCookies(event);
  const { cookieHeader, csrfToken } = buildRequestCookies(
    cookies,
    url.pathname,
    syncCamomillaSession,
  );

  // --- Build forwarded headers ---
  const incomingHeaders = getRequestHeaders(event);
  const requestHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (SKIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    if (value !== undefined) requestHeaders[key] = value;
  }

  requestHeaders["cookie"] = cookieHeader;
  if (csrfToken) requestHeaders["x-csrftoken"] = csrfToken;

  // Forward X-Forwarded-Host / Proto from referer (same logic as old middleware)
  try {
    const refererStr = incomingHeaders["referer"];
    if (refererStr) {
      const referer = new URL(refererStr);
      requestHeaders["x-forwarded-host"] = referer.host;
      requestHeaders["x-forwarded-proto"] = referer.protocol.replace(/:$/, "");
    }
  } catch {
    /* invalid referer URL — skip forwarding */
  }

  // Forward any extra headers configured by the user
  for (const header of forwardedHeaders) {
    const val = incomingHeaders[header.toLowerCase()];
    if (val) requestHeaders[header.toLowerCase()] = val;
  }

  // --- Proxy the request ---
  const method = event.method;
  // `false` returns a Buffer; the default ("utf8") would decode binary bodies and
  // corrupt every multipart upload.
  const rawBody = PAYLOAD_METHODS.has(method)
    ? await readRawBody(event, false)
    : undefined;
  // `fetch` accepts a Buffer at runtime, but the DOM lib types `BufferSource` as
  // `ArrayBufferView<ArrayBuffer>` while Node types `Buffer` as
  // `Uint8Array<ArrayBufferLike>` — the wider generic also admits
  // `SharedArrayBuffer`, so it is rejected. `readRawBody` always builds the
  // Buffer with `Buffer.concat`/`Buffer.from`, which allocate over a plain
  // `ArrayBuffer`, so narrowing the generic is safe and copies nothing.
  const body = rawBody as Uint8Array<ArrayBuffer> | undefined;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body,
    });
  } catch (err) {
    setResponseStatus(event, 502, "Bad Gateway");
    return send(
      event,
      `[mapo/camomilla] Proxy error: ${(err as Error).message}`,
    );
  }

  // --- Forward response headers (set-cookie handled separately below) ---
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (!SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });
  setResponseHeaders(event, responseHeaders);
  setResponseStatus(event, response.status, response.statusText);

  // --- Process Set-Cookie (auth sync) ---
  const rawSetCookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : (response.headers.get("set-cookie") ?? "").split(",").filter(Boolean);

  const isAuthPath = CAMOMILLA_AUTH_PATHS.some((p) =>
    rewrittenPath.startsWith(p),
  );
  const processedCookies = processResponseCookies(
    rawSetCookies,
    isAuthPath,
    syncCamomillaSession,
  );
  for (const cookie of processedCookies) {
    appendResponseHeader(event, "set-cookie", cookie);
  }

  return send(event, Buffer.from(await response.arrayBuffer()));
});

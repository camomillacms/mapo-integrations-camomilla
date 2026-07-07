import {
  defineEventHandler,
  getRequestURL,
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
  } = config;

  const url = getRequestURL(event);

  // Only intercept /api paths, but skip Nuxt-internal and local mock routes
  if (!url.pathname.startsWith("/api")) return;
  if (url.pathname.startsWith("/api/_nuxt_icon")) return;
  if (url.pathname.startsWith("/api/mock")) return;

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
  const body = ["GET", "HEAD"].includes(method)
    ? undefined
    : await readRawBody(event);

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

  // --- Forward response headers (excluding set-cookie, handled separately) ---
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") responseHeaders[key] = value;
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

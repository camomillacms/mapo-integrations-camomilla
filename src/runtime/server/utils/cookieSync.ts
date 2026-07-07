import {
  CAMOMILLA_COOKIES,
  CSRF_COOKIE,
  DJANGO_SESSION_COOKIE,
  MAPO_AUTH_LOGIN_PATH,
  MAPO_AUTH_LOGOUT_PATH,
  MAPO_SESSION_COOKIE,
} from "../../constants";

export interface RequestCookieResult {
  /** Serialized Cookie header sent to the proxied backend request. */
  cookieHeader: string;
  /** CSRF token extracted from cookies for X-CSRFToken header forwarding. */
  csrfToken: string | undefined;
}

/**
 * Prepares cookies for the outgoing proxied request.
 *
 * - Strips cookies not in CAMOMILLA_COOKIES
 * - Maps MAPO_SESSION_COOKIE → DJANGO_SESSION_COOKIE so Camomilla recognises its own Django cookie
 * - Adds X-CSRFToken from csrftoken cookie (except on login where the session is being reset)
 * - On login: clears session cookies so Django issues a fresh one
 */
export function buildRequestCookies(
  cookies: Record<string, string>,
  pathname: string,
  syncSession: boolean,
): RequestCookieResult {
  const isLogin = pathname.includes(MAPO_AUTH_LOGIN_PATH);
  const isLogout = pathname.includes(MAPO_AUTH_LOGOUT_PATH);

  const filtered: Record<string, string> = Object.fromEntries(
    Object.entries(cookies).filter(([k]) =>
      (CAMOMILLA_COOKIES as readonly string[]).includes(k),
    ),
  );

  if (isLogin) {
    delete filtered[DJANGO_SESSION_COOKIE];
    delete filtered[MAPO_SESSION_COOKIE];
    delete filtered[CSRF_COOKIE];
  } else {
    if (filtered[MAPO_SESSION_COOKIE]) {
      filtered[DJANGO_SESSION_COOKIE] = filtered[MAPO_SESSION_COOKIE]!;
    }
    if (!syncSession && !isLogout) {
      delete filtered[DJANGO_SESSION_COOKIE];
      if (filtered[MAPO_SESSION_COOKIE])
        filtered[DJANGO_SESSION_COOKIE] = filtered[MAPO_SESSION_COOKIE]!;
    }
  }

  const csrfToken = !isLogin ? filtered[CSRF_COOKIE] : undefined;
  const cookieHeader = Object.entries(filtered)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  return { cookieHeader, csrfToken };
}

interface ParsedCookie {
  /** Cookie name. */
  name: string;
  /** Cookie value. */
  value: string;
  /** Original Set-Cookie header string. */
  raw: string;
  /** Raw attributes string (Path, HttpOnly, SameSite, etc.). */
  attributes: string;
}

/**
 * Parses a single Set-Cookie header into structured fields.
 */
function parseSetCookie(raw: string): ParsedCookie {
  const parts = raw.split(";");
  const [nameValue, ...attrParts] = parts;
  const eqIdx = nameValue!.indexOf("=");
  const name = nameValue!.slice(0, eqIdx).trim();
  const value = nameValue!.slice(eqIdx + 1).trim();
  return { name, value, raw, attributes: attrParts.join(";") };
}

/**
 * Serializes cookie name/value and attributes to a Set-Cookie header string.
 */
function serializeCookie(
  name: string,
  value: string,
  attributes: string,
): string {
  return `${name}=${value};${attributes}`;
}

/**
 * Processes Set-Cookie headers from the Camomilla response on auth paths.
 *
 * - On login: aliases DJANGO_SESSION_COOKIE as MAPO_SESSION_COOKIE so Mapo's auth layer picks it up
 * - When syncSession=false: strips the raw DJANGO_SESSION_COOKIE (Mapo uses MAPO_SESSION_COOKIE only)
 * - On logout: clears both cookies
 */
export function processResponseCookies(
  setCookieHeaders: string[],
  isAuthPath: boolean,
  syncSession: boolean,
): string[] {
  if (!isAuthPath || setCookieHeaders.length === 0) return setCookieHeaders;

  const parsed = setCookieHeaders.map(parseSetCookie);
  const result: ParsedCookie[] = [...parsed];

  const sessionCookie = parsed.find((c) => c.name === DJANGO_SESSION_COOKIE);
  const hasMapoSession = parsed.some((c) => c.name === MAPO_SESSION_COOKIE);

  if (sessionCookie && !hasMapoSession) {
    result.push({ ...sessionCookie, name: MAPO_SESSION_COOKIE });
  }

  return result
    .filter((c) => syncSession || c.name !== DJANGO_SESSION_COOKIE)
    .map((c) => serializeCookie(c.name, c.value, c.attributes));
}

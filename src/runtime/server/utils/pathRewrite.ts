import type { CamomillaPathRewrite } from "../../../types";
import {
  CAMOMILLA_AUTH_LOGIN_PATH,
  CAMOMILLA_AUTH_LOGOUT_PATH,
  CAMOMILLA_MEDIA_FOLDERS_PATH,
  CAMOMILLA_MEDIA_PATH,
  CAMOMILLA_USER_CURRENT_PATH,
  MAPO_AUTH_LOGIN_PATH,
  MAPO_AUTH_LOGOUT_PATH,
  MAPO_USER_INFO_PATH,
} from "../../constants";

/**
 * Builds built-in API rewrite rules used by the Camomilla proxy.
 *
 * @param base Optional app base path prefix.
 * @returns Default regex rewrite map applied as fallback for unmatched paths.
 */
export function buildDefaultRewrites(base: string): CamomillaPathRewrite {
  const b = base
    ? (base.startsWith("/") ? base : "/" + base).replace(/\/+$/, "")
    : "";
  return {
    [`^${b}${MAPO_AUTH_LOGIN_PATH}`]: CAMOMILLA_AUTH_LOGIN_PATH,
    [`^${b}${MAPO_AUTH_LOGOUT_PATH}`]: CAMOMILLA_AUTH_LOGOUT_PATH,
    [`^${b}${MAPO_USER_INFO_PATH}`]: CAMOMILLA_USER_CURRENT_PATH,
    // media-folders before media to avoid greedy match
    [`^${b}/api/media-folders`]: CAMOMILLA_MEDIA_FOLDERS_PATH,
    [`^${b}/api/media`]: CAMOMILLA_MEDIA_PATH,
    [`^${b}/api`]: "/api",
  };
}

/**
 * Rewrites a request pathname according to custom and default rules.
 *
 * Custom rewrites are evaluated FIRST to take precedence; built-in rewrites
 * serve as fallback for unmatched paths. The output path is normalized to
 * avoid accidental duplicated slashes.
 *
 * @param pathname Incoming request pathname.
 * @param base Optional app base path prefix.
 * @param customRewrites User-provided rewrite map.
 * @returns Rewritten path (or original path when no rule matches).
 */
export function applyPathRewrite(
  pathname: string,
  base: string,
  customRewrites: CamomillaPathRewrite,
): string {
  const normalize = (path: string) => path.replace(/([^:]\/)\/+/g, "$1");
  const tryRewrite = (rewrites: CamomillaPathRewrite) => {
    for (const [pattern, replacement] of Object.entries(rewrites)) {
      const regex = new RegExp(pattern);
      if (regex.test(pathname)) {
        return normalize(pathname.replace(regex, replacement));
      }
    }
    return null;
  };

  // Evaluate custom rules first so they take precedence, including exact-key overrides.
  const custom = tryRewrite(customRewrites);
  if (custom) return custom;

  const fallback = tryRewrite(buildDefaultRewrites(base));
  if (fallback) return fallback;

  return pathname;
}

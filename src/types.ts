/**
 * Path rewrite rules where key is a regex pattern string and value is the
 * replacement path applied by the proxy middleware.
 */
export interface CamomillaPathRewrite {
  [pattern: string]: string;
}

export interface CamomillaOptions {
  /** URL of the Camomilla CMS backend, e.g. "http://localhost:8000" */
  server: string;
  /** API base prefix used by the Nuxt app, e.g. "" or "myapp". Defaults to "". */
  base?: string;
  /** When true, a login on Django admin also logs in Mapo and vice-versa (shared sessionid). */
  syncCamomillaSession?: boolean;
  /** Extra request headers to forward to the Camomilla server. */
  forwardedHeaders?: string[];
  /** Custom path rewrites merged after the built-in ones. Key = regex string, value = replacement. */
  pathRewrite?: CamomillaPathRewrite;
  /**
   * `/api/*` prefixes the proxy must NOT intercept, so they keep being served
   * by the Nuxt app itself (own server routes, local mocks…).
   *
   * The values configured here are appended to the built-in defaults
   * (`/api/_nuxt_icon`, `/api/mock`) rather than replacing them.
   *
   * @example
   * camomilla: { skipPaths: ['/api/webhooks'] }
   */
  skipPaths?: string[];
}

/** Shape stored in runtimeConfig (private, server-only). */
export type CamomillaRuntimeConfig = Required<CamomillaOptions>;

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
  /**
   * Extra path prefix that is really present in the incoming request path.
   * It is prepended to every built-in rewrite pattern (a leading "/" is added
   * if missing, trailing ones are stripped), e.g. "" or "myapp". Defaults to "".
   *
   * NOT the Nuxt router base (`app.baseURL`): h3 has already stripped that from
   * the request target the proxy reads, so setting it here makes every built-in
   * rewrite expect a prefix that is no longer there and nothing matches.
   */
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
  /**
   * Register the Camomilla media adapter (`$mapoMediaAdapter`), which maps the
   * Media Manager's canonical params to Camomilla's dialect: the mime filter to
   * `fltr`, folder payloads to `title`/`slug`/`updir`, media detail reads to
   * `language_code`, and file replacement to `same_url`.
   *
   * Defaults to true. Set false to keep uikit's plain-REST default adapter,
   * which Camomilla ignores — its `mime` param does not exist server-side.
   */
  mediaAdapter?: boolean;
}

/**
 * Shape stored in runtimeConfig (private, server-only).
 *
 * `mediaAdapter` is build-time only: it decides whether a plugin is registered,
 * so it never reaches the running server.
 */
export type CamomillaRuntimeConfig = Required<
  Omit<CamomillaOptions, "mediaAdapter">
>;

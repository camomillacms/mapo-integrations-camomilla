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
}

/** Shape stored in runtimeConfig (private, server-only). */
export type CamomillaRuntimeConfig = Required<CamomillaOptions>;

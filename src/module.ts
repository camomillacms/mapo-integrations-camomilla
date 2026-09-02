import {
  defineNuxtModule,
  addServerHandler,
  addPlugin,
  createResolver,
} from "@nuxt/kit";
import type { NuxtModule } from "@nuxt/schema";
import type { CamomillaOptions } from "./types";
import { PROXY_SKIP_PATHS } from "./runtime/constants";

/** Public module option type export. */
export type { CamomillaOptions } from "./types";

/**
 * Nuxt module that proxies Mapo API requests to a Camomilla backend.
 *
 * It stores private runtime configuration under `runtimeConfig.camomilla`
 * and registers a server middleware that intercepts `/api/*` calls, applies
 * path rewrites, forwards headers/cookies, and returns proxied responses.
 */
export default defineNuxtModule<CamomillaOptions>({
  meta: {
    name: "mapo-integrations-camomilla",
    configKey: "camomilla",
  },

  defaults: {
    server: "http://localhost:8000",
    base: "",
    syncCamomillaSession: false,
    forwardedHeaders: [],
    pathRewrite: {},
    skipPaths: [],
    mediaAdapter: true,
  },

  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url);

    // Expose config server-side only (contains backend URL — not public)
    nuxt.options.runtimeConfig.camomilla = {
      server: options.server,
      base: options.base ?? "",
      syncCamomillaSession: options.syncCamomillaSession ?? false,
      forwardedHeaders: options.forwardedHeaders ?? [],
      pathRewrite: options.pathRewrite ?? {},
      // User prefixes extend the built-ins instead of replacing them, so a
      // consumer adding its own skip cannot accidentally proxy Nuxt internals.
      skipPaths: [...PROXY_SKIP_PATHS, ...(options.skipPaths ?? [])],
    };

    // Server middleware: intercepts /api/* and proxies to Camomilla
    addServerHandler({
      middleware: true,
      handler: resolver.resolve("./runtime/server/middleware/proxy"),
    });

    // Client plugin: provide $mapoMediaAdapter speaking Camomilla's dialect.
    // Ordered BEFORE uikit's fallback plugin (order 5): the first provider wins,
    // because Nuxt provides are non-configurable getters and uikit's plugin bails
    // out when `$mapoMediaAdapter` is already on the app.
    if (options.mediaAdapter !== false) {
      addPlugin({
        src: resolver.resolve("./runtime/plugins/media-adapter"),
        order: 4,
      });
    }
  },
}) satisfies NuxtModule<CamomillaOptions>;

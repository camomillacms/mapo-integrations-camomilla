import { defineNuxtModule, addServerHandler, createResolver } from "@nuxt/kit";
import type { NuxtModule } from "@nuxt/schema";
import type { CamomillaOptions } from "./types";

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
    };

    // Server middleware: intercepts /api/* and proxies to Camomilla
    addServerHandler({
      middleware: true,
      handler: resolver.resolve("./runtime/server/middleware/proxy"),
    });
  },
}) satisfies NuxtModule<CamomillaOptions>;

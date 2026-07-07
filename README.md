# mapo-integrations-[camomilla](https://github.com/camomillacms/camomilla-core) 🌼 
[![npm (scoped)](https://img.shields.io/npm/v/@mapomodule/mapo-integrations-camomilla?style=flat-square)](https://www.npmjs.com/package/@mapomodule/mapo-integrations-camomilla) [![GitHub](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE.md)

Mapo integration for [Camomilla CMS](https://github.com/camomillacms/camomilla-core). Implemented as a Nuxt module that adds a Nitro server middleware: every `/api/*` request is intercepted, path-rewritten to the matching Camomilla endpoint, and proxied to the backend with cookie/CSRF handling.

## Installation

```bash
pnpm add mapo-integrations-camomilla
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["mapomodule", "mapo-integrations-camomilla"],

  camomilla: {
    server: "http://localhost:8000",
    syncCamomillaSession: false,
    base: "",
    forwardedHeaders: [],
    pathRewrite: {}, // merged on top of the built-in rewrites
    changeOrigin: true,
  },
});
```

## What it does

- **Path rewriting**: `/api/auth/login` → `/api/camomilla/auth/login/`, `/api/profiles/me` → `/api/camomilla/users/current/`, `/api/media[-folders]` → `/api/camomilla/media[-folders]`. Custom rewrites can be added via the `pathRewrite` option.
- **Cookie sync**: maps Mapo's `__mapo_session` to Django's `sessionid` on outgoing requests, and aliases `sessionid` back to `__mapo_session` on auth-path responses.
- **CSRF**: forwards `csrftoken` as `X-CSRFToken` on every non-login request.
- **Forwarded headers**: optional whitelist of extra request headers to forward to the Camomilla backend.

## Source of truth

All cookie names and Mapo-side path constants live in [`src/constants.ts`](./src/constants.ts) — no magic strings in the proxy or cookie sync code.

## Dev workflow

```bash
pnpm dev:camomilla   # from monorepo root — watch mode
```

## Reference

See [docs/modules/camomilla](https://lotrekagency.github.io/mapo-new/modules/camomilla) for the full reference, and [docs/modules/integrations-howto](https://lotrekagency.github.io/mapo-new/modules/integrations-howto) if you want to write your own backend integration.

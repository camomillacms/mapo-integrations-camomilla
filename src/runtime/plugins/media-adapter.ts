/**
 * Camomilla media adapter — overrides the default `$mapoMediaAdapter` provided by
 * `@mapomodule/uikit` to speak Camomilla's media API dialect:
 *
 *   - mime filter     → `fltr=` (Camomilla filter syntax)
 *   - detail params   → `language_code` (per-language media metadata)
 *   - folder payloads → `{ title, slug, updir }` instead of `{ name, parent }`
 *   - folder reads    → normalized back to the canonical `{ name, parent, path }`
 *   - file replace    → `same_url` instead of `maintain_url`
 *
 * Registered BEFORE the uikit fallback plugin: the first `provide` wins (Nuxt
 * provides are non-configurable getters), so uikit skips its default when this
 * adapter is present. Mapo consumers fall back to the default adapter for any
 * method not implemented here. The structural types below avoid a hard
 * dependency on @mapomodule/uikit (this package is intentionally standalone —
 * same reason slugify is inlined instead of imported from @mapomodule/utils).
 */
import { defineNuxtPlugin } from "nuxt/app";

interface MediaListParamsContext {
  page?: number;
  search?: string;
  mime?: string | null;
  all?: boolean;
}

interface CanonicalFolder {
  id?: number;
  name?: string;
  parent?: number | null;
  path?: string;
  [key: string]: unknown;
}

interface CamomillaFolder {
  id: number;
  title?: string;
  slug?: string;
  updir?: number | null;
  path?: string;
  // Already-canonical fields pass through untouched (mock backends).
  name?: string;
  parent?: number | null;
  [key: string]: unknown;
}

interface MediaAdapter {
  buildListParams?(ctx: MediaListParamsContext): Record<string, unknown>;
  parseRootResponse?(raw: unknown): unknown;
  buildDetailParams?(ctx: { lang?: string }): Record<string, unknown>;
  buildFolderPayload?(folder: CanonicalFolder): Record<string, unknown>;
  buildReplaceFilePayload?(
    file: File,
    maintainUrl: boolean,
  ): Record<string, unknown>;
}

function slugify(str: string | null | undefined): string {
  let s = (str ?? "").trim().toLowerCase();
  const from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  const to = "aaaaeeeeiiiioooouuuunc------";
  for (let i = 0; i < from.length; i++) {
    s = s.replaceAll(from.charAt(i), to.charAt(i));
  }
  return s
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * The media manager's mime filter, in Camomilla's `fltr` syntax.
 *
 * The manager's own filters are globs — `image/*`, `video/*`, `audio/*`,
 * `application/*` — so an exact `mime_type=image/*` matches nothing at all:
 * no row stores the literal string. A glob has to become a prefix match on its
 * stem, keeping the slash so `application/*` cannot also catch some future
 * `applicationx/...`.
 *
 * A concrete type (a picker field passing `image/png`) still compares exactly.
 */
function mimeFilter(mime: string): string {
  return mime.endsWith("/*")
    ? `mime_type__startswith=${mime.slice(0, -1)}`
    : `mime_type=${mime}`;
}

/** Camomilla folders carry `title`/`updir`; the canonical shape is `name`/`parent`. */
function normalizeFolder(f: CamomillaFolder | null): CanonicalFolder | null {
  if (!f) return null;
  return {
    ...f,
    name: f.name ?? f.title ?? "",
    parent: f.parent ?? f.updir ?? null,
  };
}

/** Exported so the mapping can be unit-tested and composed by consumers. */
export const camomillaMediaAdapter: MediaAdapter = {
  buildListParams(ctx) {
    const params: Record<string, unknown> = {};
    if (ctx.page != null) params.page = ctx.page;
    if (ctx.search) params.search = ctx.search;
    if (ctx.all) params.all = true;
    if (ctx.mime) params.fltr = mimeFilter(ctx.mime);
    return params;
  },

  // Camomilla returns the canonical { media, folders, parent_folder } envelope,
  // but its folders speak the title/slug/updir dialect — normalize them.
  parseRootResponse(raw) {
    const data = raw as {
      media: unknown;
      folders?: CamomillaFolder[];
      parent_folder?: CamomillaFolder | null;
    };
    return {
      ...data,
      folders: (data.folders ?? []).map((f) => normalizeFolder(f)),
      parent_folder: normalizeFolder(data.parent_folder ?? null),
    };
  },

  buildDetailParams(ctx) {
    return ctx.lang ? { language_code: ctx.lang } : {};
  },

  buildFolderPayload(folder) {
    const payload: Record<string, unknown> = {
      title: folder.name,
      slug: slugify(folder.name),
      updir: folder.parent ?? null,
    };
    if (folder.id != null) payload.id = folder.id;
    return payload;
  },

  buildReplaceFilePayload(file, maintainUrl) {
    return { file, same_url: maintainUrl };
  },
};

export default defineNuxtPlugin(() => {
  return {
    provide: { mapoMediaAdapter: camomillaMediaAdapter },
  };
});

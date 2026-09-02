import { describe, it, expect, vi } from "vitest";

vi.mock("nuxt/app", () => ({
  defineNuxtPlugin: (fn: unknown) => fn,
}));

const { camomillaMediaAdapter } = await import("../media-adapter");

const listParams = (ctx: Parameters<
  NonNullable<typeof camomillaMediaAdapter.buildListParams>
>[0]) => camomillaMediaAdapter.buildListParams!(ctx);

describe("camomilla media adapter — mime filter", () => {
  // Camomilla has no `mime` query param; uikit's default adapter sends one and
  // the backend drops it, which is why every filter returned the whole library.
  it("translates the manager's globs into a prefix match", () => {
    expect(listParams({ mime: "image/*" }).fltr).toBe(
      "mime_type__startswith=image/",
    );
    expect(listParams({ mime: "application/*" }).fltr).toBe(
      "mime_type__startswith=application/",
    );
  });

  // The trailing slash matters: dropping it would let "application/*" also match
  // a future "applicationx/..." mime type.
  it("keeps the slash on the prefix", () => {
    expect(listParams({ mime: "video/*" }).fltr).toContain("video/");
  });

  it("compares a concrete type exactly", () => {
    expect(listParams({ mime: "image/png" }).fltr).toBe("mime_type=image/png");
  });

  it("sends no filter when nothing is selected", () => {
    expect(listParams({ mime: null }).fltr).toBeUndefined();
    expect(listParams({ page: 2, search: "logo", all: true })).toEqual({
      page: 2,
      search: "logo",
      all: true,
    });
  });
});

describe("camomilla media adapter — folder dialect", () => {
  it("normalizes title/updir to the canonical name/parent", () => {
    const parsed = camomillaMediaAdapter.parseRootResponse!({
      media: {},
      folders: [{ id: 1, title: "Loghi", updir: null }],
      parent_folder: { id: 2, title: "Root", updir: null },
    }) as { folders: { name: string }[]; parent_folder: { name: string } };

    expect(parsed.folders[0]!.name).toBe("Loghi");
    expect(parsed.parent_folder.name).toBe("Root");
  });

  it("writes folders back in Camomilla's dialect", () => {
    expect(camomillaMediaAdapter.buildFolderPayload!({ name: "Nuova Cartella" }))
      .toEqual({ title: "Nuova Cartella", slug: "nuova-cartella", updir: null });
  });

  it("replaces a file with same_url, not maintain_url", () => {
    const file = new File(["x"], "a.png");
    expect(camomillaMediaAdapter.buildReplaceFilePayload!(file, true)).toEqual({
      file,
      same_url: true,
    });
  });
});

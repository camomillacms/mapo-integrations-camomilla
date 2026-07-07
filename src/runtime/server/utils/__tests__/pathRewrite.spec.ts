import { describe, it, expect } from "vitest";
import { buildDefaultRewrites, applyPathRewrite } from "../pathRewrite";
import {
  CAMOMILLA_AUTH_LOGIN_PATH,
  CAMOMILLA_MEDIA_PATH,
} from "../../../constants";

describe("pathRewrite", () => {
  describe("buildDefaultRewrites", () => {
    it("should build default rewrites without base", () => {
      const rewrites = buildDefaultRewrites("");
      expect(rewrites).toHaveProperty("^/api/auth/login");
      expect(rewrites).toHaveProperty("^/api/media");
      expect(rewrites["^/api"]).toBe("/api");
    });

    it("should build default rewrites with base prefix", () => {
      const rewrites = buildDefaultRewrites("myapp");
      expect(rewrites).toHaveProperty("^/myapp/api/auth/login");
      expect(rewrites["^/myapp/api"]).toBe("/api");
    });

    it("should prioritize media-folders before media to avoid greedy match", () => {
      const rewrites = buildDefaultRewrites("");
      const entries = Object.entries(rewrites);
      const mediaFoldersIdx = entries.findIndex(([k]) =>
        k.includes("media-folders"),
      );
      const mediaIdx = entries.findIndex(
        ([k]) => k === "^/api/media" && !k.includes("folders"),
      );
      expect(mediaFoldersIdx).toBeLessThan(mediaIdx);
    });
  });

  describe("applyPathRewrite", () => {
    it("should apply custom rewrites before default rewrites (custom takes precedence)", () => {
      // Custom rule: /api/products -> /custom-products
      const customRewrites = {
        "^/api/products": "/custom-products",
      };
      // Without the fix (defaults first), /api/products would match ^/api -> /api
      // With the fix (custom first), /api/products matches custom first -> /custom-products
      const result = applyPathRewrite("/api/products", "", customRewrites);
      expect(result).toBe("/custom-products");
    });

    it("should fall back to default rewrites when no custom rule matches", () => {
      const customRewrites = {
        "^/api/products": "/custom-products",
      };
      const result = applyPathRewrite("/api/articles", "", customRewrites);
      expect(result).toBe("/api/articles");
    });

    it("should apply default auth login rewrite when no custom rule matches", () => {
      const customRewrites = {};
      const result = applyPathRewrite("/api/auth/login", "", customRewrites);
      expect(result).toBe(CAMOMILLA_AUTH_LOGIN_PATH);
    });

    it("should collapse double slashes introduced by replacements", () => {
      const customRewrites = {
        "^/api": "/my-api/",
      };
      const result = applyPathRewrite("/api/test", "", customRewrites);
      expect(result).toBe("/my-api/test");
    });

    it("should handle base prefix correctly", () => {
      const customRewrites = {};
      const result = applyPathRewrite(
        "/myapp/api/media",
        "myapp",
        customRewrites,
      );
      expect(result).toBe(CAMOMILLA_MEDIA_PATH);
    });

    it("should return original path when no rules match", () => {
      const customRewrites = {};
      const result = applyPathRewrite("/unknown/path", "", customRewrites);
      expect(result).toBe("/unknown/path");
    });

    it("should handle overlapping patterns: custom rule wins over default catch-all", () => {
      // This is the core fix validation: custom /api/* override must supersede default /api catch-all
      const customRewrites = {
        "^/api/special": "/special-endpoint",
      };
      // Even though default has ^/api -> /api, custom ^/api/special should match first
      const result = applyPathRewrite("/api/special", "", customRewrites);
      expect(result).toBe("/special-endpoint");
    });

    it("should preserve non-matching paths", () => {
      const customRewrites = {
        "^/api/custom": "/custom",
      };
      const result = applyPathRewrite("/other/path", "", customRewrites);
      expect(result).toBe("/other/path");
    });
  });
});

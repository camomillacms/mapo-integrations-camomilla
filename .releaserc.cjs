// semantic-release config, shared by `pnpm release` and `pnpm release:dry`.
//
// In a dry run we deliberately load ONLY the analysis plugins, so the preview
// computes the next version + notes WITHOUT touching npm or GitHub and without
// needing NPM_TOKEN. The publishing plugins (changelog, npm, git, github) are
// added only for a real release.
//
// Dry-run is detected from the semantic-release CLI flag (`--dry-run`), with an
// explicit env override (`DRY_RUN=true`) as a fallback.
const isDryRun =
  process.argv.includes("--dry-run") || process.env.DRY_RUN === "true";

const analysisPlugins = [
  "@semantic-release/commit-analyzer",
  "@semantic-release/release-notes-generator",
];

const publishPlugins = [
  ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
  "@semantic-release/npm",
  [
    "@semantic-release/git",
    {
      assets: ["CHANGELOG.md", "package.json"],
      message:
        "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
    },
  ],
  "@semantic-release/github",
];

module.exports = {
  branches: ["master", { name: "beta", prerelease: true, channel: "next" }],
  plugins: isDryRun ? analysisPlugins : [...analysisPlugins, ...publishPlugins],
};

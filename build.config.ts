import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: [
    { input: "src/module", name: "module" },
    { input: "src/index", name: "index" },
  ],
  declaration: true,
  rollup: {
    emitCJS: false,
  },
  externals: ["@nuxt/kit", "@nuxt/schema", "nuxt", "vue", "vue-router"],
});

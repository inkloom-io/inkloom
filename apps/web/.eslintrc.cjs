module.exports = {
  root: true,
  extends: ["@inkloom/eslint-config/next"],
  rules: {
    // Import boundary: core files must NEVER import from platform/
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/platform/**", "@platform/*"],
            message:
              "Core files must not import from platform/. See OSS_PLAN.md §3 'Adapter Pattern'.",
          },
        ],
      },
    ],
  },
};

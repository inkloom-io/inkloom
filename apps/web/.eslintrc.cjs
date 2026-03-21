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
  overrides: [
    {
      // BlockNote custom blocks use a `render` callback that acts as a React
      // component.  ESLint doesn't recognise the lowercase name, so the
      // rules-of-hooks rule fires false positives.
      files: ["components/editor/custom-blocks/**/*.tsx"],
      rules: {
        "react-hooks/rules-of-hooks": "off",
      },
    },
  ],
};

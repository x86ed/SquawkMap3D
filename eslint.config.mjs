import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/**", "out/**", "coverage/**", "docs/**", "node_modules/**"],
  },
];

export default eslintConfig;

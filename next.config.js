/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export for the feeder deploy (scripts/deploy-to-feeder.sh) — see
  // openspec/changes/deploy-to-feeder/design.md Decision 1. Produces `out/`,
  // plain HTML/CSS/JS, no Node/Next server process required to serve it.
  output: "export",
};

export default nextConfig;

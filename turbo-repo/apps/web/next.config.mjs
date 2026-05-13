import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx"],
  output: "standalone",
  // Required for npm workspace monorepo: trace dependencies from monorepo root
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  // Source maps in production for live debugging on the marketing site
  productionBrowserSourceMaps: true,
  transpilePackages: ["flowbite-react"],
};

export default withFlowbiteReact(nextConfig);

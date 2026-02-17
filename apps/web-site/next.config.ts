import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Required for npm workspace monorepo: trace dependencies from monorepo root
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  transpilePackages: ["flowbite-react"],
};

export default withFlowbiteReact(nextConfig);

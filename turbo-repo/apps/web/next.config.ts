import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["flowbite-react"],
};

export default withFlowbiteReact(nextConfig);

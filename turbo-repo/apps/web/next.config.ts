import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["flowbite-react"],
};

// Cast: the monorepo has two hoisted copies of "next" (root + apps/web) with
// slightly different NextConfig types; next-intl/plugin resolves the root's.
// Both are structurally the same config object at runtime.
export default withNextIntl(withFlowbiteReact(nextConfig) as Parameters<typeof withNextIntl>[0]);

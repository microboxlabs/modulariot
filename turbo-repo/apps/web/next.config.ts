import type { NextConfig } from "next";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["flowbite-react"],
};

// Apply Flowbite last so it resolves next-intl's config function before
// extending it. Applying next-intl last treats the function as an object and
// drops base settings such as `output: "standalone"`.
export default withFlowbiteReact(
  withNextIntl(nextConfig) as Parameters<typeof withFlowbiteReact>[0],
);

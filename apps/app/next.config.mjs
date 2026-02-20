import withMDX from "@next/mdx";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  // Required for npm workspace monorepo: trace dependencies from monorepo root
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
  basePath: "/app",
  // Enable source maps for production/staging debugging
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mintcargaimagenesprbfc3.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
  // ESM-only packages that Node.js loads natively on the server (no bundling)
  serverExternalPackages: ["pino", "pino-pretty"],
  // ESM-only packages that Turbopack must transpile for client bundles
  transpilePackages: ["@microboxlabs/miot-calendar-client"],
};

const mdxConfig = withMDX({
  extension: /\.mdx?$/,
});

export default withFlowbiteReact(mdxConfig(nextConfig));

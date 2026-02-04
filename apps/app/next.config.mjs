import withMDX from "@next/mdx";
import withFlowbiteReact from "flowbite-react/plugin/nextjs";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  // Required for pnpm monorepo: trace dependencies from monorepo root
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
  serverExternalPackages: ["pino", "pino-pretty"],
};

const mdxConfig = withMDX({
  extension: /\.mdx?$/,
});

export default withFlowbiteReact(mdxConfig(nextConfig));

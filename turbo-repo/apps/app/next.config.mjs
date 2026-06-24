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
  env: {
    // Expose basePath so client code can build asset URLs (e.g. /app/pagefind/pagefind.js)
    NEXT_PUBLIC_BASE_PATH: "/app",
  },
  // Dev-only: redirect the bare root to the app's basePath so opening
  // http://localhost:3050/ lands on /app instead of a 404. In production the
  // front load balancer already handles this, so we skip it there.
  // basePath: false keeps source/destination from being prefixed with /app.
  async redirects() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/",
        destination: "/app",
        basePath: false,
        permanent: false,
      },
    ];
  },
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
  transpilePackages: [
    "@microboxlabs/miot-calendar-client",
    "@microboxlabs/miot-calendar-ui",
  ],
};

const mdxConfig = withMDX({
  extension: /\.mdx?$/,
});

export default withFlowbiteReact(mdxConfig(nextConfig));

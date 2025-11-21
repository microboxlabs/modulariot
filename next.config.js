const withMDX = require("@next/mdx")({
  extension: /\.mdx?$/,
});
const withFlowbiteReact = require("flowbite-react/plugin/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  basePath: "/app",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mintcargaimagenesprbfc3.blob.core.windows.net',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ["pino", "pino-pretty"]
};

module.exports = withFlowbiteReact(withMDX(nextConfig));
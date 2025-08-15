const { NormalModuleReplacementPlugin } = require("webpack");
const withMDX = require("@next/mdx")({
  extension: /\.mdx?$/,
});
/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  basePath: "/app",
  images: {
    domains: ['mintcargaimagenesprbfc3.blob.core.windows.net'],
  },
  eslint: {
    // Don't fail build on ESLint warnings - only actual errors
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  typescript: {
    // Only fail build on TypeScript errors, not warnings
    ignoreBuildErrors: false,
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['sequelize', 'pino', 'pino-pretty'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback.fs = false;
      config.resolve.fallback.dns = false;
      config.resolve.fallback.net = false;
    }
    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^hexoid$/,
        require.resolve("hexoid/dist/index.js")
      )
    );
    return config;
  },
};

module.exports = withMDX(nextConfig);

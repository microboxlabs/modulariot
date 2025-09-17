const withMDX = require("@next/mdx")({
  extension: /\.mdx?$/,
});
const { NormalModuleReplacementPlugin } = require("webpack");

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  output: "standalone",
  basePath: "/app",
  images: {
    domains: ['mintcargaimagenesprbfc3.blob.core.windows.net'],
  },
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },
  typescript: {
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

    return config;
  },
};

module.exports = withMDX(nextConfig);
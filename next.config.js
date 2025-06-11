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

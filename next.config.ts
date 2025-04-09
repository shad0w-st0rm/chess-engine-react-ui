import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/~txg220006',
  assetPrefix: '/~txg220006',
  output: 'export',
  optimizeFonts: false,
  images: {
    unoptimized: true
  },
  // Reduce chunk size to make loading more reliable
  webpack: (config) => {
    config.optimization.splitChunks = {
      cacheGroups: {
        default: false,
        vendors: false,
        // Create larger chunks to reduce the number of requests
        commons: {
          name: 'commons',
          chunks: 'all',
          minChunks: 2,
          reuseExistingChunk: true,
        },
        // Ensure react is bundled into one file
        framework: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'framework',
          chunks: 'all',
          priority: 40,
        },
      },
    };
    return config;
  },
};

module.exports = nextConfig

export default nextConfig;

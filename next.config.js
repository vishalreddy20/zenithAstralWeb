const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  webpack: (config, { isServer }) => {
    // Only run on the client bundle
    if (!isServer) {
      // Copy Cesium's static asset folders to public/cesium/
      // so CESIUM_BASE_URL = "/cesium/" resolves correctly at runtime.
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(
                path.dirname(require.resolve("cesium/package.json")),
                "Build/Cesium/Workers"
              ),
              to: path.join(__dirname, "public/cesium/Workers"),
            },
            {
              from: path.join(
                path.dirname(require.resolve("cesium/package.json")),
                "Build/Cesium/ThirdParty"
              ),
              to: path.join(__dirname, "public/cesium/ThirdParty"),
            },
            {
              from: path.join(
                path.dirname(require.resolve("cesium/package.json")),
                "Build/Cesium/Assets"
              ),
              to: path.join(__dirname, "public/cesium/Assets"),
            },
            {
              from: path.join(
                path.dirname(require.resolve("cesium/package.json")),
                "Build/Cesium/Widgets"
              ),
              to: path.join(__dirname, "public/cesium/Widgets"),
            },
          ],
        })
      );
    }

    // Prevent Node.js-only modules from being bundled for the browser
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      net: false,
      tls: false,
    };

    return config;
  },
};

module.exports = nextConfig;

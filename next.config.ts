import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const assetPrefix = process.env.ASSET_PREFIX?.trim();

const HOME_PAGE_CACHE = 24 * 60 * 60;

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  reactCompiler: true,
  allowedDevOrigins: ["dev.appexplorer.dev"],
  assetPrefix: assetPrefix || undefined,
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: {
    swcPlugins: [["swc-plugin-coverage-instrument", {}]],
  },
  headers() {
    const staticPageCache = [
      "public",
      `max-age=${HOME_PAGE_CACHE}`,
      `stale-while-revalidate=${HOME_PAGE_CACHE}`,
      `stale-if-error=${HOME_PAGE_CACHE}`,
    ].join(", ");
    return [
      {
        source: "/demo",
        headers: [
          {
            key: "Cache-Control",
            value: staticPageCache,
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: staticPageCache,
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.txt": {
        loaders: [
          {
            loader: "raw-loader",
          },
        ],
        as: "*.js",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "asa-ayers",

  project: "app-explorer",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  // I can't make the build server read an environment variable
  authToken: process.env.SENTRY_AUTH_TOKEN,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

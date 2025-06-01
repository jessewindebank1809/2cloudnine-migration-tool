/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react', 'framer-motion'],
    optimizeCss: false, // Disable to avoid critters dependency issues
    serverMinification: true,
    // Development performance improvements
    forceSwcTransforms: true,
    swcTraceProfiling: false,
  },
  images: {
    unoptimized: true,
    // Add format optimization for better performance
    formats: ['image/webp', 'image/avif'],
    // Enable responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Optimize package imports to reduce bundle size
  modularizeImports: {
    '@radix-ui/react-icons': {
      transform: '@radix-ui/react-icons/{{member}}',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  // Development performance optimizations  
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    },

  }),
  eslint: {
    // Disable ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds for deployment
    ignoreBuildErrors: true,
  },
  // Enhanced build optimization
  compiler: {
    // Enable SWC minification for better performance
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Exclude API routes that require database access from being statically generated
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || process.env.FLY_APP_NAME || 'development'
  },
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    SALESFORCE_CLIENT_ID: process.env.SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    // Public environment variables for client-side
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Add webpack optimization for better bundling
  webpack: (config, { dev, isServer }) => {
    // Optimize chunks for better loading
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Group vendor libraries
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Group common components
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
        },
      };
    }
    return config;
  },
  // Enhanced headers for better caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig 

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(
  module.exports,
  {
    // For all available options, see:
    // https://www.npmjs.com/package/@sentry/webpack-plugin#options

    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: "2cloudnine",
    project: "javascript-nextjs",

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

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);

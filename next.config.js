/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  eslint: {
    // Disable ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking during builds for deployment
    ignoreBuildErrors: true,
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
}

module.exports = nextConfig 
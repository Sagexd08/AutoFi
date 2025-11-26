/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Use port 3002 for Frontend
  env: {
    PORT: '3002',
  },
}

export default nextConfig

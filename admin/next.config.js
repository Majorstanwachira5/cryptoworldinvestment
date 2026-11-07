/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_API_URL ||
      "http://localhost:4000";
    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/rewards/:path*",
        destination: `${backendUrl}/api/rewards/:path*`,
      },
      {
        source: "/api/payments/:path*",
        destination: `${backendUrl}/api/payments/:path*`,
      },
      {
        source: "/api/ledger/:path*",
        destination: `${backendUrl}/api/ledger/:path*`,
      },
      {
        source: "/api/predict",
        destination: `${backendUrl}/api/predict`,
      },
    ];
  },
};

module.exports = nextConfig;

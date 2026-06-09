/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Limit image optimizer disk cache growth (CVE-2026-27980 mitigation on supported versions)
  images: {
    minimumCacheTTL: 60,
  },

  async headers() {
    return [
      {
        source: "/.well-known/security.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/dashboard/projects/new", destination: "/projects/new", permanent: true },
      { source: "/dashboard/projects/:id", destination: "/projects/:id", permanent: true },
    ];
  },
};

export default nextConfig;

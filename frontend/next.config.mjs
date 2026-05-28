/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/dashboard/projects/new", destination: "/projects/new", permanent: true },
      { source: "/dashboard/projects/:id", destination: "/projects/:id", permanent: true },
    ];
  },
};

export default nextConfig;

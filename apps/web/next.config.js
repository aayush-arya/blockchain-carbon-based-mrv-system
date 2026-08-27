/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    dirs: ['app', 'components', 'lib'],
  },
  // Traces a minimal .next/standalone server bundle - what the Docker image runs.
  output: 'standalone',
};

module.exports = nextConfig;

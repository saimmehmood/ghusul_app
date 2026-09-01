/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // node-postgres is loaded only when DATABASE_URL points somewhere other than
  // Neon (i.e. local development). Keeping it external stops the bundler from
  // trying to follow its optional native dependencies.
  serverExternalPackages: ["pg"],
};

export default nextConfig;

/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["firebase-admin"],
};

module.exports = nextConfig;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Kunci root ke folder proyek; ada package-lock.json lain di home directory.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Domyślnie 1MB — duże CSV dochodu przekraczają limit → 413 → akcja odrzucona.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

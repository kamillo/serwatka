import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Domyślnie 1MB — duże CSV dochodu przekraczają limit → 413 → akcja odrzucona.
      bodySizeLimit: "10mb",
    },
    // Next 16.3 domyślnie włączył plikowy cache Turbopack dla next build
    // (.next/cache/turbopack). Na wolnym dysku LXC (Proxmox) zapis/walidacja
    // cache trwają dłużej niż sam build małej apki — wyłączamy, przywracając
    // zachowanie z 16.2 (cache tylko w pamięci).
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;

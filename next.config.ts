import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.nba.com" },
    ],
  },
  experimental: {
    proxyTimeout: 600_000, // 10 minutes
  },
  /**
   * La rubrique s'appelait `/marche`, elle s'appelle `/mercato`.
   *
   * Redirection permanente et non suppression : l'ancienne adresse est dans le
   * sitemap depuis des mois, elle vit dans des liens extérieurs et dans les
   * favoris. Un 301 transmet le référencement acquis à la nouvelle URL, là où un
   * 404 le perdrait. À garder tant que d'anciens liens peuvent pointer ici.
   */
  async redirects() {
    return [{ source: "/marche", destination: "/mercato", permanent: true }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

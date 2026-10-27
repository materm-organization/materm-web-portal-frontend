import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev only: move Next's dev indicator off the bottom-left, where it covers
  // the fixed bottom nav bar.
  devIndicators: { position: "top-right" },
  // Dev only: let a phone on the same Wi-Fi open the dev server by its LAN IP
  // (`next dev -H 0.0.0.0`, e.g. http://192.168.1.3:3000). Without this Next 16
  // blocks the cross-origin HMR WebSocket, React never starts on the phone: the
  // nav bar cannot be tapped and every scroll-reveal text stays invisible.
  // `*` = exactly one hostname label (see Next docs: allowedDevOrigins).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Pin the Turbopack workspace root to this project so Next's lockfile
  // root-inference can't pick up an unrelated package-lock.json in a parent
  // directory.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withNextIntl(nextConfig);

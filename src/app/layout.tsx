import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Zenith: The Celestial Eye",
  description:
    "Real-time cosmic radar — see exactly what's overhead at any location on Earth",
  keywords: [
    "ISS tracker",
    "satellite tracking",
    "celestial bodies",
    "astronomy",
    "real-time space",
  ],
  openGraph: {
    title: "Project Zenith: The Celestial Eye",
    description:
      "Real-time cosmic radar — see what's overhead at any location on Earth",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Cesium widget CSS — loaded from public/cesium/Widgets/ which is
          populated by CopyWebpackPlugin during `npm run dev` / `npm run build`.
          CDN fallback ensures styles are present even on first cold build.
        */}
        <link
          rel="stylesheet"
          href="/cesium/Widgets/widgets.css"
          // biome-ignore: intentional fallback via onError
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

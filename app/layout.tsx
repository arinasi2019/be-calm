import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

export const metadata: Metadata = {
  title: "避坑 Be Calm",
  description: "反推薦平台，分享真實踩雷、避坑心得、雷店、雷商品、雷服務。",

  verification: {
    google: "vuqPO-kfjzr9cROxWvZbambsDcIcxbCWEsOESUWVNUo",
  },

  openGraph: {
    title: "避坑 Be Calm",
    description: "反推薦平台，分享真實踩雷、避坑心得、雷店、雷商品、雷服務。",
    url: "https://becalm.social/",
    siteName: "避坑 Be Calm",
    images: [
      {
        url: "/becalm-main-logo.png",
        width: 1200,
        height: 630,
        alt: "避坑 Be Calm",
      },
    ],
    locale: "zh_TW",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "避坑 Be Calm",
    description: "反推薦平台，分享真實踩雷、避坑心得、雷店、雷商品、雷服務。",
    images: ["/becalm-main-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

export const metadata: Metadata = {
  title: "避坑 BeCalm｜餐廳、旅遊、商品踩雷分享平台",

  description:
    "避坑 BeCalm 是一個分享真實踩雷經驗的平台。查看餐廳雷店、旅遊地雷、不值得購買的商品與服務踩雷案例，避免消費陷阱。先看別人踩坑，再決定要不要花錢。",

  keywords: [
    "避坑",
    "踩雷",
    "雷店",
    "黑店",
    "餐廳雷店",
    "旅遊踩雷",
    "消費陷阱",
    "黑店分享",
    "真實評論",
    "消費避雷",
    "BeCalm",
  ],

  metadataBase: new URL("https://becalm.social"),

  openGraph: {
    title: "避坑 BeCalm｜今天又有誰爆雷了？",
    description:
      "分享真實踩雷經驗的平台。查看餐廳、旅遊、商品與服務的雷點，避免消費陷阱。",
    url: "https://becalm.social",
    siteName: "BeCalm",
    locale: "zh_TW",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "避坑 BeCalm｜今天又有誰爆雷了？",
    description:
      "查看餐廳雷店、旅遊踩雷、商品陷阱。先看別人踩坑，再決定要不要花錢。",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
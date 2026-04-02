import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "./components/AuthProvider";

export const metadata: Metadata = {
  title: "BeCalm Travel｜AI 旅遊避坑與行程優化平台",

  description:
    "BeCalm Travel 是一個專注旅遊避坑與 AI 行程優化的平台。輸入你的旅行安排，先看別人踩過的坑，再讓 AI 幫你調整成更順、更不容易後悔的行程。",

  keywords: [
    "旅遊避坑",
    "AI 行程規劃",
    "旅遊行程優化",
    "旅行避雷",
    "自由行避坑",
    "行程安排建議",
    "景點避坑",
    "旅遊真實評價",
    "BeCalm Travel",
    "行程診斷",
  ],

  metadataBase: new URL("https://becalm.social"),

  openGraph: {
    title: "BeCalm Travel｜先避坑，再出發",
    description:
      "輸入你的旅行安排，查看真實避坑內容，並讓 AI 幫你優化成更合理的旅行行程。",
    url: "https://becalm.social",
    siteName: "BeCalm Travel",
    locale: "zh_TW",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "BeCalm Travel｜先避坑，再出發",
    description:
      "旅遊避坑＋AI 行程優化平台。先看別人怎麼踩坑，再決定你的旅程怎麼排。",
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
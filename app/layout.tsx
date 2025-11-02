import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Room8 - コワーキングスペース管理システム",
  description: "Room8は、コワーキングスペース運営のための包括的なWebアプリケーションです",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}


import type { Metadata } from "next";
import "./globals.css";
import FooterNav from "@/components/footer-nav";

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
      <body>
        <div className="pb-20">
          {children}
        </div>
        <FooterNav />
      </body>
    </html>
  );
}


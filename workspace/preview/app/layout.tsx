import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOFT",
  description: "Добро пожаловать в лофт",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-[#f5efe6] min-h-screen p-5">
        <nav className="max-w-6xl mx-auto mb-8 flex gap-4">
          <Link href="/" className="px-4 py-2 bg-[#3c2f28] text-[#fcf9f5] rounded-xl hover:bg-[#57473d] transition-colors text-sm font-medium">Главная</Link>
          <Link href="/login" className="px-4 py-2 bg-[#161b22] text-[#c9d1d9] rounded-xl hover:bg-[#1c2333] transition-colors text-sm font-medium">Вход</Link>
          <Link href="/dashboard" className="px-4 py-2 bg-white text-gray-800 rounded-xl border border-gray-200 hover:shadow-md transition-shadow text-sm font-medium">Дашборд</Link>
        </nav>
        <div className="flex items-center justify-center">{children}</div>
      </body>
    </html>
  );
}

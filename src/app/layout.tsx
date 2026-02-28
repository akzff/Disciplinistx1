import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { AuthProvider } from "@/lib/AuthContext";
import AuthGate from "@/components/AuthGate";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disciplinist | Discipline Engine",
  description: "Advanced coaching interface powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AuthProvider>
          <AuthGate>
            {children}
          </AuthGate>
        </AuthProvider>
        <Script src="https://js.puter.com/v2/" strategy="beforeInteractive" />
      </body>
    </html>
  );
}

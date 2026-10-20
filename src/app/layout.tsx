import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from "@/lib/AuthContext";
import AuthGate from "@/components/AuthGate";
import { DataProvider } from "@/lib/DataContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disciplinist | Discipline Engine",
  description: "Advanced coaching interface powered by AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey="pk_test_ZXBpYy1seW54LTIuY2xlcmsuYWNjb3VudHMuZGV2JA">
      <html lang="en" suppressHydrationWarning>
        <body className={inter.variable}>
          <AuthProvider>
            <AuthGate>
              <DataProvider>
                {children}
              </DataProvider>
            </AuthGate>
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

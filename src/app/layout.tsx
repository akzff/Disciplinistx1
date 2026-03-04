import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { AuthProvider } from "@/lib/AuthContext";
import AuthGate from "@/components/AuthGate";
import { DataProvider } from "@/lib/DataContext";
import SettingsSidebar from "@/components/SettingsSidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Disciplinist | Discipline Engine",
  description: "Advanced coaching interface powered by AI",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey="pk_test_ZXBpYy1seW54LTIuY2xlcmsuYWNjb3VudHMuZGV2JA">
      <html lang="en">
        <body className={inter.variable}>
          <AuthProvider>
            <AuthGate>
              <DataProvider>
                {children}
                <SettingsSidebar />
              </DataProvider>
            </AuthGate>
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

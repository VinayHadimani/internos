import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import BetaBanner from "@/components/BetaBanner";
import FeedbackWidget from "@/components/FeedbackWidget";
import { BETA_CONFIG } from "@/constants/beta";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "InternOS — AI-Powered Internship Platform for Indian Students",
  description:
    "Upload your resume once. InternOS AI tailors it for every opportunity — optimized for ATS, matched to the role, ready in under 2 minutes. 10,000+ internships updated daily.",
  keywords: [
    "internship",
    "resume tailoring",
    "ATS optimization",
    "Indian students",
    "AI resume",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${inter.className} min-h-full flex flex-col`}>
        {BETA_CONFIG.IS_BETA && <BetaBanner />}
        <AuthProvider>
          {children}
        </AuthProvider>
        <FeedbackWidget />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "RecallAI — Your personal AI memory search engine",
    template: "%s · RecallAI",
  },
  description:
    "Upload your notes, PDFs and screenshots, then find anything with natural language. Grounded answers with citations to your own sources.",
  applicationName: "RecallAI",
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "RecallAI — Your memories. One intelligent search.",
    description:
      "A private, AI-powered search engine for your own documents, notes and screenshots.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

const themeScript = `(function(){try{var saved=localStorage.getItem('recallai-theme');var theme=saved==='dark'||saved==='light'?saved:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=theme;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-canvas font-sans text-ink">{children}</body>
    </html>
  );
}

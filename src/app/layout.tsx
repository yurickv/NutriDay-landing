import type { Metadata, Viewport } from 'next';
import { Comfortaa, Manrope, Caprasimo } from 'next/font/google';
import './globals.css';
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';

const comfortaa = Comfortaa({
  subsets: ['cyrillic', 'latin'], // variable font 300–700
  variable: '--font-comfortaa',
});

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'], // variable font 200–800
  variable: '--font-manrope',
});

// Лише для латинського лого «Sytno» (бренд-бук дозволяє Caprasimo без кирилиці).
const caprasimo = Caprasimo({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-caprasimo',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5ead8' },
    { media: '(prefers-color-scheme: dark)', color: '#2e2b25' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Sytno — персоналізоване меню',
  description: 'Швидке меню для здорового харчування — за 1 хвилину',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sytno',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'Sytno — персоналізоване меню',
    description: 'AI-генероване тижневе меню для здорового схуднення',
    type: 'website',
    locale: 'uk_UA',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={`${comfortaa.variable} ${manrope.variable} ${caprasimo.variable} font-body antialiased`}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
    </html>
  );
}

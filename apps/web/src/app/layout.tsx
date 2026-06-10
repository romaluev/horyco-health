import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eat&fit',
  description: 'Eat&fit — доставка еды',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

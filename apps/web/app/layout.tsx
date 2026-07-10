import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Space_Grotesk, Sora, Space_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Background } from '@/components/Background';
import { Nav } from '@/components/Nav';
import { Sidebar } from '@/components/Sidebar';
import { MyBets } from '@/components/MyBets';
import { SupportWidget } from '@/components/SupportWidget';
import { WinsTicker } from '@/components/WinsTicker';
import { Footer } from '@/components/Footer';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700'],
});
const body = Sora({ subsets: ['latin'], variable: '--font-body', weight: ['400', '600'] });
const mono = Space_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '700'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0f',
};

export const metadata: Metadata = {
  title: 'FORTX — bet on the future',
  description: 'Live prediction markets with real Polymarket odds. Claim $5 free and play.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{if(localStorage.getItem('predikt_theme')==='light'){document.documentElement.classList.add('light');}}catch(e){}})();",
          }}
        />
        <Script
  src="https://telegram.org/js/telegram-web-app.js"
  strategy="beforeInteractive"
/>
      </head>
      <body>
        <Providers>
          <Background />
          <Sidebar />
          <div className="lg:pl-60">
            <Nav />
            <WinsTicker />
            <main className="relative z-10">{children}</main>
            <Footer />
          </div>
          <MyBets />
          <SupportWidget />
        </Providers>
      </body>
    </html>
  );
}

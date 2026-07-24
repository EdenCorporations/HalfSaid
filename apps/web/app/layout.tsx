import type { Metadata } from 'next';
import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HalfSaid — Helping Every Voice Be Heard',
  description:
    'An AI voice companion for people with aphasia. Suggestions come only from your own Personal Communication Graph — spoken in your voice, never invented.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jakarta.variable}`}>
      <body className="app-noise app-vignette relative min-h-screen antialiased">
        {/* Keyboard-first skip link — accessibility is a gate (SPEC §13). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-glow"
        >
          Skip to main content
        </a>
        <main id="main" className="relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}

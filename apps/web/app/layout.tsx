import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HalfSaid',
  description:
    'Personal Communication Intelligence Platform for people with aphasia (hackathon MVP).',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {/* Keyboard-first skip link — accessibility is a gate (SPEC §13). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, MessageSquareText, LineChart } from 'lucide-react';

import { GlassCard } from '@/components/brand/GlassCard';

const STEPS = [
  {
    n: '01',
    title: 'Say what you can',
    body: 'Speak a few words, or type them. Even half a sentence is enough to begin.',
  },
  {
    n: '02',
    title: 'See it completed',
    body: 'HalfSaid retrieves whole phrases from your own history and shows a few clear choices.',
  },
  {
    n: '03',
    title: 'Speak in your voice',
    body: 'Tap one and it is spoken aloud — in your voice, attributed to you.',
  },
];

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Only your words',
    body: 'Every suggestion is grounded in your Personal Communication Graph and tagged with its source. Nothing is ever made up.',
  },
  {
    icon: MessageSquareText,
    title: 'Calm by design',
    body: 'Large targets, high contrast, gentle motion, and no clutter — built to lower anxiety, not add to it.',
  },
  {
    icon: LineChart,
    title: 'Progress you can share',
    body: 'A clinician view tracks functional communication over time, so therapy and family stay in the loop.',
  },
];

export function FeatureSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="font-heading text-sm font-semibold uppercase tracking-[0.3em] text-[#A855F7]">
          How it works
        </p>
        <h2 className="mt-3 font-heading text-4xl font-bold tracking-tight text-white">
          Three steps to being heard
        </h2>
      </motion.div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <GlassCard key={s.n} index={i} className="p-8">
            <span className="font-heading text-4xl font-bold text-white/15">{s.n}</span>
            <h3 className="mt-4 font-heading text-xl font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </GlassCard>
        ))}
      </div>

      <div className="mt-24 grid gap-5 md:grid-cols-3">
        {PILLARS.map((p, i) => (
          <GlassCard key={p.title} index={i} className="flex flex-col gap-3 p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-[#A855F7] shadow-glow-soft">
              <p.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="font-heading text-xl font-semibold text-white">{p.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
          </GlassCard>
        ))}
      </div>

      {/* Closing CTA. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mt-24 flex flex-col items-center gap-6 rounded-3xl border border-white/5 bg-white/[0.03] px-8 py-16 text-center backdrop-blur-glass"
      >
        <h2 className="max-w-2xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready when you are.
        </h2>
        <p className="max-w-md text-muted-foreground">
          Start a conversation, or open the clinician view to see progress over time.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/canvas"
            className="inline-flex min-h-touch-lg items-center gap-2 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#9333EA] px-8 text-lg font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span aria-hidden="true">🎤</span> Start Conversation
          </Link>
          <Link
            href="/clinician"
            className="inline-flex min-h-touch-lg items-center rounded-2xl border border-white/10 px-6 text-lg font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clinician Dashboard
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

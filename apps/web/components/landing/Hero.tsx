'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mic, Sparkles, Heart, ArrowRight } from 'lucide-react';

import { CompanionOrb } from '@/components/brand/CompanionOrb';
import { GlassCard } from '@/components/brand/GlassCard';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 120, damping: 18, delay: i * 0.12 },
  }),
};

const CARDS = [
  {
    icon: Mic,
    title: 'Voice Recognition',
    body: 'Speak naturally. HalfSaid listens and understands what you mean to say.',
  },
  {
    icon: Sparkles,
    title: 'Personalized Suggestions',
    body: 'Phrases drawn only from your own words — never invented, always yours.',
  },
  {
    icon: Heart,
    title: 'Built for Aphasia',
    body: 'Large, calm, and simple. Designed with people who find words hard to reach.',
  },
];

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center px-6 pb-24 pt-16 text-center">
      {/* Wordmark. */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mb-8 flex items-center gap-2"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#A855F7] shadow-glow" />
        <span className="font-heading text-lg font-semibold tracking-[0.35em] text-white/80">
          HALFSAID
        </span>
      </motion.div>

      {/* Orb — the emotional centre. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.1 }}
        className="relative"
      >
        <CompanionOrb state="idle" size={340} />
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-2 font-heading text-lg font-medium text-white/70"
        >
          “I&rsquo;m listening.”
        </motion.p>
      </motion.div>

      {/* Headline. */}
      <motion.h1
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mt-10 max-w-3xl font-heading text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
      >
        Helping Every{' '}
        <span className="bg-gradient-to-r from-[#A855F7] via-[#9333EA] to-[#7C3AED] bg-clip-text text-transparent">
          Voice
        </span>{' '}
        Be Heard.
      </motion.h1>

      <motion.p
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mt-5 max-w-xl text-lg text-muted-foreground sm:text-xl"
      >
        An AI voice companion for people with aphasia.
      </motion.p>

      {/* CTAs. */}
      <motion.div
        custom={5}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
      >
        <Link
          href="/canvas"
          className="group inline-flex min-h-touch-lg items-center gap-3 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#9333EA] px-8 text-lg font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span aria-hidden="true">🎤</span>
          Start Conversation
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <a
          href="#features"
          className="inline-flex min-h-touch-lg items-center gap-2 rounded-2xl px-6 text-lg font-medium text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Learn More
        </a>
      </motion.div>

      {/* Three glass cards. */}
      <div className="mt-20 grid w-full gap-5 sm:grid-cols-3">
        {CARDS.map((c, i) => (
          <GlassCard key={c.title} index={i} className="flex flex-col items-center gap-3 p-7 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-[#A855F7] shadow-glow-soft">
              <c.icon className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="font-heading text-xl font-semibold text-white">{c.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

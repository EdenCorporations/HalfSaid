'use client';

import { motion } from 'framer-motion';

import { HeroBackground } from './HeroBackground';
import { Navbar } from './Navbar';
import { AnimatedHeadline } from './AnimatedHeadline';
import { RobotSpline } from './RobotSpline';
import { HeroButtons } from './HeroButtons';
import { FeatureCards } from './FeatureCards';
import { FooterTag } from './FooterTag';
import { StatStrip } from './StatStrip';

/**
 * The HalfSaid landing hero — one fullscreen viewport, no scrolling. Navigation
 * on top, a two-column hero (message + robot) in the middle, and feature cards
 * along the bottom. Everything animates in on load and stays gently alive.
 */
export function Hero() {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      <HeroBackground />

      <div className="relative z-10 flex h-full flex-col">
        <Navbar />

        {/* Centre hero. */}
        <div className="grid flex-1 grid-cols-1 items-center gap-4 px-6 sm:px-10 md:grid-cols-2 md:gap-8 lg:px-16">
          {/* Robot first on mobile, right on desktop. */}
          <div className="order-1 flex justify-center md:order-2">
            <RobotSpline size={320} />
          </div>

          {/* Message. */}
          <div className="order-2 flex flex-col items-center text-center md:order-1 md:items-start md:text-left">
            <AnimatedHeadline />
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
              className="mt-5 max-w-md text-lg text-muted-foreground sm:text-xl"
            >
              An AI Voice Companion
              <br className="hidden sm:block" /> for People with Aphasia.
            </motion.p>

            <div className="mt-8">
              <HeroButtons />
            </div>
            <div className="mt-6 hidden md:block">
              <StatStrip />
            </div>
            <div className="mt-4 hidden md:block">
              <FooterTag />
            </div>
          </div>
        </div>

        {/* Bottom feature cards. */}
        <div className="flex flex-col items-center gap-3 px-6 pb-6 sm:px-10 lg:px-16">
          <FeatureCards />
        </div>
      </div>
    </div>
  );
}

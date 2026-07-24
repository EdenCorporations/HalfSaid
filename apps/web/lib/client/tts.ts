'use client';

/**
 * Text-to-speech via the browser SpeechSynthesis API (SPEC §3 — MVP TTS; a clean
 * seam for OpenVoice later). No-ops where speech synthesis is unavailable (SSR/jsdom).
 */
export function speak(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (typeof SpeechSynthesisUtterance === 'undefined') return;
  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Stop any in-progress speech (the undo path). */
export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

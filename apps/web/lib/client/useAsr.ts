'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Microphone capture → Groq Whisper transcript (SPEC §2, PRD §16), upgraded with:
 *
 *  - LIVE INTERIM TRANSCRIPT: while recording, the browser's Web Speech API (where
 *    available) streams interim text so the user sees words as they speak — the
 *    2–4s "dead zone" of record-then-transcribe (D17) is filled. The FINAL
 *    transcript still comes from Groq Whisper for accuracy.
 *  - VAD AUTO-STOP: an AnalyserNode tracks signal energy; once speech has been
 *    heard, ~1.8s of silence stops the recording automatically — no second tap,
 *    which matters for users with motor impairment.
 *
 * Both are progressive enhancements: without SpeechRecognition there is simply no
 * interim text; without WebAudio the mic keeps manual stop.
 */

const SILENCE_MS = 1800; // stop after this much post-speech silence
const MAX_RECORD_MS = 20_000; // hard cap — never record forever
const SPEECH_RMS = 0.015; // energy threshold that counts as speech

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useAsr(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);
  /** Live interim transcript while recording ('' when none). */
  const [interim, setInterim] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRef = useRef<() => void>(() => {});

  const cleanupAux = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (vadRafRef.current !== null) cancelAnimationFrame(vadRafRef.current);
    vadRafRef.current = null;
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    maxTimerRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setInterim('');
  }, []);

  const start = useCallback(async () => {
    setAsrError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setAsrError('Microphone is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cleanupAux();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append('audio', blob, 'audio.webm');
          const res = await fetch('/api/v1/asr', { method: 'POST', body: form });
          const data = (await res.json()) as { text?: string; error?: string };
          if (!res.ok) throw new Error(data.error ?? `ASR failed (${res.status})`);
          if (data.text) onTranscript(data.text);
        } catch (e) {
          setAsrError(e instanceof Error ? e.message : 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setListening(true);

      // Live interim transcript (progressive enhancement).
      const Recognition = getSpeechRecognition();
      if (Recognition) {
        try {
          const rec = new Recognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';
          rec.onresult = (e) => {
            let text = '';
            for (let i = 0; i < e.results.length; i++) text += e.results[i]![0]!.transcript;
            setInterim(text.trim());
          };
          rec.onerror = () => {
            /* interim display only — Whisper still produces the final text */
          };
          rec.start();
          recognitionRef.current = rec;
        } catch {
          /* no interim — fine */
        }
      }

      // VAD auto-stop (progressive enhancement).
      if (typeof AudioContext !== 'undefined') {
        try {
          const ctx = new AudioContext();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          const buf = new Float32Array(analyser.fftSize);
          let heardSpeech = false;
          let silentSince = performance.now();
          const tick = () => {
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
            const rms = Math.sqrt(sum / buf.length);
            const now = performance.now();
            if (rms >= SPEECH_RMS) {
              heardSpeech = true;
              silentSince = now;
            } else if (heardSpeech && now - silentSince >= SILENCE_MS) {
              stopRef.current();
              return;
            }
            vadRafRef.current = requestAnimationFrame(tick);
          };
          vadRafRef.current = requestAnimationFrame(tick);
        } catch {
          /* manual stop still works */
        }
      }

      // Hard cap so an open mic can never run away.
      maxTimerRef.current = setTimeout(() => stopRef.current(), MAX_RECORD_MS);
    } catch {
      setAsrError('Microphone permission was denied.');
    }
  }, [onTranscript, cleanupAux]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
  }, []);
  stopRef.current = stop;

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  // Unmount safety: stop everything.
  useEffect(
    () => () => {
      recorderRef.current?.stop();
      cleanupAux();
    },
    [cleanupAux],
  );

  return { listening, transcribing, asrError, interim, toggle };
}

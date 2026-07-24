'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Microphone capture → Groq Whisper transcript (SPEC §2, PRD §16). Records with
 * MediaRecorder; on stop, posts the audio to /api/v1/asr and hands the transcript to
 * `onTranscript`. Record-then-transcribe (near-real-time) for the MVP (D17).
 */
export function useAsr(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [asrError, setAsrError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
    } catch {
      setAsrError('Microphone permission was denied.');
    }
  }, [onTranscript]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return { listening, transcribing, asrError, toggle };
}

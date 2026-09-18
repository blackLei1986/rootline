"use client";

/**
 * Lightweight text-to-speech helper using the browser's Web Speech API.
 * Used for the "P = pronunciation" hotkey and speaker buttons.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((voice) => voice.lang === "en-US") ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null;
  return preferred ?? voices[0] ?? null;
}

export function speakWord(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text.trim()) return;

  // Cancel any in-flight utterance so rapid hotkey presses don't queue up.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (!cachedVoice) cachedVoice = pickEnglishVoice();
  if (cachedVoice) utterance.voice = cachedVoice;
  utterance.lang = cachedVoice?.lang ?? "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

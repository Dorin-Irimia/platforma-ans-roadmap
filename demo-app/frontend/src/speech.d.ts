// Tipuri minime pentru Web Speech API (SpeechRecognition) — nu face parte din libul
// DOM standard TypeScript (doar Chrome/Edge o implementează, sub prefix `webkit`).
// SpeechSynthesis/SpeechSynthesisUtterance sunt deja tipate în lib.dom.d.ts standard.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionResultList {
  [index: number]: { [index: number]: SpeechRecognitionResultLike; length: number };
  length: number;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
}
interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}

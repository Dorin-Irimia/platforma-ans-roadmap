// Voce — exclusiv client-side prin Web Speech API a browserului (fără server), conform
// deciziei de arhitectură: funcționează în Chrome/Edge, nu în Firefox/Safari.

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startSpeechRecognition(onResult: (transcript: string) => void, onEnd: () => void): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "ro-RO";
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    onResult(transcript);
  };
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();
  return recognition;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakText(text: string) {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ro-RO";
  window.speechSynthesis.speak(utterance);
}

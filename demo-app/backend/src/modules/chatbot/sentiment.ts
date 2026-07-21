// Identificare stare emoțională a utilizatorului (cerință explicită 4.5.11) — clasificare
// AI mică, separată de răspunsul principal al asistentului, ca să nu-i afecteze fiabilitatea:
// dacă acest apel eșuează (cheie AI lipsă, model indisponibil etc.), nu blocăm mesajul
// utilizatorului — revenim implicit la NEUTRU și logica de conversație continuă normal.
import { chatCompletion } from "../../shared/ai";

export const SENTIMENT_VALUES = ["POZITIV", "NEUTRU", "FRUSTRAT", "NEGATIV"] as const;
export type Sentiment = (typeof SENTIMENT_VALUES)[number];

export async function detectSentiment(text: string): Promise<Sentiment> {
  try {
    const raw = await chatCompletion(
      [
        {
          role: "system",
          content:
            'Clasifici starea emoțională a unui mesaj scris de un cetățean către o instituție publică. Răspunde STRICT cu JSON de forma {"sentiment": "..."}, unde valoarea e exact una din: POZITIV, NEUTRU, FRUSTRAT, NEGATIV.',
        },
        { role: "user", content: text.slice(0, 1000) },
      ],
      { jsonMode: true }
    );
    const parsed = JSON.parse(raw);
    const value = String(parsed.sentiment || "").toUpperCase();
    return (SENTIMENT_VALUES as readonly string[]).includes(value) ? (value as Sentiment) : "NEUTRU";
  } catch {
    return "NEUTRU";
  }
}

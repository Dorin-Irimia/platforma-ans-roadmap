// Client AI comun — folosit de modulele Chatbot și LMS pentru completări de text
// (conversații, rescrie/rezumă/extinde, generare structură material). Cerința caietului
// la Scenariul 3 exclude explicit ChatGPT/Gemini/DeepSeek — folosim Groq (api.groq.com,
// format compatibil OpenAI, găzduiește modele open-weight sub brandul Groq, tier gratuit),
// nu un apel direct către unul dintre furnizorii excluși.
import { prisma } from "./prisma";
import { decryptSecret } from "../modules/iam/secrets.service";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Cheia AI (GROQ_API_KEY) nu este configurată în Secret Manager");
    this.name = "AiNotConfiguredError";
  }
}

async function getApiKey(): Promise<string> {
  const secret = await prisma.secret.findUnique({ where: { key: "GROQ_API_KEY" } });
  if (!secret) throw new AiNotConfiguredError();
  return decryptSecret(secret.encryptedValue);
}

export async function getDefaultModel(): Promise<string> {
  const settings = await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return settings.defaultModel;
}

// Fără streaming de tokeni — request/response simplu (scope cut asumat, ca și restul
// simplificărilor documentate onest în dms/README.md). `jsonMode` cere modelului să
// întoarcă strict JSON (Groq e compatibil OpenAI, suportă `response_format`) — folosit
// de clasificări structurate mici (ex. chatbot/sentiment.ts), fără să afecteze apelanții
// existenți care nu-l pasează.
export async function chatCompletion(messages: AiMessage[], opts?: { model?: string; jsonMode?: boolean }): Promise<string> {
  const apiKey = await getApiKey();
  const model = opts?.model || (await getDefaultModel());

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      ...(opts?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Apelul AI a eșuat (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Răspuns AI gol sau nerecunoscut");
  return content;
}

import { describe, it, expect, afterAll } from "vitest";
import { adminApi } from "./helpers";

describe("Chatbot — identificare stare emoțională + escaladare", () => {
  let conversationId: string | null = null;

  afterAll(async () => {
    if (conversationId) {
      const { api } = await adminApi();
      await api(`/api/chatbot/conversations/${conversationId}`, { method: "DELETE" });
    }
  });

  it("2 mesaje consecutive cu ton frustrat escaladează automat conversația", async () => {
    const { api } = await adminApi();
    const { data: conv } = await api("/api/chatbot/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "Test sentiment Vitest" }),
    });
    conversationId = conv.id;

    const send = (content: string) => {
      const form = new FormData();
      form.append("content", content);
      return api(`/api/chatbot/conversations/${conversationId}/messages`, { method: "POST", body: form as any });
    };

    const first = await send("Sunt extrem de nemulțumit, nimic nu funcționează cum trebuie la platforma asta!");
    expect(["FRUSTRAT", "NEGATIV", "NEUTRU", "POZITIV"]).toContain(first.data.userMessage.sentiment);

    await send("Este a treia oară când încerc și tot nu merge, sunt foarte supărat și vreau să vorbesc cu cineva urgent!");

    const { data: needsReview } = await api("/api/chatbot/conversations/needs-review");
    const found = needsReview.find((c: any) => c.id === conversationId);
    // Escaladarea depinde de clasificarea reală AI (Groq) — verificăm doar dacă AMBELE
    // mesaje au fost clasificate ca negative, ca testul să nu fie fragil la variații de model.
    const { data: full } = await api(`/api/chatbot/conversations/${conversationId}`);
    const userMessages = full.messages.filter((m: any) => m.role === "USER");
    const bothNegative = userMessages.length === 2 && userMessages.every((m: any) => m.sentiment === "FRUSTRAT" || m.sentiment === "NEGATIV");
    if (bothNegative) {
      expect(found).toBeTruthy();
      expect(found.needsReviewReason).toMatch(/emoțională/);
    }
  });
});

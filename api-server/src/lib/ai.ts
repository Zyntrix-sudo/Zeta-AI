import { logger } from "./logger.js";

const API_BASE = "https://gzmovieboxapi.septorch.tech/api";
const API_KEY = "Godszeal";

export async function getAIResponse(
  message: string,
  conversationId: string,
  senderName?: string,
): Promise<string> {
  try {
    const query = senderName ? `[${senderName}]: ${message}` : message;
    const url = `${API_BASE}/gemini?apikey=${API_KEY}&q=${encodeURIComponent(query)}&id=${encodeURIComponent(conversationId)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`AI API returned ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;

    // API returns { status, data: { response, model, source } }
    const nested = data.data as Record<string, unknown> | undefined;
    const text = (
      nested?.response ||
      nested?.answer ||
      nested?.text ||
      nested?.reply ||
      data.answer ||
      data.response ||
      data.message ||
      data.text ||
      data.result ||
      data.reply ||
      ""
    ) as string;

    return (
      text.trim() ||
      "I'm sorry, I couldn't process that request. Please try again."
    );
  } catch (e) {
    logger.error({ err: e }, "AI API error");
    return "I'm sorry, I'm having trouble responding right now. Please try again later.";
  }
}

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const url = `${API_BASE}/ai-image?apikey=${API_KEY}&prompt=${encodeURIComponent(prompt)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const nested = data.data as Record<string, unknown> | undefined;
    return (
      nested?.url || nested?.image || nested?.link ||
      data.url || data.image || data.link || data.imageUrl || null
    ) as string | null;
  } catch (e) {
    logger.error({ err: e }, "Image generation API error");
    return null;
  }
}

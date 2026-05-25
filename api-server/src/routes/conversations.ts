import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListConversationsQueryParams } from "@workspace/api-zod";
import { broadcastMessage, getStatus } from "../lib/whatsapp.js";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  const parsed = ListConversationsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;

  const convs = await db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(limit)
    .offset(offset);

  res.json(
    convs.map((c) => ({
      id: String(c.id),
      jid: c.jid,
      displayName: c.displayName,
      lastMessage: c.lastMessage || null,
      lastMessageAt: c.lastMessageAt?.toISOString() || null,
      messageCount: c.messageCount,
      unreadCount: c.unreadCount,
      isGroup: c.isGroup,
    })),
  );
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id)
    ? req.params.id[0]
    : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid conversation ID" });
    return;
  }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.timestamp)
    .limit(100);

  res.json(
    msgs.map((m) => ({
      id: String(m.id),
      conversationId: String(m.conversationId),
      content: m.content,
      role: m.role,
      senderName: m.senderName || null,
      timestamp: m.timestamp.toISOString(),
      isAiReply: m.isAiReply,
    })),
  );
});

router.post("/conversations/broadcast", async (req, res): Promise<void> => {
  const { message, conversationIds } = req.body as {
    message?: string;
    conversationIds?: string[];
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ success: false, error: "message is required" });
    return;
  }

  const status = getStatus();
  if (status.state !== "connected") {
    res.status(400).json({
      success: false,
      error: "WhatsApp is not connected. Please connect first.",
    });
    return;
  }

  try {
    const jids = conversationIds && conversationIds.length > 0
      ? conversationIds
      : undefined;

    const result = await broadcastMessage(message.trim(), jids);
    res.json({ success: true, ...result });
  } catch (e: unknown) {
    const err = e as Error;
    req.log.error({ err }, "Broadcast failed");
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

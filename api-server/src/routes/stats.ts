import { Router, type IRouter } from "express";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { count, gte, eq } from "drizzle-orm";
import { getStatus } from "../lib/whatsapp.js";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [[totalMsgs], [totalConvs], [aiReplies], [activeToday]] =
    await Promise.all([
      db.select({ count: count() }).from(messagesTable),
      db.select({ count: count() }).from(conversationsTable),
      db
        .select({ count: count() })
        .from(messagesTable)
        .where(eq(messagesTable.isAiReply, true)),
      db
        .select({ count: count() })
        .from(messagesTable)
        .where(gte(messagesTable.timestamp, today)),
    ]);

  const status = getStatus();

  res.json({
    totalMessages: Number(totalMsgs.count),
    totalConversations: Number(totalConvs.count),
    aiReplies: Number(aiReplies.count),
    activeToday: Number(activeToday.count),
    connectionState: status.state,
  });
});

export default router;

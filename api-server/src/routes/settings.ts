import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function getOrCreate() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [s] = await db
    .insert(settingsTable)
    .values({
      enabled: true,
      aiPersona:
        "You are a friendly and professional AI assistant. Use standard English. Be helpful, warm, and concise.",
      replyPrefix: null,
      ignoreSelf: true,
      greeting: "Hello! I'm an AI assistant. How can I help you today?",
    })
    .returning();
  return s;
}

function toResponse(s: typeof settingsTable.$inferSelect) {
  return {
    enabled: s.enabled,
    aiPersona: s.aiPersona,
    replyPrefix: s.replyPrefix || null,
    ignoreSelf: s.ignoreSelf,
    greeting: s.greeting,
  };
}

router.get("/settings", async (_req, res): Promise<void> => {
  const s = await getOrCreate();
  res.json(toResponse(s));
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await getOrCreate();
  const [updated] = await db
    .update(settingsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(settingsTable.id, current.id))
    .returning();
  res.json(toResponse(updated));
});

export default router;

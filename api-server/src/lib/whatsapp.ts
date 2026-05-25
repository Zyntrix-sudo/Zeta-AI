import { promises as fs } from "fs";
import path from "path";
import {
  db,
  conversationsTable,
  messagesTable,
  settingsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getAIResponse, generateImage } from "./ai.js";
import { logger } from "./logger.js";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "pairing"
  | "connected";

export interface WhatsAppState {
  state: ConnectionState;
  phoneNumber: string | null;
  displayName: string | null;
  qrCode: string | null;
  pairingCode: string | null;
  connectedAt: string | null;
}

const SESSIONS_DIR = path.join(process.cwd(), "sessions");

// Newsletter JID — used in forwardedNewsletterMessageInfo so WhatsApp renders
// the native "View channel" button (not just a plain link)
const NEWSLETTER_JID = "120363424876568536@newsletter";
const NEWSLETTER_NAME = "SILENT TECH";

// Quoted "thumbnail" that makes the message look like it came from WhatsApp Business
const FKONTAK = {
  key: {
    fromMe: false,
    participant: `0@s.whatsapp.net`,
    remoteJid: "status@broadcast",
  },
  message: {
    contactMessage: {
      displayName: `WhatsApp Business ✅`,
      vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WhatsApp Business\nORG:WhatsApp Inc.\nEND:VCARD`,
    },
  },
};

// In-memory runtime flags (reset on server restart)
let isPaused = false;
let isCaptureEnabled = false;
let ownerJid: string | null = null; // set when WhatsApp connects

// Stores recent incoming messages so we can recover deleted ones
const messageStore = new Map<string, { text: string; senderName: string; jid: string }>();

let currentState: WhatsAppState = {
  state: "disconnected",
  phoneNumber: null,
  displayName: null,
  qrCode: null,
  pairingCode: null,
  connectedAt: null,
};

let activeSock: unknown = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

export function getStatus(): WhatsAppState {
  return { ...currentState };
}

export async function connectWhatsApp(
  usePairing = false,
  phoneNumber?: string,
): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  const sock = activeSock as Record<string, unknown> | null;
  if (sock) {
    try { (sock.ws as { close: () => void }).close(); } catch (_) {}
    activeSock = null;
  }

  if (usePairing) {
    try { await fs.rm(SESSIONS_DIR, { recursive: true, force: true }); } catch (_) {}
  }

  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  currentState = {
    state: "connecting",
    phoneNumber: null,
    displayName: null,
    qrCode: null,
    pairingCode: null,
    connectedAt: null,
  };

  startWhatsAppSession(usePairing, phoneNumber);
}

export async function disconnectWhatsApp(): Promise<void> {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  const sock = activeSock as Record<string, unknown> | null;
  if (sock) {
    try { await (sock.logout as () => Promise<void>)(); } catch (_) {}
    activeSock = null;
  }
  try { await fs.rm(SESSIONS_DIR, { recursive: true, force: true }); } catch (_) {}
  currentState = {
    state: "disconnected",
    phoneNumber: null,
    displayName: null,
    qrCode: null,
    pairingCode: null,
    connectedAt: null,
  };
}

export async function broadcastMessage(
  message: string,
  jids?: string[],
): Promise<{ sent: number; failed: number }> {
  const sock = activeSock as {
    sendMessage: (jid: string, content: unknown, opts?: unknown) => Promise<void>;
  } | null;
  if (!sock) throw new Error("WhatsApp is not connected");

  let targetJids: string[];
  if (jids && jids.length > 0) {
    targetJids = jids;
  } else {
    const convs = await db.select({ jid: conversationsTable.jid }).from(conversationsTable);
    targetJids = convs.map((c) => c.jid);
  }

  let sent = 0;
  let failed = 0;
  for (const jid of targetJids) {
    try {
      await sendBotMessage(sock, jid, message);
      sent++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      logger.warn({ err: e, jid }, "Broadcast send failed");
      failed++;
    }
  }
  return { sent, failed };
}

// ─── Helper: send a bot message with 5s delay + thumbnail + newsletter button ─
async function sendBotMessage(
  sock: { sendMessage: (jid: string, content: unknown, opts?: unknown) => Promise<void> },
  jid: string,
  text: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 5000));
  await sock.sendMessage(
    jid,
    {
      text,
      contextInfo: {
        isForwarded: true,
        forwardingScore: 999,
        // forwardedNewsletterMessageInfo makes WhatsApp render the native
        // "View channel" button — no link needed, uses the newsletter JID directly
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_JID,
          serverMessageId: -1,
          newsletterName: NEWSLETTER_NAME,
        },
      },
    },
    { quoted: FKONTAK },
  );
}

// ─── Core session (mirrors working Telegram bot logic) ────────────────────────
function startWhatsAppSession(usePairing: boolean, phoneNumber?: string): void {
  import("@whiskeysockets/baileys")
    .then(async (baileys) => {
      const {
        default: makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
        makeCacheableSignalKeyStore,
      } = baileys;

      const QRCode = await import("qrcode");
      const pino = (await import("pino")).default;
      const silentLogger = pino({ level: "silent" });

      try {
        const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);

        let version: [number, number, number];
        try {
          const result = await fetchLatestBaileysVersion();
          version = result.version;
        } catch {
          version = [2, 3000, 1015901307];
        }

        const sock = makeWASocket({
          version,
          logger: silentLogger as unknown as Parameters<typeof makeWASocket>[0]["logger"],
          printQRInTerminal: false,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
              state.keys,
              pino({ level: "fatal" }).child({ level: "fatal" }) as unknown as Parameters<typeof makeWASocket>[0]["logger"],
            ),
          },
          browser: ["Ubuntu", "Chrome", "20.0.04"] as [string, string, string],
          markOnlineOnConnect: false,
          generateHighQualityLinkPreview: true,
          syncFullHistory: false,
          connectTimeoutMs: 60000,
        });

        activeSock = sock;
        const botStartTime = Math.floor(Date.now() / 1000);

        // ── Pairing code — 6s delay (exact working bot logic) ─────────────────
        if (usePairing && !sock.authState.creds.registered && phoneNumber) {
          const phone = phoneNumber.replace(/[^0-9]/g, "");
          logger.info({ phone }, "Pairing mode — waiting 6s before requesting code");
          setTimeout(async () => {
            try {
              const code = await (sock.requestPairingCode as (p: string) => Promise<string>)(phone);
              const formatted = code?.match(/.{1,4}/g)?.join("-") ?? code;
              logger.info({ code: formatted }, "Pairing code ready");
              currentState.pairingCode = formatted;
              currentState.state = "pairing";
            } catch (e) {
              logger.error({ err: e }, "requestPairingCode failed");
            }
          }, 6000);
        }

        sock.ev.on("connection.update", async (update: {
          connection?: string;
          lastDisconnect?: { error?: unknown };
          qr?: string;
        }) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr && !usePairing) {
            currentState.state = "pairing";
            try {
              currentState.qrCode = await QRCode.default.toDataURL(qr, { width: 300, margin: 2 });
            } catch (e) {
              logger.error({ err: e }, "QR generation failed");
            }
          }

          if (connection === "close") {
            const reason = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
            logger.info({ reason }, "WhatsApp connection closed");
            activeSock = null;

            if (reason === DisconnectReason.loggedOut || reason === 401) {
              try { await fs.rm(SESSIONS_DIR, { recursive: true, force: true }); } catch (_) {}
              currentState = {
                state: "disconnected",
                phoneNumber: null,
                displayName: null,
                qrCode: null,
                pairingCode: null,
                connectedAt: null,
              };
            } else if (currentState.state !== "disconnected") {
              // Reconnect with usePairing = false — never regenerate the code
              reconnectTimeout = setTimeout(() => startWhatsAppSession(false, undefined), 5000);
            }
          } else if (connection === "open") {
            const sockUser = sock.user as { id: string; name?: string } | undefined;
            const myJid = sockUser?.id ?? "";
            const myPhone = myJid.split(":")[0].split("@")[0];
            ownerJid = `${myPhone}@s.whatsapp.net`;
            currentState = {
              state: "connected",
              phoneNumber: `+${myPhone}`,
              displayName: sockUser?.name ?? null,
              qrCode: null,
              pairingCode: null,
              connectedAt: new Date().toISOString(),
            };
            logger.info({ phone: myPhone }, "WhatsApp connected ✅");
          }
        });

        sock.ev.on("creds.update", saveCreds);

        // ── Incoming messages ──────────────────────────────────────────────────
        sock.ev.on("messages.upsert", async ({ messages, type }: { messages: unknown[]; type: string }) => {
          if (type !== "notify") return;
          for (const msg of messages) {
            try {
              await handleIncomingMessage(
                sock as unknown as BotSock,
                msg as Record<string, unknown>,
                botStartTime,
              );
            } catch (e) {
              logger.error({ err: e }, "Error handling message");
            }
          }
        });

      } catch (e) {
        logger.error({ err: e }, "Failed to start WhatsApp session");
        currentState.state = "disconnected";
      }
    })
    .catch((e) => {
      logger.error({ err: e }, "Failed to import Baileys");
      currentState.state = "disconnected";
    });
}

type BotSock = {
  sendMessage: (jid: string, content: unknown, opts?: unknown) => Promise<void>;
  user?: { id: string };
};

async function handleIncomingMessage(
  sock: BotSock,
  msg: Record<string, unknown>,
  botStartTime: number,
): Promise<void> {
  const msgKey = msg.key as Record<string, unknown>;
  const msgTimestamp =
    typeof msg.messageTimestamp === "number"
      ? msg.messageTimestamp
      : Number(msg.messageTimestamp);

  if (msgTimestamp < botStartTime - 10) return;

  const jid = msgKey.remoteJid as string;
  if (!jid || jid === "status@broadcast" || jid.endsWith("@broadcast")) return;

  // Block the bot's own outgoing messages to prevent reply loops.
  // Exception: owner's self-chat (jid matches ownerJid) — allow so the owner
  // can test commands by messaging themselves.
  if (msgKey.fromMe === true) {
    const ownerPhone = ownerJid?.split("@")[0];
    const jidPhone = jid.split("@")[0].split(":")[0];
    const isSelfChat = ownerPhone && ownerPhone === jidPhone;
    if (!isSelfChat) return;
  }

  const msgContent = msg.message as Record<string, unknown> | undefined;

  // ── Deleted message detection (protocolMessage type 0 = REVOKE) ────────────
  const proto = msgContent?.protocolMessage as Record<string, unknown> | undefined;
  if (proto && (proto.type === 0 || proto.type === "REVOKE")) {
    if (isCaptureEnabled && ownerJid) {
      const deletedKey = proto.key as Record<string, unknown> | undefined;
      const stored = deletedKey?.id ? messageStore.get(deletedKey.id as string) : undefined;
      if (stored) {
        await sendBotMessage(sock, ownerJid,
          `🗑️ *Deleted Message Captured*\n\n*From:* ${stored.senderName}\n*Chat:* ${stored.jid}\n\n"${stored.text}"`
        );
        messageStore.delete(deletedKey!.id as string);
      }
    }
    return;
  }

  const text = (
    (msgContent?.conversation as string) ||
    ((msgContent?.extendedTextMessage as Record<string, unknown> | undefined)?.text as string) ||
    ((msgContent?.imageMessage as Record<string, unknown> | undefined)?.caption as string) ||
    ""
  ).trim();
  if (!text) return;

  const senderJid = (msgKey.participant as string) || jid;
  const senderPhone = senderJid.split(":")[0].split("@")[0];
  const senderName = (msg.pushName as string) || `+${senderPhone}`;
  const msgId = msgKey.id as string;

  // Store message for deleted message capture
  if (msgId) {
    messageStore.set(msgId, { text, senderName, jid });
    // Keep store from growing indefinitely
    if (messageStore.size > 500) {
      const firstKey = messageStore.keys().next().value;
      if (firstKey) messageStore.delete(firstKey);
    }
  }

  // ── .Ai command handler ─────────────────────────────────────────────────────
  // Admin commands (pause/activate/capture/status) only work for the owner.
  // AI queries (.Ai <question>) work for everyone.
  const aiPrefix = /^\.ai\s*/i;
  if (aiPrefix.test(text)) {
    const command = text.replace(aiPrefix, "").trim().toLowerCase();
    const isOwner = ownerJid !== null && (senderJid === ownerJid || jid === ownerJid || senderPhone === ownerJid.split("@")[0]);

    // ── Owner-only admin commands ──────────────────────────────────────────
    if (command === "pause") {
      if (!isOwner) { await sendBotMessage(sock, jid, `❌ *Owner only command.*`); return; }
      isPaused = true;
      await sendBotMessage(sock, jid,
        `⏸️ *AI Responses Paused*\nBot will not reply to messages.\nSend *.Ai activate* to resume.`
      );
      return;
    }

    if (command === "activate") {
      if (!isOwner) { await sendBotMessage(sock, jid, `❌ *Owner only command.*`); return; }
      isPaused = false;
      await sendBotMessage(sock, jid,
        `▶️ *AI Responses Activated*\nBot is now responding to all messages.`
      );
      return;
    }

    if (command === "capture on") {
      if (!isOwner) { await sendBotMessage(sock, jid, `❌ *Owner only command.*`); return; }
      isCaptureEnabled = true;
      await sendBotMessage(sock, jid,
        `👁️ *Deleted Message Capture: ON*\nDeleted messages will be forwarded to your DM.`
      );
      return;
    }

    if (command === "capture off") {
      if (!isOwner) { await sendBotMessage(sock, jid, `❌ *Owner only command.*`); return; }
      isCaptureEnabled = false;
      await sendBotMessage(sock, jid,
        `🙈 *Deleted Message Capture: OFF*\nDeleted messages will no longer be captured.`
      );
      return;
    }

    if (command === "status") {
      if (!isOwner) { await sendBotMessage(sock, jid, `❌ *Owner only command.*`); return; }
      await sendBotMessage(sock, jid,
        `📊 *Bot Status*\n\n▶️ Responses: ${isPaused ? "⏸️ Paused" : "✅ Active"}\n👁️ Capture: ${isCaptureEnabled ? "✅ On" : "❌ Off"}`
      );
      return;
    }

    if (command === "help" || command === "") {
      const ownerOnly = isOwner ? `\n\n👑 *Owner Commands:*\n• *.Ai pause* — stop all responses\n• *.Ai activate* — resume responses\n• *.Ai capture on* — capture deleted msgs\n• *.Ai capture off* — stop capture\n• *.Ai status* — show bot status` : "";
      await sendBotMessage(sock, jid,
        `🤖 *AI Bot Commands*\n\n` +
        `• *.Ai <question>* — ask the AI anything\n` +
        `  _Example: .Ai what is the weather in Lagos?_${ownerOnly}`
      );
      return;
    }

    // Any other .Ai <question> → send to AI (works for everyone)
    const query = text.replace(aiPrefix, "").trim();
    if (query) {
      const conversation = await upsertConversation(jid, senderName, query);
      await db.insert(messagesTable).values({
        externalId: msgId || null,
        conversationId: conversation.id,
        content: query,
        role: "user",
        senderName,
        isAiReply: false,
        timestamp: new Date(msgTimestamp * 1000),
      }).onConflictDoNothing();

      const aiResponse = await getAIResponse(query, jid, senderName);
      await sendBotMessage(sock, jid, aiResponse);
      await saveAssistantMessage(conversation.id, aiResponse);
    }
    return;
  }

  // ── Normal message flow ─────────────────────────────────────────────────────
  if (isPaused) return; // bot is paused — ignore non-.Ai messages

  const settings = await getOrCreateSettings();
  if (!settings.enabled) return;

  let messageToProcess = text;
  if (settings.replyPrefix) {
    if (!text.startsWith(settings.replyPrefix)) return;
    messageToProcess = text.slice(settings.replyPrefix.length).trim();
  }

  const conversation = await upsertConversation(jid, senderName, text);

  await db.insert(messagesTable).values({
    externalId: msgId || null,
    conversationId: conversation.id,
    content: text,
    role: "user",
    senderName,
    isAiReply: false,
    timestamp: new Date(msgTimestamp * 1000),
  }).onConflictDoNothing();

  const lower = messageToProcess.toLowerCase();
  const isImageRequest =
    lower.includes("generate image") ||
    lower.includes("create image") ||
    lower.includes("draw me") ||
    lower.startsWith("image:");

  if (isImageRequest) {
    const prompt = messageToProcess.replace(/generate image|create image|draw me|image:/gi, "").trim();
    const imageUrl = await generateImage(prompt || messageToProcess);
    if (imageUrl) {
      await new Promise((r) => setTimeout(r, 5000)); // 5s delay
      try {
        await sock.sendMessage(jid, { image: { url: imageUrl }, caption: `Here is your generated image!\n\n${CHANNEL_LINK}` }, { quoted: FKONTAK });
      } catch {
        await sendBotMessage(sock, jid, `Here is your image: ${imageUrl}`);
      }
      await db.insert(messagesTable).values({
        conversationId: conversation.id,
        content: `[Image] ${imageUrl}`,
        role: "assistant",
        senderName: "AI Assistant",
        isAiReply: true,
        timestamp: new Date(),
      });
      await db.update(conversationsTable).set({
        messageCount: sql`${conversationsTable.messageCount} + 2`,
        lastMessage: "[Image generated]",
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(conversationsTable.id, conversation.id));
      return;
    }
  }

  const aiResponse = await getAIResponse(messageToProcess, jid, senderName);
  await sendBotMessage(sock, jid, aiResponse);
  await saveAssistantMessage(conversation.id, aiResponse);
}

async function saveAssistantMessage(conversationId: number, aiResponse: string) {
  await db.insert(messagesTable).values({
    conversationId,
    content: aiResponse,
    role: "assistant",
    senderName: "AI Assistant",
    isAiReply: true,
    timestamp: new Date(),
  });
  await db.update(conversationsTable).set({
    messageCount: sql`${conversationsTable.messageCount} + 2`,
    lastMessage: aiResponse.slice(0, 200),
    lastMessageAt: new Date(),
    updatedAt: new Date(),
    unreadCount: 0,
  }).where(eq(conversationsTable.id, conversationId));
}

async function upsertConversation(jid: string, displayName: string, lastMessage: string) {
  const existing = await db.select().from(conversationsTable).where(eq(conversationsTable.jid, jid)).limit(1);
  if (existing.length > 0) return existing[0];
  const isGroup = jid.endsWith("@g.us");
  const [conv] = await db.insert(conversationsTable).values({
    jid,
    displayName,
    isGroup,
    lastMessage,
    lastMessageAt: new Date(),
    messageCount: 1,
    unreadCount: 1,
  }).returning();
  return conv;
}

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [settings] = await db.insert(settingsTable).values({
    enabled: true,
    aiPersona: "You are a friendly and professional AI assistant. Use standard English. Be helpful, warm, and concise.",
    replyPrefix: null,
    ignoreSelf: true,
    greeting: "Hello! I'm an AI assistant. How can I help you today?",
  }).returning();
  return settings;
}

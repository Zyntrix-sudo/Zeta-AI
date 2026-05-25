import { Router, type IRouter } from "express";
import { ConnectWhatsAppBody, RequestPairingCodeBody } from "@workspace/api-zod";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getStatus,
} from "../lib/whatsapp.js";

const router: IRouter = Router();

router.get("/whatsapp/status", async (_req, res): Promise<void> => {
  const status = getStatus();
  res.json({
    state: status.state,
    phoneNumber: status.phoneNumber,
    displayName: status.displayName,
    qrCode: status.qrCode,
    pairingCode: status.pairingCode,
    connectedAt: status.connectedAt,
  });
});

router.post("/whatsapp/connect", async (req, res): Promise<void> => {
  const parsed = ConnectWhatsAppBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { mode } = parsed.data;
  try {
    await connectWhatsApp(mode === "pair");
    res.json({ success: true, message: "Connection initiated" });
  } catch (e: unknown) {
    const err = e as Error;
    req.log.error({ err }, "WhatsApp connect failed");
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/whatsapp/disconnect", async (_req, res): Promise<void> => {
  try {
    await disconnectWhatsApp();
    res.json({ success: true, message: "Disconnected successfully" });
  } catch (e: unknown) {
    const err = e as Error;
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/whatsapp/pair", async (req, res): Promise<void> => {
  const parsed = RequestPairingCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { phoneNumber } = parsed.data;
  const cleaned = phoneNumber.replace(/[^0-9]/g, "");
  if (cleaned.length < 10) {
    res
      .status(400)
      .json({ success: false, code: null, error: "Invalid phone number — include country code, digits only (e.g. 2348012345678)" });
    return;
  }

  try {
    await connectWhatsApp(true, cleaned);

    // Poll for pairing code — up to 25 seconds
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = getStatus();
      if (status.pairingCode) {
        res.json({
          success: true,
          code: status.pairingCode,
          message:
            "Enter this code in WhatsApp → Linked Devices → Link with Phone Number",
        });
        return;
      }
    }

    const status = getStatus();
    res.json({
      success: false,
      code: status.pairingCode ?? null,
      message:
        "Could not generate code in time. Check the phone number and try again. The number must be registered on WhatsApp.",
    });
  } catch (e: unknown) {
    const err = e as Error;
    req.log.error({ err }, "Pair failed");
    res.status(500).json({ success: false, code: null, message: err.message });
  }
});

export default router;

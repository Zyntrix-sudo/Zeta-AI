import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import whatsappRouter from "./whatsapp.js";
import conversationsRouter from "./conversations.js";
import settingsRouter from "./settings.js";
import statsRouter from "./stats.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(whatsappRouter);
router.use(conversationsRouter);
router.use(settingsRouter);
router.use(statsRouter);

export default router;

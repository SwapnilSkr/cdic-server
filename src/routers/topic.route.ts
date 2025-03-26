import { Router } from "express";
import { createTopicController, getAllTopicsController, updateTopicController, deleteTopicController } from "../controllers/topic.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticateToken, createTopicController);
router.get("/", authenticateToken, getAllTopicsController);
router.put("/:id", authenticateToken, updateTopicController);
router.delete("/:id", authenticateToken, deleteTopicController);

export default router;

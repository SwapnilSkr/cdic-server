import { Router } from "express";
import { createTopicController, getAllTopicsController, updateTopicController, deleteTopicController, getAuthorsGroupedByTopicController, getAuthorsByTopicIdController, getFlaggedAuthorsByTopicIdController } from "../controllers/topic.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", authenticateToken, createTopicController);
router.get("/", authenticateToken, getAllTopicsController);
router.get("/authors", getAuthorsGroupedByTopicController);
router.get("/:id/authors/flagged", getFlaggedAuthorsByTopicIdController);
router.get("/:id/authors", getAuthorsByTopicIdController);
router.put("/:id", authenticateToken, updateTopicController);
router.delete("/:id", authenticateToken, deleteTopicController);

export default router;

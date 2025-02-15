import { Router } from "express";
import { createTopicController, getAllTopicsController, updateTopicController, deleteTopicController } from "../controllers/topic.controller";

const router = Router();

router.post("/", createTopicController);
router.get("/", getAllTopicsController);
router.put("/:id", updateTopicController);
router.delete("/:id", deleteTopicController);

export default router;

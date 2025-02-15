import express from "express";
import { getAllStoredPosts, uploadPosts, togglePostFlag, fetchPlatformStatistics, getPostStats } from "../controllers/post.controller";

const router = express.Router();

router.post("/upload", uploadPosts);
router.get("/all", getAllStoredPosts);
router.post("/toggle-flag/:postId", togglePostFlag);
router.get("/platform-statistics", fetchPlatformStatistics);
router.get("/statistics", getPostStats);

export default router;

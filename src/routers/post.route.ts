import express from "express";
import { getAllStoredPosts, uploadPosts, togglePostFlag } from "../controllers/post.controller";

const router = express.Router();

router.post("/upload", uploadPosts);
router.get("/all", getAllStoredPosts);
router.post("/toggle-flag/:postId", togglePostFlag);

export default router;

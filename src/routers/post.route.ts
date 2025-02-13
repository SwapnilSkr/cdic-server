import express from "express";
import { getAllStoredPosts, uploadPosts } from "../controllers/post.controller";

const router = express.Router();

router.post("/upload", uploadPosts);
router.get("/all", getAllStoredPosts);

export default router;

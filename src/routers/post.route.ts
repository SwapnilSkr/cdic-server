import express from "express";
import {
  getAllStoredPosts,
  uploadPosts,
  togglePostFlag,
  fetchPlatformStatistics,
  getPostStats,
  updatePostStatus,
  getFlaggedPosts,
  getPostDetails,
  getTodayMostDiscussedFeed,
  getReviewedPosts,
  renamePlatformController,
  dismissPost,
  triggerFetchAllTopics,
  testRedditAuth,
  fetchPostByUrl,
  testBooleanQuery,
  addFieldToPostsController,
  createPostComment,
  getPostComments,
  updatePostComment,
  deletePostComment,
} from "../controllers/post.controller";
import { authenticateToken } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/upload", authenticateToken, uploadPosts);
router.post("/fetch-by-url", fetchPostByUrl);
router.get("/all", authenticateToken, getAllStoredPosts);
router.get("/flagged", authenticateToken, getFlaggedPosts);
router.post("/toggle-flag/:postId", authenticateToken, togglePostFlag);
router.get("/platform-statistics", fetchPlatformStatistics);
router.get("/statistics", getPostStats);
router.get("/today-discussed", authenticateToken, getTodayMostDiscussedFeed);
router.get("/reviewed", authenticateToken, getReviewedPosts);
router.post("/add-field", addFieldToPostsController);
router.put("/rename-platform", renamePlatformController);
router.post("/fetch-all-topics", authenticateToken, triggerFetchAllTopics);
router.post("/test-reddit", testRedditAuth);
router.post("/dismiss/:postId", authenticateToken, dismissPost);
router.get("/test-query", testBooleanQuery);
router.put("/:postId/status", authenticateToken, updatePostStatus);
router.get("/:postId", authenticateToken, getPostDetails);

// Comment Routes (nested under posts)
router.post("/:postId/comments", authenticateToken, createPostComment);
router.get("/:postId/comments", authenticateToken, getPostComments);
router.put("/:postId/comments/:commentId", authenticateToken, updatePostComment);
router.delete("/:postId/comments/:commentId", authenticateToken, deletePostComment);

export default router;

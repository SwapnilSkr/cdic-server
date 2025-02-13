import { Request, Response } from "express";
import {
  fetchAndStoreInstagramPosts,
  fetchAndStoreTwitterPosts,
  fetchAndStoreYoutubeVideos,
  getAllPosts,
} from "../services/post.service";

/**
 * Controller to handle uploading all posts.
 */
export const uploadPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== "string") {
      res
        .status(400)
        .json({ error: "Keyword parameter is required and must be a string" });
      return;
    }

    console.log(`🔍 Fetching Instagram posts for keyword: ${keyword}`);

    await fetchAndStoreInstagramPosts(keyword);

    await fetchAndStoreYoutubeVideos(keyword);

    await fetchAndStoreTwitterPosts(keyword);

    res.status(200).json({
      message: "All posts fetched and stored successfully",
      maxLimit: 500,
    });
  } catch (error) {
    console.error("❌ Error in uploadPosts controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Controller to handle retrieving all stored posts.
 */
export const getAllStoredPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log("📚 Retrieving all stored posts");
    const posts = await getAllPosts();
    const totalPosts = posts.length;

    const transformedPosts = posts.map((post) => ({
      id: post._id,
      platform: post.platform,
      author: {
        name: post.username,
        image: post.profile_pic,
      },
      sentiment: "positive", // Default sentiment
      flagged: false, // Default flagged status
      engagement: {
        likes: post.likesCount || 0,
        views: post.viewsCount || 0,
        comments: post.commentsCount || 0,
      },
      timestamp: post.created_at,
      content: post.caption,
    }));

    res.status(200).json({
      message: "Posts retrieved successfully",
      data: transformedPosts,
      totalPosts: totalPosts,
    });
  } catch (error) {
    console.error("❌ Error in getAllStoredPosts controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

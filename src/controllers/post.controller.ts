import { Request, Response } from "express";
import {
  fetchAndStoreInstagramPosts,
  fetchAndStoreTwitterPosts,
  fetchAndStoreYoutubeVideos,
  getAllPosts,
  togglePostFlagService,
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
 * Controller to handle retrieving all stored posts with pagination.
 */
export const getAllStoredPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Parse filters from query params
    const filters = {
      platforms: req.query.platforms ? (req.query.platforms as string).split(',') : [],
      dateRange: req.query.dateRange ? JSON.parse(req.query.dateRange as string) : null,
      flagStatus: req.query.flagStatus as string,
      sortBy: req.query.sortBy as string || 'recent',
      keyword: req.query.keyword as string || '',
    };

    const skip = (page - 1) * limit;
    const { 
      posts, 
      totalPosts, 
      totalFlaggedPosts,
      totalAllPosts,
      totalAllFlagged 
    } = await getAllPosts(skip, limit, filters);

    const transformedPosts = posts.map((post) => ({
      id: post._id,
      platform: post.platform,
      author: {
        name: post.username,
        image: post.profile_pic,
      },
      flagged: post.flagged,
      engagement: {
        likes: post.likesCount || 0,
        views: post.viewsCount || 0,
        comments: post.commentsCount || 0,
      },
      timestamp: post.created_at,
      content: post.caption,
    }));

    const totalPages = Math.ceil(totalPosts / limit);

    res.status(200).json({
      message: "Posts retrieved successfully",
      data: transformedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts: totalAllPosts,     // Total unfiltered posts
        totalFlaggedPosts: totalAllFlagged, // Total unfiltered flagged posts
        filteredTotal: totalPosts,     // Total with current filters
        filteredFlagged: totalFlaggedPosts, // Flagged with current filters
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ Error in getAllStoredPosts controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const togglePostFlag = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { postId } = req.params;
    const updatedPost = await togglePostFlagService(postId);
    res.status(200).json({ 
      message: "Post flag toggled successfully",
      flagged: updatedPost.flagged 
    });
  } catch (error) {
    console.error("❌ Error in togglePostFlag controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

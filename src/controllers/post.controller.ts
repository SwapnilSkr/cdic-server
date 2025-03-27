import { Request, Response } from "express";
import {
  fetchAndStoreInstagramPosts,
  fetchAndStoreTwitterPosts,
  fetchAndStoreYoutubeVideos,
  getAllPosts,
  togglePostFlagService,
  getPlatformStatistics,
  getPostStatistics,
  updatePostFlagStatus,
  getFlaggedPostsService,
  getPostDetailsService,
  getTodayMostDiscussedFeedWithTopics,
  getReviewedPostsService,
  fetchAndStoreGoogleNewsPosts,
  renamePlatformGoogleNewsToNews,
  dismissPostService,
} from "../services/post.service";
import { createTopic, updateTopic } from "../services/topic.service";
import { Topic } from "../models/topic.model";
import { convertSearchQueryToHashtag } from "../services/ai.service";
import { fetchAllTopics } from "../services/cron.service";

/**
 * Controller to handle uploading all posts.
 */
export const uploadPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const topicData = req.body;
    const userId = req.user?.id;
    const effectiveUserId = userId || topicData.createdBy;
    
    if (!effectiveUserId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!topicData.name || typeof topicData.name !== "string") {
      res
        .status(400)
        .json({ error: "Topic name parameter is required and must be a string" });
      return;
    }

    let topic : Topic | null = null;
    try {
      if (topicData._id) {
        topic = await updateTopic(topicData._id, topicData);
      } else {
        topic = await createTopic(topicData, effectiveUserId);
      }
    } catch (topicError) {
    }

    let hashtag;
    try {
      hashtag = await convertSearchQueryToHashtag(topicData.name);
    } catch (hashtagError) {
    }

    if (topic && topic.active) {
      try {
        await fetchAndStoreTwitterPosts(topicData.name, topic._id as unknown as string);
        await fetchAndStoreGoogleNewsPosts(topicData.name, topic._id as unknown as string);
        
        if (hashtag) {
          await fetchAndStoreInstagramPosts(hashtag, topic._id as unknown as string);
        }
        await fetchAndStoreYoutubeVideos(topicData.name, topic._id as unknown as string);
      } catch (fetchError) {
      }
    }

    res.status(200).json({
      message: "All posts fetched and stored successfully",
    });
  } catch (error) {
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
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    
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
    } = await getAllPosts(skip, limit, filters, userId!);

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
      image_url: post.image_url,
      post_url: post.post_url,
      flaggedBy: post.flaggedBy,
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
        totalPosts: totalAllPosts,
        totalFlaggedPosts: totalAllFlagged,
        filteredTotal: totalPosts,
        filteredFlagged: totalFlaggedPosts,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const togglePostFlag = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const updatedPost = await togglePostFlagService(postId, userId);
    res.status(200).json({ 
      message: "Post flag toggled successfully",
      flagged: updatedPost.flagged 
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updatePostStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { postId } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'escalated'].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const updatedPost = await updatePostFlagStatus(postId, status);
    res.status(200).json({
      message: "Post status updated successfully",
      status: updatedPost.flaggedStatus
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Controller function for platform statistics
 */
export const fetchPlatformStatistics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const statistics = await getPlatformStatistics();
    res.status(200).json({
      message: "Platform statistics retrieved successfully",
      data: statistics,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPostStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await getPostStatistics();
    res.status(200).json({
      message: "Post statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getFlaggedPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const dateRange = req.query.dateRange ? 
      JSON.parse(req.query.dateRange as string) : undefined;
    const status = req.query.status as string || null;

    const result = await getFlaggedPostsService({
      dateRange,
      status,
      page,
      limit
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPostDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { postId } = req.params;
    
    const postDetails = await getPostDetailsService(postId);
    
    res.status(200).json(postDetails);
  } catch (error) {
    if (error instanceof Error && error.message === 'Post not found') {
      res.status(404).json({ error: "Post not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

export const getTodayMostDiscussedFeed = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const feed = await getTodayMostDiscussedFeedWithTopics()
    res.status(200).json(feed);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getReviewedPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const posts = await getReviewedPostsService(10);
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Rename all posts with platform "GoogleNews" to "News"
 * @route PUT /api/posts/rename-platform
 * @access Admin only
 */
export const renamePlatformController = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await renamePlatformGoogleNewsToNews();
    
    res.status(200).json({
      success: true,
      message: `Successfully renamed ${result.updatedCount} posts from GoogleNews to News`,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to rename platform",
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const dismissPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { postId } = req.params;
    
    const updatedPost = await dismissPostService(postId);
    res.status(200).json({ 
      message: "Post dismiss status updated successfully",
      dismissed: updatedPost.dismissed 
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const triggerFetchAllTopics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    fetchAllTopics().catch(error => {});
    
    res.status(200).json({ 
      message: "Fetch process for all topics started successfully",
      note: "This process runs in the background and may take some time to complete"
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

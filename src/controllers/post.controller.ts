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
  fetchAndStoreRedditPosts,
  fetchPostByUrlService,
  processBooleanSearch,
  extractKeywordsFromBooleanQuery,
  filterPostsByBooleanQuery,
  addFieldToPosts,
  addCommentToPost,
  getCommentsForPost,
  updateComment,
  deleteComment,
} from "../services/post.service";
import { createTopic, updateTopic } from "../services/topic.service";
import { Topic } from "../models/topic.model";
import Post from "../models/post.model";
import { convertSearchQueryToHashtag } from "../services/ai.service";
import { fetchAllTopics } from "../services/cron.service";
import axios from "axios";

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
      res.status(400).json({
        error: "Topic name parameter is required and must be a string",
      });
      return;
    }

    let topic: Topic | null = null;
    try {
      if (topicData._id) {
        topic = await updateTopic(topicData._id, topicData);
      } else {
        topic = await createTopic(topicData, effectiveUserId);
      }
    } catch (topicError) {
      console.error("Error creating or updating topic:", topicError);
    }

    // Extract keywords from Boolean query for platforms that don't support complex search
    let keywords: string[] = [];
    try {
      keywords = extractKeywordsFromBooleanQuery(topicData.name);
      console.log(`🔍 Extracted keywords from Boolean query:`, keywords);
    } catch (keywordError) {
      console.error("Error extracting keywords:", keywordError);
    }

    if (topic && topic.active) {
      const fetchPromises = [];
      const errors = [];

      // For Twitter and YouTube, pass the full query
      try {
        await fetchAndStoreTwitterPosts(
          topicData.name,
          topic._id as unknown as string
        );
      } catch (error) {
        console.error("Error fetching Twitter posts:", error);
        errors.push({ platform: "Twitter", error });
      }

      try {
        await fetchAndStoreYoutubeVideos(
          topicData.name,
          topic._id as unknown as string
        );
      } catch (error) {
        console.error("Error fetching YouTube videos:", error);
        errors.push({ platform: "YouTube", error });
      }

      // For Reddit and News, search for each keyword separately
      if (keywords.length > 0) {
        for (const keyword of keywords) {
          try {
            await fetchAndStoreInstagramPosts(
              keyword,
              topic._id as unknown as string
            );
          } catch (error) {
            console.error(`Error fetching Instagram posts for keyword '${keyword}':`, error);
            errors.push({ platform: "Instagram", keyword, error });
          }

          try {
            await fetchAndStoreRedditPosts(
              keyword,
              topic._id as unknown as string
            );
          } catch (error) {
            console.error(`Error fetching Reddit posts for keyword '${keyword}':`, error);
            errors.push({ platform: "Reddit", keyword, error });
          }

          try {
            await fetchAndStoreGoogleNewsPosts(
              keyword,
              topic._id as unknown as string
            );
          } catch (error) {
            console.error(`Error fetching Google News posts for keyword '${keyword}':`, error);
            errors.push({ platform: "Google News", keyword, error });
          }
        }
      } else {
        // Fallback to original query if keyword extraction failed
        try {
          await fetchAndStoreInstagramPosts(
            topicData.name,
            topic._id as unknown as string
          );
        } catch (error) {
          console.error("Error fetching Instagram posts:", error);
          errors.push({ platform: "Instagram", error });
        }

        try {
          await fetchAndStoreRedditPosts(
            topicData.name,
            topic._id as unknown as string
          );
        } catch (error) {
          console.error("Error fetching Reddit posts:", error);
          errors.push({ platform: "Reddit", error });
        }

        try {
          await fetchAndStoreGoogleNewsPosts(
            topicData.name,
            topic._id as unknown as string
          );
        } catch (error) {
          console.error("Error fetching Google News posts:", error);
          errors.push({ platform: "Google News", error });
        }
      }

      // After fetching all posts, filter them based on the Boolean query
      // This will delete any posts that don't match the query
      try {
        await filterPostsByBooleanQuery(
          topic._id as unknown as string,
          topicData.name
        );
      } catch (filterError) {
        console.error("Error filtering posts by Boolean query:", filterError);
        errors.push({ process: "Boolean filtering", error: filterError });
      }

      // Return response with any fetch errors
      if (errors.length > 0) {
        res.status(207).json({
          message: "Process completed with some errors",
          successful: true,
          errors: errors.map(e => ({
            platform: e.platform || e.process,
            keyword: e.keyword,
            message: e.error instanceof Error ? e.error.message : String(e.error)
          }))
        });
        return;
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
 * Controller to handle fetching a post by url
 */
export const fetchPostByUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { url, platform, topicId } = req.body;
    const post = await fetchPostByUrlService(url, platform, topicId);
    res.status(200).json({
      message: "Post fetched successfully",
      data: post,
    });
    return;
  } catch (error) {
    console.error("Error fetching post by url:", error);
    res.status(500).json({ error: "Internal server error", details: error });
    return;
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
      platforms: req.query.platforms
        ? (req.query.platforms as string).split(",")
        : [],
      dateRange: req.query.dateRange
        ? JSON.parse(req.query.dateRange as string)
        : null,
      flagStatus: req.query.flagStatus as string,
      sortBy: (req.query.sortBy as string) || "recent",
      keyword: (req.query.keyword as string) || "",
    };

    const skip = (page - 1) * limit;
    const {
      posts,
      totalPosts,
      totalFlaggedPosts,
      totalAllPosts,
      totalAllFlagged,
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
      flagged: updatedPost.flagged,
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

    if (!["pending", "reviewed", "escalated"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const updatedPost = await updatePostFlagStatus(postId, status);
    res.status(200).json({
      message: "Post status updated successfully",
      status: updatedPost.flaggedStatus,
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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const dateRange = req.query.dateRange
      ? JSON.parse(req.query.dateRange as string)
      : undefined;
    const status = (req.query.status as string) || null;

    const result = await getFlaggedPostsService({
      dateRange,
      status,
      page,
      limit,
    }, userId);

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
    if (error instanceof Error && error.message === "Post not found") {
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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    const feed = await getTodayMostDiscussedFeedWithTopics(userId);
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
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const posts = await getReviewedPostsService(userId, limit);
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
export const renamePlatformController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await renamePlatformGoogleNewsToNews();

    res.status(200).json({
      success: true,
      message: `Successfully renamed ${result.updatedCount} posts from GoogleNews to News`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to rename platform",
      error: error instanceof Error ? error.message : String(error),
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
      dismissed: updatedPost.dismissed,
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
    fetchAllTopics().catch((error) => {});

    res.status(200).json({
      message: "Fetch process for all topics started successfully",
      note: "This process runs in the background and may take some time to complete",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const testRedditAuth = async (
  request: Request,
  res: Response
): Promise<void> => {
  try {
    // Get the keyword from request query or body
    const keyword =
      request.query.keyword || request.body.keyword || "javascript";

    // Authenticate with Reddit
    const authResponse = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      new URLSearchParams({
        grant_type: "password",
        username: process.env.REDDIT_USERNAME || "",
        password: process.env.REDDIT_PASSWORD || "",
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
          ).toString("base64")}`,
          "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
        },
      }
    );

    console.log(authResponse.data);
    const accessToken = authResponse.data.access_token;

    // Search Reddit for the keyword
    const encodedKeyword = encodeURIComponent(keyword);
    const searchUrl = `https://oauth.reddit.com/search.json?q=${encodedKeyword}&sort=new&limit=25`;

    const searchResponse = await axios.get(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
      },
    });

    // Process posts and fetch author data
    const posts = searchResponse.data.data.children;
    const processedPosts = [];
    const authorCache: Record<string, any> = {}; // Cache to avoid duplicate author requests

    for (const post of posts) {
      const postData = post.data;
      const authorName = postData.author;

      // Skip if author is deleted or unavailable
      if (authorName === "[deleted]" || !authorName) {
        continue;
      }

      // Fetch author data if not already in cache
      if (!authorCache[authorName]) {
        try {
          const authorUrl = `https://oauth.reddit.com/user/${authorName}/about.json`;
          const authorResponse = await axios.get(authorUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
            },
          });

          const authorData = authorResponse.data.data;
          authorCache[authorName] = {
            id: authorData.id,
            name: authorData.name,
            created_utc: authorData.created_utc,
            link_karma: authorData.link_karma,
            comment_karma: authorData.comment_karma,
            profile_img: authorData.icon_img || authorData.snoovatar_img || "",
            is_gold: authorData.is_gold,
            is_mod: authorData.is_mod,
            verified: authorData.verified,
            profile_url: `https://www.reddit.com/user/${authorName}`,
          };
        } catch (error: any) {
          console.error(
            `Error fetching author data for ${authorName}:`,
            error.message
          );
          // Create a basic author object if the request fails
          authorCache[authorName] = {
            name: authorName,
            profile_url: `https://www.reddit.com/user/${authorName}`,
          };
        }
      }

      // Extract image URL if it exists
      let imageUrl = "";
      if (
        postData.preview &&
        postData.preview.images &&
        postData.preview.images.length > 0 &&
        postData.preview.images[0].source
      ) {
        imageUrl = postData.preview.images[0].source.url || "";
      }

      // Create processed post with author data
      processedPosts.push({
        post: {
          id: postData.id,
          title: postData.title,
          selftext: postData.selftext,
          created_utc: postData.created_utc,
          score: postData.score,
          upvote_ratio: postData.upvote_ratio,
          num_comments: postData.num_comments,
          permalink: `https://www.reddit.com${postData.permalink}`,
          url: postData.url,
          subreddit: postData.subreddit,
          subreddit_id: postData.subreddit_id,
          is_video: postData.is_video,
          image_url: imageUrl,
          over_18: postData.over_18,
          spoiler: postData.spoiler,
          stickied: postData.stickied,
        },
        author: authorCache[authorName],
      });
    }

    // Return the processed data
    res.status(200).json({
      results: {
        posts: processedPosts,
        metadata: {
          keyword: keyword,
          count: processedPosts.length,
          after: searchResponse.data.data.after,
          before: searchResponse.data.data.before,
        },
      },
    });

    return;
  } catch (error: any) {
    console.error("Error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Internal server error",
      details: error.response?.data || error.message,
    });
  }
};

// Add a debug controller to test Boolean queries directly
export const testBooleanQuery = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, topicId } = req.body;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: "Query parameter is required" });
      return;
    }
    
    // Parse the Boolean query
    const searchQuery = processBooleanSearch(query);
    console.log("🔍 Parsed query:", JSON.stringify(searchQuery, null, 2));
    
    // Build the MongoDB query
    const mongoQuery: any = { ...searchQuery };
    if (topicId && typeof topicId === 'string') {
      mongoQuery.topic_ids = topicId;
    }
    
    // Test the query
    const matchingPosts = await Post.find(mongoQuery)
      .select('_id caption title post_url')
      .limit(10)
      .lean();
    
    // Count total matches
    const totalCount = await Post.countDocuments(mongoQuery);
    
    // Run a simple text search for comparison
    const simpleQuery = { caption: { $regex: query, $options: "i" } };
    const simpleMatches = await Post.find(topicId ? 
      { ...simpleQuery, topic_ids: topicId } : simpleQuery)
      .select('_id caption title')
      .limit(5)
      .lean();
    
    const simpleCount = await Post.countDocuments(topicId ? 
      { ...simpleQuery, topic_ids: topicId } : simpleQuery);
    
    res.status(200).json({
      message: "Query test results",
      parsed_query: searchQuery,
      matching_posts: matchingPosts,
      total_matches: totalCount,
      simple_comparison: {
        query: simpleQuery,
        matches: simpleMatches,
        count: simpleCount
      }
    });
  } catch (error) {
    console.error("Error testing boolean query:", error);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
};

export const addFieldToPostsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await addFieldToPosts();
    res.status(200).json({
      message: "Field added successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========================================
// Comment Controllers
// ========================================

export const createPostComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user?.id; // Assuming authenticateToken middleware adds user to req

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!content) {
      res.status(400).json({ error: "Comment content is required." });
      return;
    }

    const comment = await addCommentToPost(postId, userId, content, parentId || null);
    res.status(201).json(comment);

  } catch (error: any) {
    console.error("API Error adding comment:", error);
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes("Invalid")) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to add comment." });
    }
  }
};

export const getPostComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    // Optional: Check if post exists before fetching comments
    // const postExists = await Post.exists({ _id: postId });
    // if (!postExists) {
    //   res.status(404).json({ error: "Post not found." });
    //   return;
    // }

    const result = await getCommentsForPost(postId, page, limit);
    res.status(200).json(result);

  } catch (error: any) {
    console.error("API Error fetching comments:", error);
    if (error.message.includes("Invalid")) {
        res.status(400).json({ error: error.message });
    } else {
        res.status(500).json({ error: "Failed to fetch comments." });
    }
  }
};

export const updatePostComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId, commentId } = req.params; // postId might not be strictly needed but good for route structure
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!content) {
      res.status(400).json({ error: "Comment content is required." });
      return;
    }

    const updatedComment = await updateComment(commentId, userId, content);
    res.status(200).json(updatedComment);

  } catch (error: any) {
    console.error("API Error updating comment:", error);
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes("Invalid") || error.message.includes("Unauthorized")) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to update comment." });
    }
  }
};

export const deletePostComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { postId, commentId } = req.params; // postId might not be strictly needed
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await deleteComment(commentId, userId);
    res.status(200).json(result);

  } catch (error: any) {
    console.error("API Error deleting comment:", error);
    if (error.message.includes("not found")) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes("Invalid") || error.message.includes("Unauthorized")) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to delete comment." });
    }
  }
};


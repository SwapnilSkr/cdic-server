import axios from "axios";
import Post, { IPost } from "../models/post.model";
import { createInstagramAuthor, createYoutubeAuthor, createTwitterAuthor } from "./author.service";
import Author, { IAuthor } from "../models/author.model";
import mongoose from "mongoose";
import { IUser } from "../models/user.model";
import {TopicModel, Topic} from "../models/topic.model";

const MAX_POSTS = 200;

/**
 * Fetch and store Instagram posts recursively until MAX_POSTS (10) is reached.
 * @param keyword - The hashtag keyword for fetching posts.
 */
export const fetchAndStoreInstagramPosts = async (keyword: string, topicId: string): Promise<void> => {
  let totalPostsStored = 0;
  let nextPageId: string | null = null;

  try {
    while (totalPostsStored < MAX_POSTS) {
      let url = `${process.env.HIKER_API_URL_V2}/hashtag/medias/recent?name=${keyword}`;
      if (nextPageId) {
        url += `&page_id=${nextPageId}`;
      }

      console.log(`🔄 Fetching from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          "x-access-key": process.env.HIKER_API_KEY || "",
        },
      });

      const data = response.data;

      // Debug log to check response structure
      console.log("📊 Response Data Structure:", {
        hasResponse: !!data.response,
        sectionsCount: data.response?.sections?.length || 0,
      });

      if (!data.response || !data.response.sections) {
        console.error("⚠️ Invalid API response format");
        break;
      }

      const postsData: IPost[] = [];
      let foundPosts = false;

      for (const section of data.response.sections) {
        console.log("📑 Section Structure:", {
          layoutType: section.layout_type,
          hasClips: !!section.layout_content?.one_by_two_item?.clips?.items,
          hasMedias: !!section.layout_content?.medias,
        });

        // Extract all available media content from multiple sources
        const clipsItems = section.layout_content?.one_by_two_item?.clips?.items || [];
        const mediaItems = section.layout_content?.medias || [];
        const allMedias = [...clipsItems, ...mediaItems];

        console.log(`🔍 Found ${allMedias.length} total media items`);

        for (const item of allMedias) {
          if (totalPostsStored >= MAX_POSTS) break;

          const media = item.media || {};
          const postId = media.id; // Use media.id as post_id

          // Check if post already exists
          const existingPost = await Post.findOne({ post_id: postId });
          if (existingPost) {
            console.log(`⚠️ Skipping post ${postId} as it already exists.`);
            continue; // Skip if post already exists
          }

          const user = media.user || {};
          const caption = media.caption || {};

          // Create or fetch the author
          const author = await createInstagramAuthor(user.pk);
          if (!author) {
            console.log("⚠️ Skipping post due to author creation failure");
            continue;
          }

          foundPosts = true;

          const postTimestamp = media.taken_at
            ? new Date(media.taken_at * 1000)
            : new Date();

          const postUrl = `https://www.instagram.com/p/${media.code}/`;
          const imageUrl = media.image_versions2?.candidates?.[0]?.url || "";
          const videoUrl = media.video_versions?.[0]?.url || "";
          const likesCount = media.like_count || 0;
          const commentsCount = media.comment_count || 0;
          const viewsCount = media.ig_play_count || media.play_count || 0;

          postsData.push(
            new Post({
              platform: "Instagram",
              post_id: postId, // Store post ID
              author_id: author.author_id, // Store author ID
              profile_pic: user.profile_pic_url || "",
              username: user.username || "",
              caption: caption.text || "",
              image_url: imageUrl || "",
              video_url: videoUrl || "",
              likesCount,
              commentsCount,
              viewsCount, // Store views count
              created_at: postTimestamp,
              post_url: postUrl,
              topic_ids: [topicId], // Add topic reference
            })
          );
        }
      }

      // Extract next page ID
      nextPageId = data.response?.next_page_id || data.next_page_id || null;
      console.log("📄 Next page ID:", nextPageId);

      if (postsData.length > 0) {
        await Post.insertMany(postsData);
        totalPostsStored += postsData.length;
        console.log(`✅ Stored ${postsData.length} posts (Total: ${totalPostsStored}/${MAX_POSTS})`);
      } else {
        console.log("⚠️ No new posts found.");
      }

      if (!foundPosts) {
        console.log("🚀 No more valid posts found. Stopping.");
        break;
      }

      if (!nextPageId || totalPostsStored >= MAX_POSTS) {
        console.log("🚀 Fetching complete!");
        break;
      }
    }
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch and store YouTube videos recursively until MAX_POSTS (100) is reached.
 * @param keyword - The search keyword for fetching videos.
 */
export const fetchAndStoreYoutubeVideos = async (keyword: string, topicId: string): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let nextPageToken = "";

    while (totalPostsStored < MAX_POSTS) {
      const response = await axios.get(
        `${process.env.YOUTUBE_API_URL}/search?q=${keyword}&part=snippet&maxResults=50&pageToken=${nextPageToken}&key=${process.env.YOUTUBE_API_KEY}`
      );

      const videos = response.data.items;
      const postsData: IPost[] = [];

      for (const video of videos) {
        if (totalPostsStored >= MAX_POSTS) break;

        const channelId = video.snippet.channelId;
        
        // Create or fetch the author
        const author = await createYoutubeAuthor(channelId);
        if (!author) {
          console.log("⚠️ Skipping video due to author creation failure");
          continue;
        }

        const videoId = video.id.videoId;
        if (!videoId) {
          console.error("⚠️ Video ID is missing for video:", video);
          continue; // Skip if videoId is missing
        }

        // Check if post already exists
        const existingPost = await Post.findOne({ post_id: videoId });
        if (existingPost) {
          console.log(`⚠️ Skipping video ${videoId} as it already exists.`);
          continue; // Skip if post already exists
        }

        const statsResponse = await axios.get(
          `${process.env.YOUTUBE_API_URL}/videos?id=${videoId}&part=statistics&key=${process.env.YOUTUBE_API_KEY}`
        );

        const statistics = statsResponse.data.items[0]?.statistics || {};
        
        postsData.push(
          new Post({
            platform: "Youtube",
            post_id: videoId,
            author_id: author.author_id,
            profile_pic: author.profile_pic,
            username: author.username,
            title: video.snippet.title,
            caption: video.snippet.description,
            image_url: video.snippet.thumbnails.high.url,
            likesCount: parseInt(statistics.likeCount) || 0,
            commentsCount: parseInt(statistics.commentCount) || 0,
            viewsCount: parseInt(statistics.viewCount) || 0,
            created_at: new Date(video.snippet.publishedAt),
            post_url: `https://www.youtube.com/watch?v=${videoId}`,
            topic_ids: [topicId], // Add topic reference
          })
        );
      }

      if (postsData.length > 0) {
        await Post.insertMany(postsData);
        totalPostsStored += postsData.length;
        console.log(
          `✅ Stored ${postsData.length} YouTube videos (Total: ${totalPostsStored}/${MAX_POSTS})`
        );
      } else {
        console.log("⚠️ No videos found.");
        break;
      }

      nextPageToken = response.data.nextPageToken;

      if (!nextPageToken) {
        console.log("🚀 No more pages available. Stopping.");
        break;
      }
    }

    console.log("🚀 YouTube video fetching complete!");
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch and store Twitter posts recursively until MAX_POSTS (10) is reached.
 * @param keyword - The search keyword for fetching posts.
 */
export const fetchAndStoreTwitterPosts = async (keyword: string, topicId: string): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let nextCursor: string | null = null;

    while (totalPostsStored < MAX_POSTS) {
      const encodedKeyword = encodeURIComponent(keyword);
      let url = `${process.env.SOCIAL_TOOLS_API_URL}/search?query=${encodedKeyword}&type=Latest`;
      if (nextCursor) {
        url += `&cursor=${encodeURIComponent(nextCursor)}`;
      }

      console.log(`🔄 Fetching from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.SOCIAL_TOOLS_API_KEY || ""}`,
        },
      });

      const data = response.data;

      if (!data.tweets || !Array.isArray(data.tweets)) {
        console.error("⚠️ Invalid API response format");
        break;
      }

      const postsData: IPost[] = [];

      for (const tweet of data.tweets) {
        if (totalPostsStored >= MAX_POSTS) break;

        if (!tweet.id_str || !tweet.user?.screen_name) {
          console.log("⚠️ Skipping tweet due to missing required data");
          continue;
        }

        // Check if post already exists
        const existingPost = await Post.findOne({ post_id: tweet.id_str });
        if (existingPost) {
          console.log(`⚠️ Skipping tweet ${tweet.id_str} as it already exists.`);
          continue; // Skip if post already exists
        }

        // Check if author already exists
        let author = await Author.findOne({ author_id: tweet.user.id_str });
        if (!author) {
          // Create author directly from tweet data if not exists
          author = new Author({
            author_id: tweet.user.id_str,
            username: tweet.user.screen_name,
            profile_pic: tweet.user.profile_image_url_https,
            followers_count: tweet.user.followers_count,
            posts_count: tweet.user.statuses_count,
            profile_link: `https://twitter.com/${tweet.user.screen_name}`
          });

          // Save the author to the database
          await author.save();
          console.log(`✅ Created author: ${author.username}`);
        } else {
          console.log(`⚠️ Author ${author.username} already exists. Using existing author.`);
        }

        const postUrl = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
        const createdAt = new Date(tweet.tweet_created_at);

        postsData.push(
          new Post({
            platform: "Twitter",
            post_id: tweet.id_str,
            author_id: author.author_id,
            profile_pic: tweet.user.profile_image_url_https || "",
            username: tweet.user.screen_name,
            caption: tweet.full_text || "",
            created_at: createdAt,
            post_url: postUrl,
            likesCount: tweet.favorite_count || 0,
            commentsCount: tweet.reply_count || 0,
            viewsCount: tweet.views_count || 0,
            topic_ids: [topicId], // Add topic reference
          })
        );
      }

      if (postsData.length > 0) {
        await Post.insertMany(postsData);
        totalPostsStored += postsData.length;
        console.log(
          `✅ Stored ${postsData.length} Twitter posts (Total: ${totalPostsStored}/${MAX_POSTS})`
        );
      } else {
        console.log("⚠️ No posts found.");
        break;
      }

      nextCursor = data.next_cursor || null;

      if (!nextCursor || totalPostsStored >= MAX_POSTS) {
        console.log("🚀 Fetching complete!");
        break;
      }
    }

    console.log("🚀 Twitter post fetching complete!");
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

interface FilterOptions {
  platforms?: string[];
  dateRange?: { start: Date | null; end: Date | null };
  flagStatus?: string;
  sortBy?: string;
  keyword?: string;
}

export const getAllPosts = async (skip: number, limit: number, filters: FilterOptions, userId: string) => {
  try {
    // Build base query for filters
    const baseQuery: any = {};
    
    // Add keyword search across multiple fields
    if (filters.keyword) {
      baseQuery.$or = [
        { platform: { $regex: filters.keyword, $options: 'i' } },
        { username: { $regex: filters.keyword, $options: 'i' } },
        { caption: { $regex: filters.keyword, $options: 'i' } }
      ];
    }
    
    if (filters.platforms && filters.platforms.length > 0) {
      baseQuery.platform = { $in: filters.platforms };
    }

    if (filters.dateRange?.start && filters.dateRange?.end) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      baseQuery.created_at = { $gte: startDate, $lte: endDate };
    }

    if (filters.flagStatus) {
      baseQuery.flagged = filters.flagStatus === 'flagged';
      baseQuery.flaggedBy = { $in: [userId] };
    }

    // Get total counts first (unaffected by pagination)
    const totalPosts = await Post.countDocuments(baseQuery);
    const totalFlaggedPosts = await Post.countDocuments({ ...baseQuery, flagged: true });

    // Then get paginated data
    let query = Post.find(baseQuery);

    // Apply sorting
    if (filters.sortBy === 'engagement') {
      query = query.sort({
        likesCount: -1,
        commentsCount: -1
      });
    } else {
      query = query.sort({ created_at: -1 });
    }

    // Apply pagination to data fetch only
    const posts = await query.skip(skip).limit(limit).exec();

    return { 
      posts,
      totalPosts,        // Total count with filters
      totalFlaggedPosts, // Total flagged count with filters
      totalAllPosts: await Post.countDocuments({}),  // Total posts without any filters
      totalAllFlagged: await Post.countDocuments({ flagged: true }) // Total flagged without filters
    };
  } catch (error) {
    console.error("❌ Error fetching posts:", error);
    throw error;
  }
};

export const togglePostFlagService = async (postId: string, userId: string) => {
  try {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const flaggedByIndex = post.flaggedBy.indexOf(userIdObj);

    if (flaggedByIndex === -1) {
      // Add flag
      post.flaggedBy.push(userIdObj);
      post.flagged = true;
      post.flagTimestamp = new Date();
      post.flaggedStatus = 'pending';
    } else {
      // Remove flag
      post.flaggedBy = post.flaggedBy.filter(id => !id.equals(userIdObj));
      
      if (post.flaggedBy.length === 0) {
        post.flagged = false;
        post.flagTimestamp = null;
        post.flaggedStatus = null;
      }
    }

    await post.save();
    return post;
  } catch (error) {
    console.error("❌ Error toggling post flag:", error);
    throw error;
  }
};

export const updatePostFlagStatus = async (postId: string, status: string) => {
  try {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.flaggedStatus = status as 'pending' | 'reviewed' | 'escalated' | null;
    await post.save();
    return post;
  } catch (error) {
    console.error("❌ Error updating post flag status:", error);
    throw error;
  }
};

// New function to get platform statistics
export const getPlatformStatistics = async (): Promise<any> => {
  try {
    const statistics = await Post.aggregate([
      {
        $lookup: {
          from: "authors", // Join with authors collection
          localField: "author_id",
          foreignField: "author_id",
          as: "authorDetails"
        }
      },
      {
        $unwind: {
          path: "$authorDetails",
          preserveNullAndEmptyArrays: true // Preserve posts without authors
        }
      },
      {
        $group: {
          _id: "$platform",
          totalFollowers: { $sum: { $ifNull: ["$authorDetails.followers_count", 0] } }, // Sum followers from author details
          totalViews: { $sum: "$viewsCount" },
        },
      },
    ]);

    console.log("📊 Platform Statistics:", statistics); // Log the statistics for debugging
    return statistics;
  } catch (error) {
    console.error("❌ Error fetching platform statistics:", error);
    throw error;
  }
};

export const getPostStatistics = async () => {
  try {
    const totalPosts = await Post.countDocuments({});
    const flaggedPosts = await Post.countDocuments({ flagged: true });
    const factCheckedPosts = await Post.countDocuments({ 
      flaggedStatus: { $in: ['reviewed', 'escalated'] } 
    });
    const flaggedAuthors = await Author.countDocuments({ flagged: true });

    return {
      totalPosts,
      flaggedPosts,
      factCheckedPosts,
      flaggedAuthors
    };
  } catch (error) {
    console.error("❌ Error fetching post statistics:", error);
    throw error;
  }
};

export const getFlaggedPostsService = async (filters: {
  dateRange?: { from: Date; to: Date };
  status?: string | null;
  page?: number;
  limit?: number;
}) => {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    let query = Post.find({ flagged: true });

    // Apply date range filter
    if (filters.dateRange?.from && filters.dateRange?.to) {
      query = query.where('flagTimestamp')
        .gte(new Date(filters.dateRange.from).getTime())
        .lte(new Date(filters.dateRange.to).getTime());
    }

    // Apply status filter
    if (filters.status) {
      query = query.where('flaggedStatus').equals(filters.status);
    }

    // Get total count for pagination
    const totalCount = await Post.countDocuments(query.getQuery());

    // Add pagination to query
    query = query
      .skip(skip)
      .limit(limit)
      .populate('flaggedBy', 'name email')
      .sort({ flagTimestamp: -1 }); // Sort by most recently flagged

    const posts = await query.exec();

    // Transform posts
    const transformedPosts = posts.map(post => ({
      id: post._id,
      content: post.caption || post.title,
      author: post.username,
      flaggedBy: post.flaggedBy.length,
      flaggedUsers: post.flaggedBy,
      status: post.flaggedStatus,
      timestamp: post.flagTimestamp,
      platform: post.platform,
      engagement: {
        likes: post.likesCount,
        comments: post.commentsCount,
        views: post.viewsCount
      }
    }));

    return {
      items: transformedPosts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1
      }
    };
  } catch (error) {
    console.error("❌ Error fetching flagged posts:", error);
    throw error;
  }
};

export const getPostDetailsService = async (postId: string) => {
  try {
    const post = await Post.findById(postId)
      .populate<{ flaggedBy: IUser[] }>('flaggedBy', 'name email');

    if (!post) {
      throw new Error('Post not found');
    }

    // Fetch author details separately using author_id
    const author = await Author.findOne({ author_id: post.author_id });

    return {
      id: post._id,
      content: post.caption || post.title,
      author: {
        id: post.author_id,
        username: author ? author.username : post.username // Fallback to post username if author not found
      },
      flaggedBy: post.flaggedBy.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email
      })),
      status: post.flaggedStatus,
      timestamp: post.flagTimestamp,
      platform: post.platform
    };
  } catch (error) {
    console.error("❌ Error fetching post details:", error);
    throw error;
  }
};

export const getTodayMostDiscussedFeedWithTopics = async () => {
  try {
    // Get today's start (12 AM) and end dates (11:59:59 PM)
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Sets to 12:00:00.000 AM
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    console.log("Fetching posts between:", today, tomorrow);

    // Get all active topics
    const topics = await TopicModel.find({ active: true });

    // Get today's posts and calculate engagement for each topic
    const topicPosts = await Promise.all(
      topics.map(async (topic) => {
        const posts = await Post.find({
          created_at: { $gte: today, $lt: tomorrow },
          topic_ids: { $in: topic._id }
        }).sort({
          likesCount: -1,
          commentsCount: -1
        }).limit(5);

        console.log(`Found ${posts.length} posts for topic ${topic.name}`);

        // Calculate total engagement for this topic today
        const totalEngagement = posts.reduce((sum, post) => 
          sum + (post.likesCount || 0) + (post.commentsCount || 0), 0
        );

        return {
          topic: topic.name,
          totalEngagement,
          posts: posts.map(post => ({
            _id: post._id,
            content: post.caption || post.title,
            platform: post.platform,
            topic: topic.name,
            timestamp: post.created_at,
            post_url: post.post_url,
            engagement: {
              likes: post.likesCount || 0,
              comments: post.commentsCount || 0
            }
          }))
        };
      })
    );

    // Sort topics by total engagement and get top 10
    const sortedTopics = topicPosts
      .filter(topic => topic.totalEngagement > 0) // Only include topics with engagement
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 10);

    // Flatten the posts array and sort by engagement
    const allPosts = sortedTopics
      .flatMap(topic => topic.posts)
      .sort((a, b) => 
        (b.engagement.likes + b.engagement.comments) - 
        (a.engagement.likes + a.engagement.comments)
      );

    return {
      items: allPosts,
      topicsEngagement: sortedTopics.map(t => ({
        topic: t.topic,
        engagement: t.totalEngagement
      }))
    };
  } catch (error) {
    console.error("❌ Error getting today's most discussed feed:", error);
    throw error;
  }
};

export const getReviewedPostsService = async (limit: number = 10) => {
  try {
    const posts = await Post.find({ flaggedStatus: 'reviewed' })
      .sort({ flagTimestamp: -1 })
      .limit(limit);

    return {
      items: posts.map(post => ({
        id: post._id,
        content: post.caption || post.title,
        timestamp: post.flagTimestamp,
        post_url: post.post_url
      }))
    };
  } catch (error) {
    console.error("❌ Error fetching reviewed posts:", error);
    throw error;
  }
};

import axios from "axios";
import Post, { IPost } from "../models/post.model";
import { createInstagramAuthor, createYoutubeAuthor, createTwitterAuthor } from "./author.service";
import Author from "../models/author.model";

const MAX_POSTS = 200;

/**
 * Fetch and store Instagram posts recursively until MAX_POSTS (10) is reached.
 * @param keyword - The hashtag keyword for fetching posts.
 */
export const fetchAndStoreInstagramPosts = async (keyword: string): Promise<void> => {
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
export const fetchAndStoreYoutubeVideos = async (keyword: string): Promise<void> => {
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
export const fetchAndStoreTwitterPosts = async (keyword: string): Promise<void> => {
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

export const getAllPosts = async (skip: number, limit: number, filters: FilterOptions) => {
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

export const togglePostFlagService = async (postId: string) => {
  try {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error('Post not found');
    }

    post.flagged = !post.flagged;
    await post.save();
    return post;
  } catch (error) {
    console.error("❌ Error toggling post flag:", error);
    throw error;
  }
};

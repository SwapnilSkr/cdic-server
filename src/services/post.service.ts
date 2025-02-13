import axios from "axios";
import Post, { IPost } from "../models/post.model";

const MAX_POSTS = 100;

/**
 * Fetch and store Instagram posts recursively until MAX_POSTS (10) is reached.
 * @param keyword - The hashtag keyword for fetching posts.
 */
export const fetchAndStoreInstagramPosts = async (
  keyword: string
): Promise<void> => {
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
          hasMedias: !!section.layout_content?.medias,
        });

        // Extract media content
        const medias = section.layout_content?.medias || [];
        console.log(`🔍 Found ${medias.length} items in section`);

        for (const item of medias) {
          if (totalPostsStored >= MAX_POSTS) break;

          const media = item.media || {};
          const user = media.user || {};
          const caption = media.caption || {};

          // Skip if essential data is missing
          if (!media.code || !user.username) {
            console.log("⚠️ Skipping post due to missing required data");
            continue;
          }

          foundPosts = true;

          const postTimestamp = media.taken_at
            ? new Date(media.taken_at * 1000)
            : new Date();

          const postUrl = `https://www.instagram.com/p/${media.code}/`;

          // Extract first image if available
          const imageUrl = media.image_versions2?.candidates?.[0]?.url || "";

          // Extract first video URL if available
          const videoUrl = media.video_versions?.[0]?.url || "";

          // Extract likes count
          const likesCount = media.like_count || 0;

          // Extract comments count
          const commentsCount = media.comment_count || 0;

          // Extract views count (replaces shares count)
          const viewsCount = media.ig_play_count || media.play_count || 0;

          postsData.push(
            new Post({
              platform: "Instagram",
              profile_pic: user.profile_pic_url || "",
              username: user.username || "",
              caption: caption.text || "",
              image_url: imageUrl ? imageUrl : "",
              video_url: videoUrl ? videoUrl : "",
              likesCount,
              commentsCount,
              viewsCount, // ✅ Now extracting and storing views instead of shares
              created_at: postTimestamp,
              post_url: postUrl,
            })
          );
        }
      }

      // Get next page ID
      nextPageId = data.response?.next_page_id || data.next_page_id || null;
      console.log("📄 Next page ID:", nextPageId);

      // Insert posts into MongoDB
      if (postsData.length > 0) {
        await Post.insertMany(postsData);
        totalPostsStored += postsData.length;
        console.log(
          `✅ Stored ${postsData.length} posts (Total: ${totalPostsStored}/${MAX_POSTS})`
        );
      } else {
        console.log("⚠️ No new posts found.");
      }

      // Stop fetching if no new posts exist
      if (!foundPosts) {
        console.log("🚀 No more valid posts found. Stopping.");
        break;
      }

      // Stop fetching if no more pages or limit reached
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

export const fetchAndStoreYoutubeVideos = async (
  keyword: string
): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let nextPageToken = "";

    while (totalPostsStored < MAX_POSTS) {
      const response = await axios.get(
        `${process.env.YOUTUBE_API_URL}/search?q=${keyword}&part=snippet&maxResults=50&pageToken=${nextPageToken}&key=${process.env.YOUTUBE_API_KEY}`
      );

      const videos = response.data.items;
      const postsData: any[] = [];

      for (const video of videos) {
        if (totalPostsStored >= MAX_POSTS) break;

        const videoId = video.id.videoId;
        const title = video.snippet.title;
        const description = video.snippet.description;
        const thumbnailUrl = video.snippet.thumbnails.high.url;
        const channelTitle = video.snippet.channelTitle;
        const channelId = video.snippet.channelId;
        const publishedAt = new Date(video.snippet.publishedAt);
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Get channel details to get profile picture
        const channelResponse = await axios.get(
          `${process.env.YOUTUBE_API_URL}/channels?id=${channelId}&part=snippet&key=${process.env.YOUTUBE_API_KEY}`
        );
        const channelProfilePic =
          channelResponse.data.items[0]?.snippet?.thumbnails?.default?.url ||
          "";

        // Get video statistics
        const statsResponse = await axios.get(
          `${process.env.YOUTUBE_API_URL}/videos?id=${videoId}&part=statistics&key=${process.env.YOUTUBE_API_KEY}`
        );

        const statistics = statsResponse.data.items[0]?.statistics || {};
        const likesCount = parseInt(statistics.likeCount) || 0;
        const commentsCount = parseInt(statistics.commentCount) || 0;
        const viewsCount = parseInt(statistics.viewCount) || 0;

        postsData.push(
          new Post({
            platform: "Youtube",
            profile_pic: channelProfilePic,
            title,
            username: channelTitle,
            caption: description,
            image_url: thumbnailUrl,
            likesCount,
            commentsCount,
            viewsCount,
            created_at: publishedAt,
            post_url: videoUrl,
          })
        );
      }

      // Insert posts into MongoDB
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

      // Get next page token
      nextPageToken = response.data.nextPageToken;

      // Break if no more pages available
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

export const fetchAndStoreTwitterPosts = async (
  keyword: string
): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let nextCursor: string | null = null;

    while (totalPostsStored < MAX_POSTS) {
      // Encode the keyword for URL safety
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

        // Skip if essential data is missing
        if (!tweet.id_str || !tweet.user?.screen_name) {
          console.log("⚠️ Skipping tweet due to missing required data");
          continue;
        }

        const postUrl = `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
        const createdAt = new Date(tweet.tweet_created_at);

        postsData.push(
          new Post({
            platform: "Twitter",
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

      // Get next cursor from response
      nextCursor = data.next_cursor || null;

      // Break if no more pages available or we've reached the limit
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

/**
 * Fetches all stored posts from the database
 * @returns Array of posts sorted by creation date
 */
export const getAllPosts = async () => {
  try {
    const posts = await Post.find().sort({ created_at: -1 }).exec();

    console.log(`📚 Retrieved ${posts.length} posts from database`);
    return posts;
  } catch (error) {
    console.error("❌ Error fetching posts:", error);
    throw error;
  }
};

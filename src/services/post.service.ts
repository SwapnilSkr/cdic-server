import axios from "axios";
import Post, { IPost } from "../models/post.model";
import {
  createInstagramAuthor,
  createYoutubeAuthor,
  createNewsAuthor,
} from "./author.service";
import Author, { IAuthor } from "../models/author.model";
import mongoose from "mongoose";
import { IUser } from "../models/user.model";
import { TopicModel, Topic } from "../models/topic.model";
import { getJson } from "serpapi";

const MAX_POSTS = 200;

/**
 * Fetch posts from any platform with a url
 * @param url - The url of the post
 * @param platform - The platform of the post
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchPostByUrlService = async (
  url: string,
  platform: string,
  topicId: string
): Promise<IPost | null> => {
  try {
    if (platform === "Instagram") {
      return fetchInstagramPostByUrl(url, topicId);
    } else if (platform === "Twitter") {
      return fetchTwitterPostByUrl(url, topicId);
    } else if (platform === "Youtube") {
      return fetchYoutubeByUrl(url, topicId);
    } else if (platform === "Reddit") {
      return fetchRedditPostByUrl(url, topicId);
    }
    return null;
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch and store Instagram posts recursively until MAX_POSTS (100) is reached.
 * @param keyword - The hashtag keyword for fetching posts.
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchAndStoreInstagramPosts = async (
  keyword: string,
  topicId: string
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
        const clipsItems =
          section.layout_content?.one_by_two_item?.clips?.items || [];
        const mediaItems = section.layout_content?.medias || [];
        const allMedias = [...clipsItems, ...mediaItems];

        console.log(`🔍 Found ${allMedias.length} total media items`);

        for (const item of allMedias) {
          if (totalPostsStored >= MAX_POSTS) break;

          const media = item.media || {};
          const postId = media.id;

          // Check if post already exists
          const existingPost = await Post.findOne({ post_id: postId });
          if (existingPost) {
            console.log(`⚠️ Skipping post ${postId} as it already exists.`);
            continue;
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
              post_id: postId,
              author_id: author.author_id,
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
              topic_ids: [topicId],
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
        console.log(
          `✅ Stored ${postsData.length} posts (Total: ${totalPostsStored}/${MAX_POSTS})`
        );
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
 * Fetch an instagram post by url
 * @param url - The url of the instagram post
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchInstagramPostByUrl = async (
  url: string,
  topicId: string
): Promise<IPost | null> => {
  if (!url) {
    console.error("❌ Invalid Instagram URL");
    return null;
  }
  let codeFromUrl: string;
  console.log("🔄 Fetching Instagram post by url:", url);
  const codeFromPostUrl = url.match(/\/p\/([^/?]+)/)?.[1] || null;
  const codeFromReelUrl = url.match(/\/reels\/([^/?]+)/)?.[1] || null;
  if (codeFromPostUrl) {
    codeFromUrl = codeFromPostUrl;
  } else if (codeFromReelUrl) {
    codeFromUrl = codeFromReelUrl;
  } else {
    console.error("❌ Invalid Instagram URL");
    return null;
  }
  try {
    const response = await axios.get(
      `${process.env.HIKER_API_URL_V2}/media/info/by/code?code=${codeFromUrl}`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-access-key": process.env.HIKER_API_KEY || "",
        },
      }
    );
    const { media_or_ad } = response.data;
    if (!media_or_ad) {
      console.error("❌ No media or ad found");
      return null;
    }
    const { id: post_id } = media_or_ad;
    const existingPost = await Post.findOne({ post_id });
    if (existingPost) {
      console.log(`⚠️ Skipping post ${post_id} as it already exists.`);
      return existingPost;
    }
    const { caption: captionData } = media_or_ad;
    const author = await createInstagramAuthor(captionData.user.pk);
    if (!author) {
      console.error("❌ No author found");
      return null;
    }
    const { id: author_id } = captionData.user;
    const { username } = captionData.user;
    const { profile_pic_url: profile_pic } = captionData.user;
    const { text: caption } = captionData;
    const { like_count: likesCount } = media_or_ad;
    const { comment_count: commentsCount } = media_or_ad;
    let viewsCount = 0;
    if (media_or_ad.play_count) {
      viewsCount = media_or_ad.play_count;
    } else if (media_or_ad.ig_play_count) {
      viewsCount = media_or_ad.ig_play_count;
    }
    const created_at = media_or_ad.taken_at
      ? new Date(media_or_ad.taken_at * 1000)
      : new Date();
    const post_url = `https://www.instagram.com/p/${codeFromUrl}/`;
    const image_url = media_or_ad.image_versions2?.candidates?.[0]?.url || "";
    const video_url = media_or_ad.video_versions?.[0]?.url || "";
    const post = new Post({
      platform: "Instagram",
      post_id,
      author_id,
      profile_pic,
      username,
      caption,
      image_url,
      video_url,
      likesCount,
      commentsCount,
      viewsCount,
      created_at,
      post_url,
      topic_ids: [topicId],
    });
    await post.save();
    return post;
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch and store YouTube videos recursively until MAX_POSTS (100) is reached.
 * @param keyword - The search keyword for fetching videos.
 * @param topicId - The topic ID associated with these videos.
 */
export const fetchAndStoreYoutubeVideos = async (
  keyword: string,
  topicId: string
): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let nextPageToken = "";
    let searchApiCallCount = 0; // Counter for search API calls only
    const MAX_SEARCH_API_CALLS = 2; // Maximum number of search API calls allowed

    while (
      totalPostsStored < MAX_POSTS &&
      searchApiCallCount < MAX_SEARCH_API_CALLS
    ) {
      searchApiCallCount++;
      console.log(
        `🔄 Making YouTube Search API call #${searchApiCallCount}/${MAX_SEARCH_API_CALLS}`
      );

      const response = await axios.get(
        `${process.env.YOUTUBE_API_URL}/search?q=${keyword}&part=snippet&maxResults=100&pageToken=${nextPageToken}&key=${process.env.YOUTUBE_API_KEY}`
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

      if (searchApiCallCount >= MAX_SEARCH_API_CALLS) {
        console.log(
          `🚀 Reached maximum search API call limit (${MAX_SEARCH_API_CALLS}). Stopping.`
        );
        break;
      }
    }

    console.log(
      `🚀 YouTube video fetching complete! Made ${searchApiCallCount} search API calls.`
    );
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch a YouTube video by url
 *
 * @param url - The url of the YouTube video
 * @param topicId - The topic ID associated with this video
 */
export const fetchYoutubeByUrl = async (
  url: string,
  topicId: string
): Promise<IPost | null> => {
  try {
    if (!url) {
      console.error("❌ Invalid YouTube URL");
      return null;
    }

    // Extract the video ID from the URL
    const videoIdMatch = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    );
    if (!videoIdMatch) {
      console.error("❌ Could not extract video ID from YouTube URL");
      return null;
    }

    const videoId = videoIdMatch[1];
    console.log(`🔄 Fetching YouTube video with ID: ${videoId}`);

    // Check if post already exists
    const existingPost = await Post.findOne({ post_id: videoId });
    if (existingPost) {
      console.log(`⚠️ Skipping video ${videoId} as it already exists.`);
      return existingPost;
    }

    // Fetch video details from YouTube API
    const videoResponse = await axios.get(
      `${process.env.YOUTUBE_API_URL}/videos?id=${videoId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`
    );

    const videoData = videoResponse.data.items[0];
    if (!videoData) {
      console.error("❌ No video found with the given ID");
      return null;
    }

    const channelId = videoData.snippet.channelId;

    // Check if author already exists
    let author = await Author.findOne({ author_id: channelId });

    if (!author) {
      // Fetch channel details
      const channelResponse = await axios.get(
        `${process.env.YOUTUBE_API_URL}/channels?id=${channelId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`
      );

      const channelData = channelResponse.data.items[0];
      if (!channelData) {
        console.error("❌ No channel found with the given ID");
        return null;
      }

      // Create author from channel data
      author = new Author({
        author_id: channelId,
        username: channelData.snippet.title,
        profile_pic: channelData.snippet.thumbnails.high.url,
        followers_count: parseInt(channelData.statistics.subscriberCount) || 0,
        posts_count: parseInt(channelData.statistics.videoCount) || 0,
        profile_link: `https://www.youtube.com/channel/${channelId}`,
      });

      // Save the author to the database
      await author.save();
      console.log(`✅ Created author: ${author.username}`);
    } else {
      console.log(
        `⚠️ Author ${author.username} already exists. Using existing author.`
      );
    }

    const statistics = videoData.statistics || {};
    const createdAt = new Date(videoData.snippet.publishedAt);

    // Create the post
    const post = new Post({
      platform: "Youtube",
      post_id: videoId,
      author_id: author.author_id,
      profile_pic: author.profile_pic,
      username: author.username,
      title: videoData.snippet.title,
      caption: videoData.snippet.description,
      image_url: videoData.snippet.thumbnails.high.url,
      likesCount: parseInt(statistics.likeCount) || 0,
      commentsCount: parseInt(statistics.commentCount) || 0,
      viewsCount: parseInt(statistics.viewCount) || 0,
      created_at: createdAt,
      post_url: `https://www.youtube.com/watch?v=${videoId}`,
      topic_ids: [topicId], // Add topic reference
    });

    await post.save();
    console.log(`✅ Successfully fetched and saved YouTube video: ${videoId}`);
    return post;
  } catch (error) {
    console.error("❌ Error fetching or storing YouTube data:", error);
    throw error;
  }
};

/**
 * Fetch and store Twitter posts recursively until MAX_POSTS (10) is reached.
 * @param keyword - The search keyword for fetching posts.
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchAndStoreTwitterPosts = async (
  keyword: string,
  topicId: string
): Promise<void> => {
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
          console.log(
            `⚠️ Skipping tweet ${tweet.id_str} as it already exists.`
          );
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
            profile_link: `https://twitter.com/${tweet.user.screen_name}`,
          });

          // Save the author to the database
          await author.save();
          console.log(`✅ Created author: ${author.username}`);
        } else {
          console.log(
            `⚠️ Author ${author.username} already exists. Using existing author.`
          );
        }

        const postUrl = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
        const createdAt = new Date(tweet.tweet_created_at);

        // Extract image URL from entities.media if it exists
        let imageUrl = "";
        if (
          tweet.entities &&
          tweet.entities.media &&
          tweet.entities.media.length > 0
        ) {
          imageUrl = tweet.entities.media[0].media_url_https || "";
        }

        postsData.push(
          new Post({
            platform: "Twitter",
            post_id: tweet.id_str,
            author_id: author.author_id,
            profile_pic: tweet.user.profile_image_url_https || "",
            username: tweet.user.screen_name,
            caption: tweet.full_text || "",
            image_url: imageUrl, // Add the extracted image URL
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

/**
 * fetch a twitter post by url
 *
 * @param url - The url of the post
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchTwitterPostByUrl = async (
  url: string,
  topicId: string
): Promise<IPost | null> => {
  try {
    if (!url) {
      console.error("❌ Invalid Twitter URL");
      return null;
    }

    // Extract the post ID from the URL
    const postIdMatch = url.match(/\/status\/(\d+)/);
    if (!postIdMatch) {
      console.error("❌ Could not extract post ID from Twitter URL");
      return null;
    }

    const postId = postIdMatch[1];
    console.log(`🔄 Fetching Twitter post with ID: ${postId}`);

    // Check if post already exists
    const existingPost = await Post.findOne({ post_id: postId });
    if (existingPost) {
      console.log(`⚠️ Skipping tweet ${postId} as it already exists.`);
      return existingPost;
    }

    // Fetch the tweet using the Twitter API
    const response = await axios.get(
      `${process.env.SOCIAL_TOOLS_API_URL}/tweets/${postId}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.SOCIAL_TOOLS_API_KEY || ""}`,
        },
      }
    );

    const tweet = response.data;

    if (!tweet || !tweet.id_str) {
      console.error("❌ Invalid API response format");
      return null;
    }

    // Create or fetch the author
    let author = await Author.findOne({ author_id: tweet.user.id_str });
    if (!author) {
      // Create author directly from tweet data if not exists
      author = new Author({
        author_id: tweet.user.id_str,
        username: tweet.user.screen_name,
        profile_pic: tweet.user.profile_image_url_https,
        followers_count: tweet.user.followers_count,
        posts_count: tweet.user.statuses_count,
        profile_link: `https://twitter.com/${tweet.user.screen_name}`,
      });

      // Save the author to the database
      await author.save();
      console.log(`✅ Created author: ${author.username}`);
    } else {
      console.log(
        `⚠️ Author ${author.username} already exists. Using existing author.`
      );
    }

    const postUrl = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
    const createdAt = new Date(tweet.tweet_created_at);

    // Extract image URL from entities.media if it exists
    let imageUrl = "";
    if (
      tweet.entities &&
      tweet.entities.media &&
      tweet.entities.media.length > 0
    ) {
      imageUrl = tweet.entities.media[0].media_url_https || "";
    }

    // Create the post
    const post = new Post({
      platform: "Twitter",
      post_id: tweet.id_str,
      author_id: author.author_id,
      profile_pic: tweet.user.profile_image_url_https || "",
      username: tweet.user.screen_name,
      caption: tweet.full_text || tweet.text || "",
      image_url: imageUrl,
      created_at: createdAt,
      post_url: postUrl,
      likesCount: tweet.favorite_count || 0,
      commentsCount: tweet.reply_count || 0,
      viewsCount: tweet.views_count || 0,
      topic_ids: [topicId], // Add topic reference
    });

    await post.save();
    console.log(
      `✅ Successfully fetched and saved Twitter post: ${tweet.id_str}`
    );
    return post;
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

/**
 * Fetch and store Google News posts until MAX_POSTS (50) is reached.
 * @param keyword - The keyword to search for.
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchAndStoreGoogleNewsPosts = async (
  keyword: string,
  topicId: string
): Promise<void> => {
  let totalPostsStored = 0;
  let startIndex = 0; // For pagination

  try {
    while (totalPostsStored < MAX_POSTS) {
      console.log(
        `🔄 Fetching Google News for keyword: ${keyword} (startIndex: ${startIndex})`
      );

      const response = await getJson({
        engine: "google_news",
        q: keyword,
        gl: "us",
        hl: "en",
        start: startIndex, // Add pagination parameter
        api_key: process.env.SERP_API_KEY || "",
      });

      const newsResults = response.news_results;

      if (
        !newsResults ||
        !Array.isArray(newsResults) ||
        newsResults.length === 0
      ) {
        console.log(
          "⚠️ No more news results available or invalid response format"
        );
        break;
      }

      console.log(`📊 Found ${newsResults.length} news articles`);

      const postsData: IPost[] = [];

      for (const article of newsResults) {
        if (totalPostsStored >= MAX_POSTS) break;

        const postId = article.link; // Use article URL as unique post_id

        // Check if post already exists
        const existingPost = await Post.findOne({ post_id: postId });
        if (existingPost) {
          console.log(`⚠️ Skipping article ${postId} as it already exists.`);
          continue;
        }

        // Create a news author from the source
        const newsSource = article.source || null;
        if (!newsSource || !newsSource.name) {
          console.log(
            "⚠️ Skipping article due to invalid source:",
            article.title
          );
          continue;
        }
        const author = await createNewsAuthor(newsSource);
        if (!author) {
          console.log("⚠️ Skipping article due to author creation failure");
          continue;
        }

        const postTimestamp = new Date(article.date || new Date());

        postsData.push(
          new Post({
            platform: "News",
            post_id: postId,
            author_id: author.author_id,
            profile_pic: article.source?.icon || "", // Use source icon if available
            username: newsSource.name,
            caption: article.title,
            image_url: article.thumbnail || "",
            created_at: postTimestamp,
            post_url: article.link,
            likesCount: 0, // News articles don't have likes
            commentsCount: 0,
            viewsCount: 0,
            topic_ids: [topicId],
          })
        );
      }

      if (postsData.length > 0) {
        await Post.insertMany(postsData);
        totalPostsStored += postsData.length;
        console.log(
          `✅ Stored ${postsData.length} news articles (Total: ${totalPostsStored}/${MAX_POSTS})`
        );
      } else {
        console.log("⚠️ No new articles found");
        break;
      }

      if (totalPostsStored >= MAX_POSTS) {
        console.log("🚀 Reached maximum posts limit!");
        break;
      }

      // Update startIndex for next page (typically Google uses 10 results per page)
      startIndex += newsResults.length;

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("🚀 Google News fetching complete!");
  } catch (error) {
    console.error("❌ Error fetching or storing data:", error);
    throw error;
  }
};

/**
 * Fetch and store Reddit posts until MAX_POSTS (50) is reached.
 * @param keyword - The keyword to search for.
 * @param topicId - The topic ID associated with these posts.
 */
export const fetchAndStoreRedditPosts = async (
  keyword: string,
  topicId: string
): Promise<void> => {
  try {
    let totalPostsStored = 0;
    let after: string | null = null;
    const MAX_POSTS = 100; // Define maximum posts to fetch

    // Authenticate with Reddit
    console.log("🔑 Authenticating with Reddit API...");
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

    const accessToken = authResponse.data.access_token;
    console.log("✅ Successfully authenticated with Reddit");

    // Create a cache for author data to avoid duplicate requests
    const authorCache: Record<string, any> = {};

    while (totalPostsStored < MAX_POSTS) {
      const encodedKeyword = encodeURIComponent(keyword);
      let url = `https://oauth.reddit.com/search.json?q=${encodedKeyword}&sort=new&limit=25`;
      if (after) {
        url += `&after=${encodeURIComponent(after)}`;
      }

      console.log(`🔄 Fetching from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = response.data;

      if (!data.data || !Array.isArray(data.data.children)) {
        console.error("⚠️ Invalid API response format");
        break;
      }

      const postsData: IPost[] = [];

      for (const post of data.data.children) {
        if (totalPostsStored >= MAX_POSTS) break;

        const postData = post.data;

        if (!postData.id || !postData.author) {
          console.log("⚠️ Skipping post due to missing required data");
          continue;
        }

        // Skip if author is deleted or unavailable
        if (postData.author === "[deleted]" || !postData.author) {
          console.log("⚠️ Skipping post due to deleted or unavailable author");
          continue;
        }

        // Check if post already exists
        const existingPost = await Post.findOne({ post_id: postData.id });
        if (existingPost) {
          console.log(`⚠️ Skipping post ${postData.id} as it already exists.`);
          continue; // Skip if post already exists
        }

        // Check if author already exists in database
        let author = await Author.findOne({ author_id: postData.author });

        // If not in DB and not in cache, fetch author data
        if (!author && !authorCache[postData.author]) {
          try {
            const authorUrl = `https://oauth.reddit.com/user/${postData.author}/about.json`;
            console.log(`🔄 Fetching author data for: ${postData.author}`);

            const authorResponse = await axios.get(authorUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
              },
            });

            const authorData = authorResponse.data.data;
            authorCache[postData.author] = {
              author_id: authorData.id,
              username: authorData.name,
              profile_pic:
                authorData.icon_img || authorData.snoovatar_img || "",
              followers_count: authorData.link_karma + authorData.comment_karma, // Using karma as a proxy for popularity
              posts_count: 0, // Reddit doesn't easily provide this
              profile_link: `https://www.reddit.com/user/${postData.author}`,
            };
          } catch (error: any) {
            console.error(
              `❌ Error fetching author data for ${postData.author}:`,
              error.message
            );
            // Create a basic author object if the request fails
            authorCache[postData.author] = {
              author_id: postData.author,
              username: postData.author,
              profile_pic: "",
              followers_count: 0,
              posts_count: 0,
              profile_link: `https://www.reddit.com/user/${postData.author}`,
            };
          }
        }

        // Create or get the author
        if (!author) {
          try {
            // Use data from cache
            const authorData = authorCache[postData.author];

            // Try to find one more time (in case it was created between our earlier check and now)
            author = await Author.findOne({ author_id: authorData.author_id });

            if (!author) {
              // Use findOneAndUpdate with upsert to prevent race conditions
              author = await Author.findOneAndUpdate(
                { author_id: authorData.author_id },
                {
                  author_id: authorData.author_id,
                  username: authorData.username,
                  profile_pic: authorData.profile_pic,
                  followers_count: authorData.followers_count,
                  posts_count: authorData.posts_count,
                  profile_link: authorData.profile_link,
                },
                { new: true, upsert: true }
              );
              console.log(`✅ Created author: ${author?.username}`);
            } else {
              console.log(
                `⚠️ Author ${author?.username} already exists. Using existing author.`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error creating author: ${postData.author}`,
              error
            );
            // Skip this post if we can't create the author
            continue;
          }
        } else {
          console.log(
            `⚠️ Author ${author.username} already exists. Using existing author.`
          );
        }

        const postUrl = `https://www.reddit.com${postData.permalink}`;
        const createdAt = new Date(postData.created_utc * 1000); // Convert Unix timestamp to Date

        // Extract image URL if it exists
        let imageUrl = "";
        if (
          postData.preview &&
          postData.preview.images &&
          postData.preview.images.length > 0 &&
          postData.preview.images[0].source
        ) {
          imageUrl =
            postData.preview.images[0].source.url.replace(/&amp;/g, "&") || "";
        } else if (
          postData.thumbnail &&
          postData.thumbnail !== "self" &&
          postData.thumbnail !== "default"
        ) {
          imageUrl = postData.thumbnail;
        }

        // Extract video URL if it exists
        let videoUrl = "";
        if (
          postData.is_video &&
          postData.media &&
          postData.media.reddit_video
        ) {
          videoUrl = postData.media.reddit_video.fallback_url || "";
        }

        // Create post document for DB storage
        postsData.push(
          new Post({
            platform: "Reddit",
            post_id: postData.id,
            author_id: author?.author_id || "",
            profile_pic: author?.profile_pic || "",
            username: postData.author,
            caption: postData.selftext || "",
            title: postData.title || "",
            image_url: imageUrl,
            video_url: videoUrl,
            created_at: createdAt,
            post_url: postUrl,
            likesCount: postData.score || 0,
            commentsCount: postData.num_comments || 0,
            viewsCount: 0, // Reddit doesn't provide view counts
            topic_ids: [topicId], // Add topic reference
            flagged: false,
            dismissed: false,
          })
        );
      }

      // Store posts in database
      if (postsData.length > 0) {
        try {
          // Insert posts one by one to avoid stopping the entire batch on error
          let successCount = 0;
          for (const post of postsData) {
            try {
              await post.save();
              successCount++;
            } catch (error: any) {
              if (error.code === 11000) {
                // Duplicate key error, just log and continue
                console.log(`⚠️ Skipping duplicate post: ${post.post_id}`);
              } else {
                console.error(
                  `❌ Error saving post ${post.post_id}:`,
                  error.message
                );
              }
            }
          }

          totalPostsStored += successCount;
          console.log(
            `✅ Stored ${successCount} Reddit posts (Total: ${totalPostsStored}/${MAX_POSTS})`
          );
        } catch (error) {
          console.error("❌ Error batch storing posts:", error);
        }
      } else {
        console.log("⚠️ No posts found.");
        break;
      }

      after = data.data.after || null;

      if (!after || totalPostsStored >= MAX_POSTS) {
        console.log("🚀 Fetching complete!");
        break;
      }
    }

    console.log("🚀 Reddit post fetching complete!");
  } catch (error) {
    console.error("❌ Error fetching or storing Reddit data:", error);
    throw error;
  }
};

/**
 * Fetch a Reddit post by URL and store it in the database
 *
 * @param url - The URL of the Reddit post
 * @param topicId - The topic ID associated with this post
 * @returns The stored post or null if failed
 */
export const fetchRedditPostByUrl = async (
  url: string,
  topicId: string
): Promise<IPost | null> => {
  try {
    if (!url) {
      console.error("❌ Invalid Reddit URL");
      return null;
    }

    // Extract the post ID from the URL
    // Reddit URLs can be in formats like:
    // https://www.reddit.com/r/subreddit/comments/postid/title/
    // https://old.reddit.com/r/subreddit/comments/postid/title/
    // https://reddit.com/comments/postid/
    const postIdMatch = url.match(/\/comments\/([a-z0-9]+)/i);
    if (!postIdMatch) {
      console.error("❌ Could not extract post ID from Reddit URL");
      return null;
    }

    const postId = postIdMatch[1];
    console.log(`🔄 Fetching Reddit post with ID: ${postId}`);

    // Check if post already exists
    const existingPost = await Post.findOne({ post_id: postId });
    if (existingPost) {
      console.log(`⚠️ Skipping post ${postId} as it already exists.`);
      return existingPost;
    }

    // Authenticate with Reddit
    console.log("🔑 Authenticating with Reddit API...");
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

    const accessToken = authResponse.data.access_token;
    console.log("✅ Successfully authenticated with Reddit");

    // Fetch the post using the Reddit API
    const response = await axios.get(
      `https://oauth.reddit.com/api/info.json?id=t3_${postId}`,
      {
        headers: {
          "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = response.data;
    if (
      !data.data ||
      !Array.isArray(data.data.children) ||
      data.data.children.length === 0
    ) {
      console.error("❌ Invalid API response format or post not found");
      return null;
    }

    const postData = data.data.children[0].data;

    if (!postData.id || !postData.author) {
      console.error("❌ Missing required post data");
      return null;
    }

    // Skip if author is deleted or unavailable
    if (postData.author === "[deleted]" || !postData.author) {
      console.error("❌ Post has deleted or unavailable author");
      return null;
    }

    // Fetch author data
    let author = await Author.findOne({ author_id: postData.author });
    if (!author) {
      try {
        const authorUrl = `https://oauth.reddit.com/user/${postData.author}/about.json`;
        console.log(`🔄 Fetching author data for: ${postData.author}`);

        const authorResponse = await axios.get(authorUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "MyApp/1.0.0 (by /u/your_username)",
          },
        });

        const authorData = authorResponse.data.data;
        author = new Author({
          author_id: authorData.id,
          username: authorData.name,
          profile_pic: authorData.icon_img || authorData.snoovatar_img || "",
          followers_count: authorData.link_karma + authorData.comment_karma,
          posts_count: 0, // Reddit doesn't easily provide this
          profile_link: `https://www.reddit.com/user/${postData.author}`,
        });

        await author.save();
        console.log(`✅ Created author: ${author.username}`);
      } catch (error: any) {
        console.error(
          `❌ Error fetching author data for ${postData.author}:`,
          error.message
        );

        // Create a basic author object if the request fails
        author = new Author({
          author_id: postData.author,
          username: postData.author,
          profile_pic: "",
          followers_count: 0,
          posts_count: 0,
          profile_link: `https://www.reddit.com/user/${postData.author}`,
        });

        await author.save();
        console.log(`✅ Created basic author: ${author.username}`);
      }
    } else {
      console.log(
        `⚠️ Author ${author.username} already exists. Using existing author.`
      );
    }

    const postUrl = `https://www.reddit.com${postData.permalink}`;
    const createdAt = new Date(postData.created_utc * 1000);

    // Extract image URL if it exists
    let imageUrl = "";
    if (
      postData.preview &&
      postData.preview.images &&
      postData.preview.images.length > 0 &&
      postData.preview.images[0].source
    ) {
      imageUrl =
        postData.preview.images[0].source.url.replace(/&amp;/g, "&") || "";
    } else if (
      postData.thumbnail &&
      postData.thumbnail !== "self" &&
      postData.thumbnail !== "default"
    ) {
      imageUrl = postData.thumbnail;
    }

    // Extract video URL if it exists
    let videoUrl = "";
    if (postData.is_video && postData.media && postData.media.reddit_video) {
      videoUrl = postData.media.reddit_video.fallback_url || "";
    }

    // Create the post
    const post = new Post({
      platform: "Reddit",
      post_id: postData.id,
      author_id: author.author_id,
      profile_pic: author.profile_pic || "",
      username: postData.author,
      caption: postData.selftext || "",
      title: postData.title || "",
      image_url: imageUrl,
      video_url: videoUrl,
      created_at: createdAt,
      post_url: postUrl,
      likesCount: postData.score || 0,
      commentsCount: postData.num_comments || 0,
      viewsCount: 0, // Reddit doesn't provide view counts
      topic_ids: [topicId], // Add topic reference
      flagged: false,
      dismissed: false,
    });

    await post.save();
    console.log(
      `✅ Successfully fetched and saved Reddit post: ${postData.id}`
    );
    return post;
  } catch (error) {
    console.error("❌ Error fetching or storing Reddit post:", error);
    throw error;
  }
};

export const getAllPosts = async (
  skip: number,
  limit: number,
  filters: FilterOptions,
  userId: string
) => {
  try {
    // Build base query for filters
    const baseQuery: any = {
      $or: [
        { dismissed: false },
        { dismissed: { $exists: false } }, // Include posts where dismissed field doesn't exist
      ],
    };

    // Process keyword with Boolean search syntax
    if (filters.keyword) {
      // If we have a keyword, we'll focus the search on the caption field
      // using the Boolean search syntax
      const searchQuery = processBooleanSearch(filters.keyword);

      // Apply the search query to the caption field
      if (searchQuery) {
        // Instead of assigning directly to baseQuery.caption,
        // we merge the search query with the base query
        Object.assign(baseQuery, searchQuery);
      } else {
        // Fallback to simple search if Boolean parsing fails
        baseQuery.$or = [
          { platform: { $regex: `\\b${escapeRegExp(filters.keyword)}\\b`, $options: "i" } },
          { username: { $regex: `\\b${escapeRegExp(filters.keyword)}\\b`, $options: "i" } },
          { caption: { $regex: `\\b${escapeRegExp(filters.keyword)}\\b`, $options: "i" } },
        ];
      }
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
      baseQuery.flagged = filters.flagStatus === "flagged";
      baseQuery.flaggedBy = { $in: [userId] };
    }

    console.log("Final query:", JSON.stringify(baseQuery, null, 2));

    // Get total counts first (unaffected by pagination)
    const totalPosts = await Post.countDocuments(baseQuery);
    const totalFlaggedPosts = await Post.countDocuments({
      ...baseQuery,
      flagged: true,
    });

    // Get total counts without filters (but still excluding dismissed posts)
    const totalAllPosts = await Post.countDocuments({
      $or: [{ dismissed: false }, { dismissed: { $exists: false } }],
    });
    const totalAllFlagged = await Post.countDocuments({
      $or: [{ dismissed: false }, { dismissed: { $exists: false } }],
      flagged: true,
    });

    // Then get paginated data
    let query = Post.find(baseQuery);

    // Apply sorting
    if (filters.sortBy === "engagement") {
      query = query.sort({
        likesCount: -1,
        commentsCount: -1,
      });
    } else if (filters.sortBy === "oldest") {
      query = query.sort({ created_at: 1 });
    } else {
      query = query.sort({ created_at: -1 });
    }

    // Apply pagination to data fetch only
    const posts = await query.skip(skip).limit(limit).exec();

    return {
      posts,
      totalPosts,
      totalFlaggedPosts,
      totalAllPosts,
      totalAllFlagged,
    };
  } catch (error) {
    console.error("❌ Error fetching posts:", error);
    throw error;
  }
};

/**
 * Process a Boolean search query string into a MongoDB query object
 * Supports: AND, OR, NOT, exact phrases with quotes, grouping with parentheses
 * @param query - The Boolean query string to process
 * @returns MongoDB query object or null if parsing fails
 */
function processBooleanSearch(query: string): any {
  try {
    // Track the current position in parsing
    let position = 0;

    // Main parsing function that handles the query string
    function parseExpression(): any {
      // Skip whitespace
      while (position < query.length && /\s/.test(query[position])) {
        position++;
      }

      if (position >= query.length) return null;

      // Parse OR expressions (lowest precedence)
      const left = parseAND();
      if (position < query.length) {
        // Look for OR operator
        if (
          position + 2 < query.length &&
          query.substring(position, position + 2).toUpperCase() === "OR" &&
          /\s/.test(query[position + 2])
        ) {
          position += 3; // Skip "OR" and the space
          const right = parseExpression();
          if (right) {
            return { $or: [left, right] };
          }
        }
      }

      return left;
    }

    // Parse AND expressions (medium precedence)
    function parseAND(): any {
      // Parse NOT expressions first (higher precedence)
      let left = parseNOT();

      // Look for AND operator
      while (position < query.length) {
        // Skip whitespace
        while (position < query.length && /\s/.test(query[position])) {
          position++;
        }

        if (
          position + 3 < query.length &&
          query.substring(position, position + 3).toUpperCase() === "AND" &&
          /\s/.test(query[position + 3])
        ) {
          position += 4; // Skip "AND" and the space
          const right = parseNOT();
          if (right) {
            // Create a proper $and array with both conditions
            if (left.$and) {
              // If left already has $and, add right to it
              left.$and.push(right);
            } else {
              // Otherwise create a new $and array
              left = { $and: [left, right] };
            }
          }
        } else {
          break;
        }
      }

      return left;
    }

    // Parse NOT expressions (high precedence)
    function parseNOT(): any {
      // Skip whitespace
      while (position < query.length && /\s/.test(query[position])) {
        position++;
      }

      // Check for NOT operator
      if (
        position + 3 < query.length &&
        query.substring(position, position + 3).toUpperCase() === "NOT" &&
        /\s/.test(query[position + 3])
      ) {
        position += 4; // Skip "NOT" and the space
        const expr = parseTerm();
        if (expr) {
          // Create a proper $not query
          // MongoDB doesn't allow $not with a document, so we need to handle this differently
          // We'll use $nor which is equivalent to NOT in this case
          return { $nor: [expr] };
        }
      }

      return parseTerm();
    }

    // Parse basic terms (highest precedence)
    function parseTerm(): any {
      // Skip whitespace
      while (position < query.length && /\s/.test(query[position])) {
        position++;
      }

      if (position >= query.length) return null;

      // Handle parentheses for grouping
      if (query[position] === "(") {
        position++; // Skip opening parenthesis
        const expr = parseExpression();

        // Skip whitespace
        while (position < query.length && /\s/.test(query[position])) {
          position++;
        }

        if (position < query.length && query[position] === ")") {
          position++; // Skip closing parenthesis
          return expr;
        } else {
          throw new Error("Missing closing parenthesis");
        }
      }

      // Handle quoted phrases
      if (query[position] === '"') {
        position++; // Skip opening quote
        let phrase = "";

        while (position < query.length && query[position] !== '"') {
          phrase += query[position];
          position++;
        }

        if (position < query.length) {
          position++; // Skip closing quote
          // Return a proper regex query object with word boundaries for each word
          const words = phrase.split(/\s+/);
          const wordBoundaryPhrase = words.map(w => `\\b${escapeRegExp(w)}\\b`).join('\\s+');
          return { caption: { $regex: wordBoundaryPhrase, $options: "i" } };
        } else {
          throw new Error("Missing closing quote");
        }
      }

      // Handle NEAR operator
      const nearRegex = /^(\w+)\s+NEAR\/(\d+)\s+(\w+)/i;
      const nearSubstring = query.substring(position);
      const nearMatch = nearSubstring.match(nearRegex);

      if (nearMatch) {
        const word1 = nearMatch[1];
        const distance = parseInt(nearMatch[2]);
        const word2 = nearMatch[3];

        // Skip the matched NEAR expression
        position += nearMatch[0].length;

        // For NEAR, we create a regex that matches both words within N words of each other
        // Using word boundaries for whole word matching
        const pattern = `\\b${escapeRegExp(
          word1
        )}\\b(?:\\s+\\w+){0,${distance}}\\s+\\b${escapeRegExp(
          word2
        )}\\b|\\b${escapeRegExp(
          word2
        )}\\b(?:\\s+\\w+){0,${distance}}\\s+\\b${escapeRegExp(word1)}\\b`;
        return { caption: { $regex: pattern, $options: "i" } };
      }

      // Handle wildcards
      let term = "";
      let hasWildcard = false;

      while (
        position < query.length &&
        !/[\s()"]/.test(query[position]) &&
        !query.substring(position).match(/^(AND|OR|NOT)\b/i)
      ) {
        if (query[position] === "*") {
          hasWildcard = true;
        }
        term += query[position];
        position++;
      }

      if (!term) return null;

      // Process wildcards
      if (hasWildcard) {
        const pattern = escapeRegExp(term).replace(/\\\*/g, ".*");
        // Add word boundaries for partial wildcards (e.g., "test*" should match "testing" but not "attest")
        // Only add the start boundary if the wildcard is not at the beginning
        const startBoundary = term.startsWith("*") ? "" : "\\b";
        // Only add the end boundary if the wildcard is not at the end
        const endBoundary = term.endsWith("*") ? "" : "\\b";
        return { caption: { $regex: `${startBoundary}${pattern}${endBoundary}`, $options: "i" } };
      }

      // Regular term - add word boundaries for whole word matching
      return { caption: { $regex: `\\b${escapeRegExp(term)}\\b`, $options: "i" } };
    }

    // Helper function to escape special regex characters
    function escapeRegExp(string: string): string {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Let's add some debugging to see what's going on
    console.log("🔍 Original query:", query);
    const result = parseExpression();
    console.log("🔍 Parsed query object:", JSON.stringify(result, null, 2));

    // One final check to ensure we have a valid MongoDB query object
    if (result === null) {
      // Use word boundaries for simple search too
      return { caption: { $regex: `\\b${escapeRegExp(query)}\\b`, $options: "i" } };
    }

    return result;
  } catch (error) {
    console.error("❌ Error parsing Boolean search:", error, "Query:", query);
    // Fallback to simple search on error, also with word boundaries
    return { caption: { $regex: `\\b${escapeRegExp(query)}\\b`, $options: "i" } };
  }
}

// Move this helper function outside the main function to make it accessible
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const togglePostFlagService = async (postId: string, userId: string) => {
  try {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const userIdObj = new mongoose.Types.ObjectId(userId);
    const flaggedByIndex = post.flaggedBy.indexOf(userIdObj);

    if (flaggedByIndex === -1) {
      // Add flag
      post.flaggedBy.push(userIdObj);
      post.flagged = true;
      post.flagTimestamp = new Date();
      post.flaggedStatus = "pending";
    } else {
      // Remove flag
      post.flaggedBy = post.flaggedBy.filter((id) => !id.equals(userIdObj));

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
      throw new Error("Post not found");
    }

    post.flaggedStatus = status as "pending" | "reviewed" | "escalated" | null;
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
          as: "authorDetails",
        },
      },
      {
        $unwind: {
          path: "$authorDetails",
          preserveNullAndEmptyArrays: true, // Preserve posts without authors
        },
      },
      {
        $group: {
          _id: "$platform",
          totalFollowers: {
            $sum: { $ifNull: ["$authorDetails.followers_count", 0] },
          }, // Sum followers from author details
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
      flaggedStatus: { $in: ["reviewed", "escalated"] },
    });
    const flaggedAuthors = await Author.countDocuments({ flagged: true });

    return {
      totalPosts,
      flaggedPosts,
      factCheckedPosts,
      flaggedAuthors,
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
      query = query
        .where("flagTimestamp")
        .gte(new Date(filters.dateRange.from).getTime())
        .lte(new Date(filters.dateRange.to).getTime());
    }

    // Apply status filter
    if (filters.status) {
      query = query.where("flaggedStatus").equals(filters.status);
    }

    // Get total count for pagination
    const totalCount = await Post.countDocuments(query.getQuery());

    // Add pagination to query
    query = query
      .skip(skip)
      .limit(limit)
      .populate("flaggedBy", "name email")
      .sort({ flagTimestamp: -1 }); // Sort by most recently flagged

    const posts = await query.exec();

    // Transform posts
    const transformedPosts = posts.map((post) => ({
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
        views: post.viewsCount,
      },
    }));

    return {
      items: transformedPosts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("❌ Error fetching flagged posts:", error);
    throw error;
  }
};

export const getPostDetailsService = async (postId: string) => {
  try {
    const post = await Post.findById(postId).populate<{ flaggedBy: IUser[] }>(
      "flaggedBy",
      "name email"
    );

    if (!post) {
      throw new Error("Post not found");
    }

    // Fetch author details separately using author_id
    const author = await Author.findOne({ author_id: post.author_id });

    return {
      id: post._id,
      content: post.caption || post.title,
      author: {
        id: post.author_id,
        username: author ? author.username : post.username, // Fallback to post username if author not found
      },
      flaggedBy: post.flaggedBy.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
      })),
      status: post.flaggedStatus,
      timestamp: post.flagTimestamp,
      platform: post.platform,
    };
  } catch (error) {
    console.error("❌ Error fetching post details:", error);
    throw error;
  }
};

export const getTodayMostDiscussedFeedWithTopics = async () => {
  try {
    // Get current time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istNow = new Date(now.getTime() + istOffset);

    // Set to start of day in IST (00:00:00)
    const istToday = new Date(istNow);
    istToday.setUTCHours(0, 0, 0, 0);

    // Set to end of day in IST (23:59:59.999)
    const istTomorrow = new Date(istToday);
    istTomorrow.setUTCDate(istTomorrow.getUTCDate() + 1);

    // Convert back to UTC for MongoDB query
    const utcToday = new Date(istToday.getTime() - istOffset);
    const utcTomorrow = new Date(istTomorrow.getTime() - istOffset);

    console.log(
      "Current time (IST):",
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    );
    console.log(
      "Query range (UTC):",
      utcToday.toISOString(),
      "to",
      utcTomorrow.toISOString()
    );
    console.log(
      "Query range (IST):",
      utcToday.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      "to",
      utcTomorrow.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    );

    // Get all active topics
    const topics = await TopicModel.find({ active: true });

    // Get today's posts and calculate engagement for each topic
    const topicPosts = await Promise.all(
      topics.map(async (topic) => {
        const posts = await Post.find({
          created_at: {
            $gte: utcToday,
            $lt: utcTomorrow,
          },
          topic_ids: { $in: topic._id },
        })
          .sort({
            likesCount: -1,
            commentsCount: -1,
          })
          .limit(5);

        const totalEngagement = posts.reduce(
          (sum, post) =>
            sum + (post.likesCount || 0) + (post.commentsCount || 0),
          0
        );

        return {
          topic: topic.name,
          totalEngagement,
          posts: posts.map((post) => ({
            _id: post._id,
            content: post.caption || post.title,
            platform: post.platform,
            topic: topic.name,
            timestamp: post.created_at,
            post_url: post.post_url,
            engagement: {
              likes: post.likesCount || 0,
              comments: post.commentsCount || 0,
            },
          })),
        };
      })
    );

    // Sort topics by total engagement and get top 10
    const sortedTopics = topicPosts
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, 10);

    // Flatten the posts array and sort by engagement
    const allPosts = sortedTopics
      .flatMap((topic) => topic.posts)
      .sort(
        (a, b) =>
          b.engagement.likes +
          b.engagement.comments -
          (a.engagement.likes + a.engagement.comments)
      );

    return {
      items: allPosts,
      topicsEngagement: sortedTopics.map((t) => ({
        topic: t.topic,
        engagement: t.totalEngagement,
      })),
    };
  } catch (error) {
    console.error("❌ Error getting today's most discussed feed:", error);
    throw error;
  }
};

export const getReviewedPostsService = async (limit: number = 10) => {
  try {
    const posts = await Post.find({ flaggedStatus: "reviewed" })
      .sort({ flagTimestamp: -1 })
      .limit(limit);

    return {
      items: posts.map((post) => ({
        id: post._id,
        content: post.caption || post.title,
        timestamp: post.flagTimestamp,
        post_url: post.post_url,
      })),
    };
  } catch (error) {
    console.error("❌ Error fetching reviewed posts:", error);
    throw error;
  }
};

/**
 * Rename all posts with platform "GoogleNews" to "News"
 * @returns Object containing the count of updated posts
 */
export const renamePlatformGoogleNewsToNews = async (): Promise<{
  updatedCount: number;
}> => {
  try {
    console.log("🔄 Starting platform rename operation: GoogleNews → News");

    // Find and update all posts with platform "GoogleNews"
    const result = await Post.updateMany(
      { platform: "Google News" },
      { $set: { platform: "News" } }
    );

    console.log(
      `✅ Successfully renamed ${result.modifiedCount} posts from GoogleNews to News`
    );

    return {
      updatedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("❌ Error renaming platform:", error);
    throw error;
  }
};

export const dismissPostService = async (postId: string) => {
  try {
    const post = await Post.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Toggle the dismissed state
    post.dismissed = !post.dismissed;

    // Update timestamp if being dismissed
    if (post.dismissed) {
      post.dismissTimestamp = new Date();
    } else {
      post.dismissTimestamp = null;
    }

    await post.save();
    return post;
  } catch (error) {
    console.error("❌ Error dismissing post:", error);
    throw error;
  }
};

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

// Create necessary indexes for post queries
const createPostIndexes = async () => {
  try {
    // Core indexes for frequent queries
    await Post.collection.createIndex({ dismissed: 1, created_at: -1 }, { background: true });
    await Post.collection.createIndex({ platform: 1, dismissed: 1 }, { background: true });
    await Post.collection.createIndex({ flagged: 1, flaggedBy: 1 }, { background: true });
    await Post.collection.createIndex({ caption: "text", username: "text" }, { background: true });
    
    // Compound indexes for common filter combinations
    await Post.collection.createIndex({ 
      dismissed: 1, 
      platform: 1, 
      created_at: -1 
    }, { background: true });
    
    await Post.collection.createIndex({ 
      dismissed: 1, 
      flagged: 1, 
      created_at: -1 
    }, { background: true });
    
    console.log("✅ All post indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating post indexes:", error);
  }
};

// Run this once to create all necessary indexes, then comment it out
// createPostIndexes();

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
      // Changed endpoint from hashtag/medias/recent to search/topsearch
      let url = `${process.env.HIKER_API_URL_V2}/search/topsearch?query=${keyword}`;
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
        hasMediaGrid: !!data.media_grid,
        sectionsCount: data.media_grid?.sections?.length || 0,
        rankToken: data.rank_token || null,
      });

      if (!data.media_grid || !data.media_grid.sections) {
        console.error("⚠️ Invalid API response format");
        break;
      }

      const postsData: IPost[] = [];
      let foundPosts = false;

      // Process each section from the media_grid
      for (const section of data.media_grid.sections) {
        console.log("📑 Section Structure:", {
          layoutType: section.layout_type,
          feedType: section.feed_type || null,
          hasOneByTwoItem: !!section.layout_content?.one_by_two_item,
        });

        // Check for clips items in the one_by_two_item
        if (section.layout_content?.one_by_two_item?.clips?.items) {
          const clipsItems = section.layout_content.one_by_two_item.clips.items;
          console.log(`🔍 Found ${clipsItems.length} clips items`);
          
          for (const item of clipsItems) {
            if (totalPostsStored >= MAX_POSTS) break;
            
            const media = item.media || {};
            const postId = media.pk || media.id;
            
            if (!postId) {
              console.log("⚠️ Skipping post due to missing post ID");
              continue;
            }

            // Check if post already exists
            const existingPost = await Post.findOne({ post_id: postId.toString() });
            if (existingPost) {
              console.log(`⚠️ Skipping post ${postId} as it already exists.`);
              continue;
            }

            const user = media.user || {};
            if (!user.pk) {
              console.log("⚠️ Skipping post due to missing user data");
              continue;
            }

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
            const viewsCount = media.play_count || media.view_count || media.ig_play_count || 0;
            const captionText = media.caption?.text || "";

            postsData.push(
              new Post({
                platform: "Instagram",
                post_id: postId.toString(),
                author_id: author.author_id,
                profile_pic: user.profile_pic_url || "",
                username: user.username || "",
                caption: captionText,
                image_url: imageUrl,
                video_url: videoUrl,
                likesCount,
                commentsCount,
                viewsCount,
                created_at: postTimestamp,
                post_url: postUrl,
                topic_ids: [topicId],
              })
            );
          }
        }

        // Check for fill_items in the section
        if (section.fill_items && Array.isArray(section.fill_items)) {
          console.log(`🔍 Found ${section.fill_items.length} fill items`);
          
          for (const item of section.fill_items) {
            if (totalPostsStored >= MAX_POSTS) break;
            
            const media = item.media || {};
            const postId = media.pk || media.id;
            
            if (!postId) {
              console.log("⚠️ Skipping post due to missing post ID");
              continue;
            }

            // Check if post already exists
            const existingPost = await Post.findOne({ post_id: postId.toString() });
            if (existingPost) {
              console.log(`⚠️ Skipping post ${postId} as it already exists.`);
              continue;
            }

            const user = media.user || {};
            if (!user.pk) {
              console.log("⚠️ Skipping post due to missing user data");
              continue;
            }

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
            const viewsCount = media.play_count || media.view_count || media.ig_play_count || 0;
            const captionText = media.caption?.text || "";

            postsData.push(
              new Post({
                platform: "Instagram",
                post_id: postId.toString(),
                author_id: author.author_id,
                profile_pic: user.profile_pic_url || "",
                username: user.username || "",
                caption: captionText,
                image_url: imageUrl,
                video_url: videoUrl,
                likesCount,
                commentsCount,
                viewsCount,
                created_at: postTimestamp,
                post_url: postUrl,
                topic_ids: [topicId],
              })
            );
          }
        }
      }

      // Extract next page ID if available in the response
      nextPageId = data.rank_token || null;
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
    const startTime = Date.now();
    console.log(`🔍 Starting getAllPosts with skip=${skip}, limit=${limit}`);
    
    // Build optimized query for better index usage
    const baseQuery: any = { dismissed: { $ne: true } };
    
    // Track which indexes we're likely using for monitoring
    const usedIndexes = ['dismissed_1_created_at_-1']; // Base index we're always using
    
    // Apply platform filter - leverages compound index { dismissed: 1, platform: 1 }
    if (filters.platforms && filters.platforms.length > 0) {
      baseQuery.platform = { $in: filters.platforms };
      usedIndexes.push('dismissed_1_platform_1');
    }
    
    // Apply date range filter - works with our date-based indexes
    if (filters.dateRange?.start && filters.dateRange?.end) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      baseQuery.created_at = { $gte: startDate, $lte: endDate };
    }
    
    // Apply flag status filter - uses flag index
    if (filters.flagStatus) {
      baseQuery.flagged = filters.flagStatus === "flagged";
      baseQuery.flaggedBy = { $in: [userId] };
      usedIndexes.push('flagged_1_flaggedBy_1');
    }
    
    // Process keyword search with Boolean search logic
    if (filters.keyword) {
      // Try to use text index for better performance
      const searchQuery = processBooleanSearch(filters.keyword);
      
      if (searchQuery) {
        // Boolean search query handled by custom parser
        Object.assign(baseQuery, searchQuery);
      } else if (filters.keyword.includes(" ") && filters.keyword.length > 5) {
        // Use full text index for multi-word searches
        baseQuery.$text = { $search: filters.keyword };
        usedIndexes.push('caption_text_username_text');
      } else {
        // For simple single-word queries, use optimized regex
        // This approach is faster than $text for simple queries
        const searchTerm = escapeRegExp(filters.keyword);
        baseQuery.$or = [
          { platform: { $regex: searchTerm, $options: "i" } },
          { username: { $regex: searchTerm, $options: "i" } },
          { caption: { $regex: searchTerm, $options: "i" } },
        ];
      }
    }
    
    console.log(`⏱️ Query prepared in ${Date.now() - startTime}ms using likely indexes: ${usedIndexes.join(', ')}`);
    console.log(`Query:`, JSON.stringify(baseQuery, null, 2));
    
    // Determine optimal sort options based on filter criteria
    let sortOptions: any = {};
    
    if (filters.sortBy === "engagement") {
      sortOptions = { likesCount: -1, commentsCount: -1 };
    } else if (filters.sortBy === "oldest") {
      sortOptions = { created_at: 1 };
    } else {
      // Default to newest first
      sortOptions = { created_at: -1 };
    }
    
    // Use MongoDB aggregation for better performance with large datasets
    const countPipeline = [
      { $match: baseQuery },
      { $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          flaggedPosts: { $sum: { $cond: [{ $eq: ["$flagged", true] }, 1, 0] } }
      }}
    ];
    
    // Use separate lightweight query for total counts (not affected by filters except dismissed)
    const totalCountsPipeline = [
      { $match: { dismissed: { $ne: true } } },
      { $group: {
          _id: null,
          totalAllPosts: { $sum: 1 },
          totalAllFlagged: { $sum: { $cond: [{ $eq: ["$flagged", true] }, 1, 0] } }
      }}
    ];
    
    // Execute main query and count operations in parallel
    console.log(`⏱️ Starting data fetch at ${Date.now() - startTime}ms`);
    
    const [posts, countResults, totalCountResults] = await Promise.all([
      // Main data query with pagination, lean for performance
      Post.find(baseQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select('platform post_id author_id profile_pic username caption image_url title video_url likesCount commentsCount viewsCount created_at post_url flagged flaggedBy flagTimestamp flaggedStatus topic_ids')
        .lean()
        .exec(),
      
      // Count query for filtered posts
      Post.aggregate(countPipeline).exec(),
      
      // Count query for all posts (regardless of filter)
      Post.aggregate(totalCountsPipeline).exec()
    ]);
    
    console.log(`⏱️ Data fetched in ${Date.now() - startTime}ms, found ${posts.length} posts`);
    
    // Extract counts from the aggregation results
    const countData = countResults[0] || { totalPosts: 0, flaggedPosts: 0 };
    const totalCountData = totalCountResults[0] || { totalAllPosts: 0, totalAllFlagged: 0 };
    
    // Return the optimized result
    const result = {
      posts,
      totalPosts: countData.totalPosts || 0,
      totalFlaggedPosts: countData.flaggedPosts || 0,
      totalAllPosts: totalCountData.totalAllPosts || 0,
      totalAllFlagged: totalCountData.totalAllFlagged || 0
    };
    
    console.log(`⏱️ getAllPosts completed in ${Date.now() - startTime}ms`);
    return result;
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
export function processBooleanSearch(query: string): any {
  try {
    console.log(`🔍 Raw query for parsing: "${query}"`);
    
    // Handle empty query
    if (!query || query.trim() === '') {
      return {};
    }
    
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

      // Handle double-quoted phrases
      if (query[position] === '"') {
        position++; // Skip opening quote
        let phrase = "";

        while (position < query.length && query[position] !== '"') {
          phrase += query[position];
          position++;
        }

        if (position < query.length) {
          position++; // Skip closing quote
          console.log(`🔍 Parsed double-quoted phrase: "${phrase}"`);
          return { caption: { $regex: escapeRegExp(phrase), $options: "i" } };
        } else {
          throw new Error("Missing closing double quote");
        }
      }

      // Handle single-quoted phrases
      if (query[position] === "'") {
        position++; // Skip opening quote
        let phrase = "";

        while (position < query.length && query[position] !== "'") {
          phrase += query[position];
          position++;
        }

        if (position < query.length) {
          position++; // Skip closing quote
          console.log(`🔍 Parsed single-quoted phrase: "${phrase}"`);
          return { caption: { $regex: escapeRegExp(phrase), $options: "i" } };
        } else {
          throw new Error("Missing closing single quote");
        }
      }

      // Handle regular terms (non-quoted, non-operator words)
      let term = "";

      while (
        position < query.length &&
        !/[\s()'"]/g.test(query[position]) && // Stop at space, parentheses, quotes
        !query.substring(position).match(/^(AND|OR|NOT)\b/i) // Stop at operators
      ) {
        term += query[position];
        position++;
      }

      if (!term) return null;
      
      console.log(`🔍 Parsed regular term: "${term}"`);
      return { caption: { $regex: escapeRegExp(term), $options: "i" } };
    }

    console.log("🔍 Parsing query:", query);
    const result = parseExpression();
    console.log("🔍 Parsed query object:", JSON.stringify(result, null, 2));

    // Handle null result
    if (result === null) {
      console.log("🔍 Query parsing resulted in null, using fallback");
      return { caption: { $regex: ".*", $options: "i" } }; // Match everything as fallback
    }

    return result;
  } catch (error) {
    console.error("❌ Error parsing Boolean search:", error, "Query:", query);
    // Just log the error but don't throw, return a default query that matches everything
    return { caption: { $regex: ".*", $options: "i" } };
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

// Function to extract keywords from a Boolean query expression
// Examples:
// - "Cyclone disaster management" AND "Odisha" → ["Cyclone disaster management", "Odisha"]
// - ("COVID-19" OR "Coronavirus") AND "Vaccine" → ["COVID-19", "Coronavirus", "Vaccine"]
// - 'Climate change' AND ("Paris Agreement" OR "COP26") → ["Climate change", "Paris Agreement", "COP26"]
export const extractKeywordsFromBooleanQuery = (query: string): string[] => {
  try {
    console.log("🔍 Extracting keywords from query:", query);
    
    // Special case: If we have a simple AND expression, extract both terms exactly
    if (query.includes(" AND ")) {
      const parts = query.split(" AND ");
      const extractedTerms = parts.map(part => {
        const trimmed = part.trim();
        // Remove surrounding quotes if present
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || 
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          return trimmed.substring(1, trimmed.length - 1);
        }
        return trimmed;
      });
      
      console.log("🔍 Extracted keywords from AND expression:", extractedTerms);
      return extractedTerms;
    }
    
    // Extract all phrases enclosed in quotes (both double and single quotes)
    const keywords: string[] = [];
    
    // Match phrases in double quotes
    const doubleQuoteRegex = /"([^"]+)"/g;
    let match;
    
    while ((match = doubleQuoteRegex.exec(query)) !== null) {
      // Add the complete phrase as a single keyword
      keywords.push(match[1]);
    }
    
    // Match phrases in single quotes
    const singleQuoteRegex = /'([^']+)'/g;
    
    while ((match = singleQuoteRegex.exec(query)) !== null) {
      // Add the complete phrase as a single keyword
      keywords.push(match[1]);
    }
    
    // If no quoted phrases were found, fall back to using the entire query
    if (keywords.length === 0) {
      // Remove boolean operators
      const cleanQuery = query.replace(/\b(AND|OR|NOT)\b/g, '').trim();
      
      // Remove surrounding quotes if they exist
      const unquotedQuery = cleanQuery.replace(/^['"](.*)['"]$/, '$1');
      
      // If there are no operators and no quotes, use the whole thing
      if (unquotedQuery.length > 0) {
        keywords.push(unquotedQuery);
      }
    }
    
    console.log("🔍 Extracted keywords (preserving phrases):", keywords);
    return keywords;
  } catch (error) {
    console.error("❌ Error extracting keywords from Boolean query:", error);
    return [];
  }
};

// Function to filter posts based on Boolean query
export const filterPostsByBooleanQuery = async (topicId: string, query: string): Promise<void> => {
  try {
    console.log(`🔍 Filtering posts for topic ${topicId} using query: ${query}`);
    
    // Get all posts associated with this topic
    const allPosts = await Post.find({ topic_ids: topicId }).select('_id caption title author_id').lean();
    console.log(`🔍 Found ${allPosts.length} posts to filter`);
    
    if (allPosts.length === 0) {
      console.log("⚠️ No posts to filter");
      return;
    }
    
    // Extract the required words from the query
    // This is an extremely simple approach: just extract all words and require ALL of them to be present
    const getRequiredWords = (queryStr: string): string[] => {
      // Remove all boolean operators and special characters
      const cleanedQuery = queryStr
        .replace(/\b(AND|OR|NOT)\b/gi, ' ')  // Remove boolean operators
        .replace(/[()"']/g, ' ')            // Remove parentheses and quotes
        .replace(/\s+/g, ' ')               // Normalize whitespace
        .trim();
      
      // Split into words and filter out short words
      const words = cleanedQuery
        .split(' ')
        .map(word => word.toLowerCase())
        .filter(word => word.length > 2);  // Filter out very short words
      
      // Remove duplicates
      const uniqueWords = [...new Set(words)];
      console.log(`🔍 Required words extracted from query: ${uniqueWords.join(', ')}`);
      return uniqueWords;
    };
    
    // EXTREMELY SIMPLE APPROACH: Just require ALL words to be in the content
    const requiredWords = getRequiredWords(query);
    
    // Function to check if ALL required words are in the content
    const contentContainsAllWords = (content: string, words: string[]): boolean => {
      const normalizedContent = content.toLowerCase();
      
      for (const word of words) {
        // Try to find the word with flexible matching
        const isPresent = normalizedContent.includes(word);
        
        if (!isPresent) {
          return false; // If any word is missing, return false immediately
        }
      }
      
      return true; // All words were found
    };
    
    // Process posts
    const matchingPosts = [];
    const unmatchingPosts = [];
    
    for (const post of allPosts) {
      const content = (post.caption || post.title || "").toLowerCase();
      
      // Just check if ALL required words are in the content
      if (contentContainsAllWords(content, requiredWords)) {
        matchingPosts.push({
          id: post._id,
          content: content.substring(0, 100) + "..." // Truncate for readability
        });
      } else {
        unmatchingPosts.push({
          id: post._id,
          author_id: post.author_id,
          content: content.substring(0, 100) + "..." // Truncate for readability
        });
      }
    }
    
    console.log(`🔍 Found ${matchingPosts.length} matching posts and ${unmatchingPosts.length} non-matching posts`);
    
    // Log examples for verification
    console.log("\n📑 MATCHING POSTS EXAMPLES:");
    for (let i = 0; i < Math.min(5, matchingPosts.length); i++) {
      console.log(`✅ Post ${i+1}: "${matchingPosts[i].content}"`);
    }
    
    console.log("\n📑 NON-MATCHING POSTS EXAMPLES:");
    for (let i = 0; i < Math.min(5, unmatchingPosts.length); i++) {
      console.log(`❌ Post ${i+1}: "${unmatchingPosts[i].content}"`);
    }
    
    // Delete posts that don't match
    if (unmatchingPosts.length > 0) {
      const unmatchingIds = unmatchingPosts.map(p => p.id);
      
      // Delete posts in batches to avoid overwhelming the database
      const BULK_CHUNK_SIZE = 500;
      for (let i = 0; i < unmatchingIds.length; i += BULK_CHUNK_SIZE) {
        const bulkChunk = unmatchingIds.slice(i, i + BULK_CHUNK_SIZE);
        const result = await Post.deleteMany({ _id: { $in: bulkChunk } });
        console.log(`✅ Deleted batch ${Math.floor(i/BULK_CHUNK_SIZE) + 1}: Removed ${result.deletedCount} posts`);
      }
      
      // Delete authors that no longer have any posts
      await deleteAuthorsWithoutPosts(unmatchingPosts.map(p => p.author_id));
    }
    
    console.log(`✅ Filtering complete: kept ${matchingPosts.length} matching posts, removed ${unmatchingPosts.length} non-matching posts`);
  } catch (error) {
    console.error("❌ Error filtering posts by Boolean query:", error);
    throw error;
  }
};

// Helper function to delete authors that no longer have any posts
async function deleteAuthorsWithoutPosts(authorIds: string[]): Promise<void> {
  try {
    // Skip if no author IDs to check
    if (!authorIds || authorIds.length === 0) {
      return;
    }
    
    console.log(`🔍 Checking ${authorIds.length} authors to see if they have any remaining posts...`);
    const uniqueAuthorIds = [...new Set(authorIds)]; // Remove duplicates
    
    // For each author, check if they have any remaining posts
    const authorsToDelete = [];
    for (const authorId of uniqueAuthorIds) {
      const postCount = await Post.countDocuments({ author_id: authorId });
      if (postCount === 0) {
        authorsToDelete.push(authorId);
      }
    }
    
    // Delete authors with no posts
    if (authorsToDelete.length > 0) {
      const result = await Author.deleteMany({ author_id: { $in: authorsToDelete } });
      console.log(`✅ Deleted ${result.deletedCount} authors who no longer have any posts`);
    } else {
      console.log(`ℹ️ No authors to delete - all still have posts`);
    }
  } catch (error) {
    console.error("❌ Error deleting authors without posts:", error);
  }
}


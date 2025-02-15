import Author, { IAuthor } from '../models/author.model';
import axios from 'axios';
import Post from '../models/post.model';

export const createInstagramAuthor = async (userId: string): Promise<IAuthor | null> => {
  try {
    // Check if author already exists
    const existingAuthor = await Author.findOne({ author_id: userId });
    if (existingAuthor) {
      return existingAuthor;
    }

    // Fetch user data from Instagram API
    const url = `${process.env.HIKER_API_URL_V2}/user/by/id?id=${parseInt(userId)}`;
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        "x-access-key": process.env.HIKER_API_KEY || "",
      },
    });

    const userData = response.data.user;
    
    // Create new author
    const author = new Author({
      author_id: userData.pk_id,
      username: userData.username,
      profile_pic: userData.profile_pic_url,
      followers_count: parseInt(userData.follower_count) || 0,
      posts_count: parseInt(userData.media_count) || 0,
      profile_link: `https://www.instagram.com/${userData.username}/`
    });

    await author.save();
    console.log(`✅ Created author: ${userData.username}`);
    return author;
  } catch (error) {
    console.error('❌ Error creating author:', error);
    return null;
  }
};

export const createYoutubeAuthor = async (channelId: string): Promise<IAuthor | null> => {
  try {
    // Check if author already exists
    const existingAuthor = await Author.findOne({ author_id: channelId });
    if (existingAuthor) {
      return existingAuthor;
    }

    // Fetch channel data from YouTube API
    const response = await axios.get(
      `${process.env.YOUTUBE_API_URL}/channels?id=${channelId}&part=snippet,statistics&key=${process.env.YOUTUBE_API_KEY}`
    );

    const channelData = response.data.items[0];
    if (!channelData) {
      console.error('❌ Channel data not found');
      return null;
    }

    // Create new author
    const author = new Author({
      author_id: channelId,
      username: channelData.snippet.title,
      profile_pic: channelData.snippet.thumbnails.default.url,
      followers_count: parseInt(channelData.statistics.subscriberCount) || 0,
      posts_count: parseInt(channelData.statistics.videoCount) || 0,
      profile_link: `https://www.youtube.com/channel/${channelId}`
    });

    await author.save();
    console.log(`✅ Created author: ${channelData.snippet.title}`);
    return author;
  } catch (error) {
    console.error('❌ Error creating author:', error);
    return null;
  }
};

export const createTwitterAuthor = async (userId: string): Promise<IAuthor | null> => {
  try {
    // Check if author already exists
    const existingAuthor = await Author.findOne({ author_id: userId });
    if (existingAuthor) {
      return existingAuthor;
    }

    // Fetch user data from Twitter API
    const response = await axios.get(
      `${process.env.TWITTER_API_URL}/users/${userId}`, // Adjust the URL as per your API
      {
        headers: {
          "Authorization": `Bearer ${process.env.TWITTER_API_KEY}`,
        },
      }
    );

    const userData = response.data.data; // Adjust based on your API response structure

    // Create new author
    const author = new Author({
      author_id: userData.id,
      username: userData.username,
      profile_pic: userData.profile_image_url_https,
      followers_count: userData.public_metrics.followers_count,
      posts_count: userData.public_metrics.tweet_count,
      profile_link: `https://twitter.com/${userData.username}`
    });

    await author.save();
    console.log(`✅ Created author: ${userData.username}`);
    return author;
  } catch (error) {
    console.error('❌ Error creating author:', error);
    return null;
  }
};

export const getAllAuthorsInfo = async (
  page: number, 
  limit: number, 
  search?: string,
  platform?: string
): Promise<{ authors: any[], totalAuthors: number }> => {
  try {
    // First get all author_ids that have posts in the specified platform
    let authorIdsWithPlatform: string[] = [];
    if (platform) {
      const platformPosts = await Post.find({ platform }).distinct('author_id');
      authorIdsWithPlatform = platformPosts;
    }

    // Build the query
    let query = Author.find()
    
    // Apply search filter if provided
    if (search) {
      query = query.where('username', new RegExp(search, 'i'))
    }

    // Apply platform filter if provided
    if (platform) {
      query = query.where('author_id').in(authorIdsWithPlatform)
    }

    // Get total count before pagination
    const totalAuthors = await Author.countDocuments(query.getQuery())

    // Apply pagination
    const authors = await query
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    // Get platform information for each author
    const authorInfoPromises = authors.map(async (author) => {
      const posts = await Post.findOne({ author_id: author.author_id });
      return {
        author_id: author.author_id,
        username: author.username,
        platform: posts?.platform || 'unknown',
        followers_count: author.followers_count,
        posts_count: author.posts_count,
      }
    })

    const authorInfo = await Promise.all(authorInfoPromises)

    return {
      authors: authorInfo,
      totalAuthors
    }
  } catch (error) {
    console.error('❌ Error fetching authors:', error)
    return { authors: [], totalAuthors: 0 }
  }
}
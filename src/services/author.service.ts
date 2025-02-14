import Author, { IAuthor } from '../models/author.model';
import axios from 'axios';

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
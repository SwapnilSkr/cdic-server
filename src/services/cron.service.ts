import cron from 'node-cron';
import { TopicModel } from '../models/topic.model';
import { 
  fetchAndStoreInstagramPosts, 
  fetchAndStoreTwitterPosts, 
  fetchAndStoreYoutubeVideos, 
  fetchAndStoreGoogleNewsPosts 
} from './post.service';
import { convertSearchQueryToHashtag } from './ai.service';

/**
 * Fetches posts for a single topic using all available platforms
 * @param topicName - The name of the topic
 * @param topicId - The ID of the topic
 */
const fetchPostsForTopic = async (topicName: string, topicId: string): Promise<void> => {
  try {
    console.log(`🔄 Starting scheduled fetch for topic: ${topicName}`);
    
    // Convert topic name to Instagram hashtag if needed
    const hashtag = await convertSearchQueryToHashtag(topicName);
    
    // Fetch from all platforms in sequence
    await fetchAndStoreYoutubeVideos(topicName, topicId);
    await fetchAndStoreTwitterPosts(topicName, topicId);
    await fetchAndStoreGoogleNewsPosts(topicName, topicId);
    
    // Only fetch Instagram if we have a valid hashtag
    if (hashtag) {
      await fetchAndStoreInstagramPosts(hashtag, topicId);
    }
    
    console.log(`✅ Completed scheduled fetch for topic: ${topicName}`);
  } catch (error) {
    console.error(`❌ Error fetching posts for topic ${topicName}:`, error);
    // Continue with other topics even if one fails
  }
};

/**
 * Fetches posts for all active topics
 */
export const fetchAllTopics = async (): Promise<void> => {
  try {
    console.log('🕒 Starting scheduled fetch for all active topics');
    
    // Get all active topics
    const activeTopics = await TopicModel.find({ active: true });
    console.log(`📋 Found ${activeTopics.length} active topics to process`);
    
    // Process each topic sequentially to avoid overwhelming APIs
    for (const topic of activeTopics) {
      await fetchPostsForTopic(topic.name, topic._id as string);
    }
    
    console.log('🎉 Completed scheduled fetch for all topics');
  } catch (error) {
    console.error('❌ Error in fetchAllTopics cron job:', error);
  }
};

/**
 * Initialize all cron jobs
 */
export const initCronJobs = (): void => {
  // Schedule the job to run every 2 hours
  // Cron format: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) weekday(0-6)
  cron.schedule('0 0 */2 * * *', async () => {
    console.log('⏰ Running scheduled job: Fetch all topics');
    await fetchAllTopics();
  });
  
  console.log('⏰ Cron jobs initialized');
  
  // Optionally run immediately on startup
  // fetchAllTopics();
}; 
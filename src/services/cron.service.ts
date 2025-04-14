import cron from 'node-cron';
import { TopicModel } from '../models/topic.model';
import { 
  fetchAndStoreInstagramPosts, 
  fetchAndStoreTwitterPosts, 
  fetchAndStoreYoutubeVideos, 
  fetchAndStoreGoogleNewsPosts, 
  fetchAndStoreRedditPosts,
  extractKeywordsFromBooleanQuery,
  filterPostsByBooleanQuery
} from './post.service';

/**
 * Fetches posts for a single topic using all available platforms
 * @param topicName - The name of the topic
 * @param topicId - The ID of the topic
 */
const fetchPostsForTopic = async (topicName: string, topicId: string): Promise<void> => {
  try {
    console.log(`🔄 Starting scheduled fetch for topic: ${topicName}`);
    
    // Extract keywords from Boolean query for platforms that don't support complex search
    let keywords: string[] = [];
    try {
      keywords = extractKeywordsFromBooleanQuery(topicName);
      console.log(`🔍 Extracted keywords from Boolean query:`, keywords);
    } catch (keywordError) {
      console.error("Error extracting keywords:", keywordError);
    }
    
    const errors = [];
    
    // For Twitter and YouTube, pass the full query
    try {
      await fetchAndStoreTwitterPosts(topicName, topicId);
    } catch (error) {
      console.error(`❌ Error fetching Twitter posts for topic ${topicName}:`, error);
      errors.push({ platform: "Twitter", error });
    }
    
    try {
      await fetchAndStoreYoutubeVideos(topicName, topicId);
    } catch (error) {
      console.error(`❌ Error fetching YouTube videos for topic ${topicName}:`, error);
      errors.push({ platform: "YouTube", error });
    }
    
    // For platforms that need individual keyword searches
    if (keywords.length > 0) {
      // For Reddit, Instagram and News, search for each keyword separately
      for (const keyword of keywords) {
        try {
          await fetchAndStoreInstagramPosts(keyword, topicId);
        } catch (error) {
          console.error(`❌ Error fetching Instagram posts for keyword '${keyword}' in topic ${topicName}:`, error);
          errors.push({ platform: "Instagram", keyword, error });
        }
        
        try {
          await fetchAndStoreRedditPosts(keyword, topicId);
        } catch (error) {
          console.error(`❌ Error fetching Reddit posts for keyword '${keyword}' in topic ${topicName}:`, error);
          errors.push({ platform: "Reddit", keyword, error });
        }
        
        try {
          await fetchAndStoreGoogleNewsPosts(keyword, topicId);
        } catch (error) {
          console.error(`❌ Error fetching Google News posts for keyword '${keyword}' in topic ${topicName}:`, error);
          errors.push({ platform: "Google News", keyword, error });
        }
      }
    } else {
      try {
        await fetchAndStoreInstagramPosts(topicName, topicId);
      } catch (error) {
        console.error(`❌ Error fetching Instagram posts for topic ${topicName}:`, error);
        errors.push({ platform: "Instagram", error });
      }
      
      try {
        await fetchAndStoreRedditPosts(topicName, topicId);
      } catch (error) {
        console.error(`❌ Error fetching Reddit posts for topic ${topicName}:`, error);
        errors.push({ platform: "Reddit", error });
      }
      
      try {
        await fetchAndStoreGoogleNewsPosts(topicName, topicId);
      } catch (error) {
        console.error(`❌ Error fetching Google News posts for topic ${topicName}:`, error);
        errors.push({ platform: "Google News", error });
      }
    }
    
    // After fetching all posts, filter them based on the Boolean query
    // This will delete any posts that don't match the query and their authors
    try {
      await filterPostsByBooleanQuery(topicId, topicName);
    } catch (error) {
      console.error(`❌ Error filtering posts by Boolean query for topic ${topicName}:`, error);
      errors.push({ process: "Boolean filtering", error });
    }
    
    if (errors.length > 0) {
      console.log(`⚠️ Completed fetch for topic: ${topicName} with ${errors.length} errors`);
    } else {
      console.log(`✅ Completed scheduled fetch for topic: ${topicName} successfully`);
    }
  } catch (error) {
    console.error(`❌ Fatal error in fetchPostsForTopic for ${topicName}:`, error);
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
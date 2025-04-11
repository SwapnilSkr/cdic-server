import { TopicModel, Topic } from "../models/topic.model";
import Post from "../models/post.model";
import Author from "../models/author.model";
import mongoose from "mongoose";

// Create necessary indexes for performance optimization
const createIndexes = async () => {
  try {
    // Indexes for Post model
    await Post.collection.createIndex({ topic_ids: 1 }, { background: true });
    await Post.collection.createIndex({ author_id: 1, platform: 1 }, { background: true });
    await Post.collection.createIndex({ topic_ids: 1, author_id: 1 }, { background: true });
    
    // Indexes for Author model
    await Author.collection.createIndex({ flagged: 1 }, { background: true });
    await Author.collection.createIndex({ username: 1 }, { background: true });
    
    // Indexes for Topic model
    await TopicModel.collection.createIndex({ createdBy: 1 }, { background: true });

    console.log("✅ All indexes created successfully");
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
  }
};

// Run this once to create all necessary indexes, then comment it out
// createIndexes();

export const createTopic = async (
  topicData: Omit<Topic, "_id">,
  userId: string
): Promise<Topic> => {
  const topic = new TopicModel({ ...topicData, createdBy: userId });
  return await topic.save();
};

// New function to get all topics with pagination
export const getAllTopics = async (
  page: number,
  limit: number,
  userId: string
): Promise<{ topics: Topic[]; total: number }> => {
  const total = await TopicModel.countDocuments({
    createdBy: userId,
  });
  const topics = await TopicModel.find({ createdBy: userId })
    .skip((page - 1) * limit)
    .limit(limit);
  return { topics, total };
};

export const updateTopic = async (
  topicId: string,
  topicData: Partial<Topic>
): Promise<Topic | null> => {
  return await TopicModel.findByIdAndUpdate(topicId, topicData, { new: true });
};

export const deleteTopic = async (topicId: string): Promise<Topic | null> => {
  return await TopicModel.findByIdAndDelete(topicId);
};

// Delete topic and all related posts
export const deleteTopicAndPosts = async (
  topicId: string
): Promise<{ topic: Topic | null; deletedPostsCount: number }> => {
  try {
    const topic = await TopicModel.findByIdAndDelete(topicId);
    if (!topic) return { topic: null, deletedPostsCount: 0 };

    // Delete all posts that have this topic ID
    const result = await Post.deleteMany({ topic_ids: topicId });

    return {
      topic,
      deletedPostsCount: result.deletedCount || 0,
    };
  } catch (error) {
    console.error("Error deleting topic and posts:", error);
    throw error;
  }
};

// Delete topic and remove topic reference from posts
export const deleteTopicAndUpdatePosts = async (
  topicId: string
): Promise<{ topic: Topic | null; updatedPostsCount: number }> => {
  try {
    const topic = await TopicModel.findByIdAndDelete(topicId);
    if (!topic) return { topic: null, updatedPostsCount: 0 };

    // Remove this topic ID from all posts' topic_ids array
    const result = await Post.updateMany(
      { topic_ids: topicId },
      { $pull: { topic_ids: topicId } }
    );

    return {
      topic,
      updatedPostsCount: result.modifiedCount || 0,
    };
  } catch (error) {
    console.error("Error deleting topic and updating posts:", error);
    throw error;
  }
};

// Function to get authors grouped by topics
export const getAuthorsGroupedByTopic = async (): Promise<{ 
  topicId: string; 
  topicName: string;
  authors: Array<{
    authorId: string;
    username: string;
    profilePic: string;
    postCount: number;
    totalEngagement: number;
  }>;
}[]> => {
  try {
    // Get all active topics
    const topics = await TopicModel.find({}).lean();
    
    // Create the result array
    const result = await Promise.all(
      topics.map(async (topic) => {
        // Find all posts for this topic
        const posts = await Post.find({ topic_ids: topic._id });
        
        // Group posts by author_id
        const authorMap = new Map();
        
        for (const post of posts) {
          const authorId = post.author_id;
          
          if (!authorMap.has(authorId)) {
            // Find author details
            const author = await Author.findOne({ author_id: authorId });
            
            if (author) {
              authorMap.set(authorId, {
                authorId: author.author_id,
                username: author.username,
                profilePic: author.profile_pic,
                postCount: 1,
                totalEngagement: (post.likesCount || 0) + (post.commentsCount || 0),
                flagged: author.flagged
              });
            }
          } else {
            // Update existing author data
            const authorData = authorMap.get(authorId);
            authorData.postCount += 1;
            authorData.totalEngagement += (post.likesCount || 0) + (post.commentsCount || 0);
            authorMap.set(authorId, authorData);
          }
        }
        
        // Convert map to array and sort by engagement
        const authors = Array.from(authorMap.values())
          .sort((a, b) => b.totalEngagement - a.totalEngagement);
        
        return {
          topicId: topic._id.toString(),
          topicName: topic.name,
          authors
        };
      })
    );
    
    return result;
  } catch (error) {
    console.error("Error grouping authors by topic:", error);
    throw error;
  }
};

// Function to get authors for a specific topic by topicId with pagination
export const getAuthorsByTopicId = async (
  topicId: string,
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'engagement',
  search: string = ''
): Promise<{
  topicId: string;
  topicName: string;
  authors: Array<{
    authorId: string;
    username: string;
    profilePic: string;
    postCount: number;
    totalEngagement: number;
    platform: string;
    flagged: boolean;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
} | null> => {
  try {
    const startTime = Date.now();
    console.log(`🔍 Starting getAuthorsByTopicId for topic ${topicId}`);
    
    // Find the topic by ID - using indexed _id field
    const topic = await TopicModel.findById(topicId).lean();
    
    if (!topic) {
      return null; // Topic not found
    }
    
    // Use MongoDB aggregation framework for better performance with large datasets
    const pipeline = [
      // Match posts for this topic - uses the index on topic_ids
      { $match: { topic_ids: new mongoose.Types.ObjectId(topicId) } },
      
      // Group by author_id to compute metrics - this reduces the dataset size dramatically
      { $group: {
        _id: "$author_id",
        postCount: { $sum: 1 },
        totalEngagement: { $sum: { $add: [{ $ifNull: ["$likesCount", 0] }, { $ifNull: ["$commentsCount", 0] }] } },
        // Get the most frequent platform for this author
        platforms: { $addToSet: "$platform" }
      }},
      
      // Limit the number of results for performance before expensive lookups
      // This is crucial for performance with millions of documents
      { $limit: 1000 }
    ];
    
    // Apply search filter early if provided to reduce the dataset
    if (search && search.trim() !== '') {
      // We'll apply search after the author lookup stage
      console.log(`🔍 Search filter: "${search}"`);
    }

    // Execute the aggregation pipeline
    console.log(`⏱️ Starting posts aggregation at ${Date.now() - startTime}ms`);
    const postStats = await Post.aggregate(pipeline);
    console.log(`⏱️ Completed posts aggregation at ${Date.now() - startTime}ms - found ${postStats.length} authors`);
    
    if (postStats.length === 0) {
      return {
        topicId: topic._id.toString(),
        topicName: topic.name,
        authors: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }
    
    // Get all unique author IDs from the aggregation result
    const authorIds = postStats.map(stat => stat._id);
    
    // Fetch author details in a single batch query - uses index on author_id
    console.log(`⏱️ Starting author lookup at ${Date.now() - startTime}ms`);
    const authorsData = await Author.find({ author_id: { $in: authorIds } })
      .select('author_id username profile_pic flagged')
      .lean()
      .exec();
    console.log(`⏱️ Completed author lookup at ${Date.now() - startTime}ms - found ${authorsData.length} authors`);
    
    // Create a map for O(1) lookups
    const authorMap = new Map(authorsData.map(author => [author.author_id, author]));
    
    // Combine the post stats with author details
    const combinedAuthors = postStats
      .filter(stat => authorMap.has(stat._id)) // Filter out authors that don't exist
      .map(stat => {
        const author = authorMap.get(stat._id)!; // We know this exists from the filter above
        
        const mostCommonPlatform = stat.platforms && stat.platforms.length > 0 
          ? stat.platforms[0] // Just take the first one for simplicity
          : 'Unknown';
          
        return {
          authorId: author.author_id,
          username: author.username,
          profilePic: author.profile_pic || '',
          postCount: stat.postCount,
          totalEngagement: stat.totalEngagement,
          flagged: author.flagged || false,
          platform: mostCommonPlatform
        };
      });
    
    // Apply search filter if provided
    let filteredAuthors = combinedAuthors;
    if (search && search.trim() !== '') {
      const searchLowerCase = search.toLowerCase();
      filteredAuthors = combinedAuthors.filter(author => 
        author.username.toLowerCase().includes(searchLowerCase)
      );
      console.log(`⏱️ Applied search filter at ${Date.now() - startTime}ms - ${filteredAuthors.length} authors match`);
    }
    
    // Apply sorting
    let sortedAuthors = [...filteredAuthors]; // Create a copy to avoid mutation issues
    if (sortBy === 'postCount') {
      sortedAuthors.sort((a, b) => b.postCount - a.postCount);
    } else if (sortBy === 'username') {
      sortedAuthors.sort((a, b) => a.username.localeCompare(b.username));
    } else {
      // Default sort by engagement
      sortedAuthors.sort((a, b) => b.totalEngagement - a.totalEngagement);
    }
    
    // Calculate pagination values
    const totalItems = sortedAuthors.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.min(page, totalPages) || 1;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    
    // Get the paginated subset of authors
    const paginatedAuthors = sortedAuthors.slice(startIndex, endIndex);
    
    console.log(`⏱️ Completed getAuthorsByTopicId in ${Date.now() - startTime}ms`);
    
    return {
      topicId: topic._id.toString(),
      topicName: topic.name,
      authors: paginatedAuthors,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    };
  } catch (error) {
    console.error(`Error getting authors for topic ${topicId}:`, error);
    throw error;
  }
};

// Function to get flagged authors for a topic
export const getFlaggedAuthorsByTopicId = async (
  topicId: string,
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'engagement',
  search: string = ''
): Promise<{
  topicId: string;
  topicName: string;
  authors: Array<{
    authorId: string;
    username: string;
    profilePic: string;
    postCount: number;
    totalEngagement: number;
    platform: string;
    flagged: boolean;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
} | null> => {
  try {
    const startTime = Date.now();
    console.log(`🔍 Starting getFlaggedAuthorsByTopicId for topic ${topicId}`);
    
    // Find the topic by ID
    const topic = await TopicModel.findById(topicId).lean();
    
    if (!topic) {
      return null; // Topic not found
    }
    
    // Get flagged authors directly using the index on flagged
    console.log(`⏱️ Starting flagged authors lookup at ${Date.now() - startTime}ms`);
    const flaggedAuthors = await Author.find({ flagged: true })
      .select('author_id username profile_pic')
      .lean()
      .exec();
    console.log(`⏱️ Completed flagged authors lookup at ${Date.now() - startTime}ms - found ${flaggedAuthors.length} flagged authors`);
    
    // If there are no flagged authors, return early
    if (flaggedAuthors.length === 0) {
      return {
        topicId: topic._id.toString(),
        topicName: topic.name,
        authors: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }
    
    // Extract flagged author IDs for efficient querying
    const flaggedAuthorIds = flaggedAuthors.map(author => author.author_id);
    
    // Use MongoDB aggregation framework for high-performance querying
    const pipeline = [
      // Match posts for this topic and only for flagged authors - using compound index
      { $match: { 
        topic_ids: new mongoose.Types.ObjectId(topicId),
        author_id: { $in: flaggedAuthorIds }
      }},
      
      // Group by author_id to compute metrics
      { $group: {
        _id: "$author_id",
        postCount: { $sum: 1 },
        totalEngagement: { $sum: { $add: [{ $ifNull: ["$likesCount", 0] }, { $ifNull: ["$commentsCount", 0] }] } },
        platforms: { $addToSet: "$platform" }
      }},
      
      // Limit results for performance
      { $limit: 1000 }
    ];
    
    // Execute the aggregation pipeline
    console.log(`⏱️ Starting posts aggregation at ${Date.now() - startTime}ms`);
    const postStats = await Post.aggregate(pipeline);
    console.log(`⏱️ Completed posts aggregation at ${Date.now() - startTime}ms - found ${postStats.length} flagged authors with posts`);
    
    // If no posts found for flagged authors in this topic
    if (postStats.length === 0) {
      return {
        topicId: topic._id.toString(),
        topicName: topic.name,
        authors: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }
    
    // Create maps for O(1) lookups
    const authorMap = new Map(flaggedAuthors.map(author => [author.author_id, author]));
    
    // Combine the post stats with author details
    const combinedAuthors = postStats
      .filter(stat => authorMap.has(stat._id))
      .map(stat => {
        const author = authorMap.get(stat._id)!; // Non-null assertion is safe due to filter
        
        const mostCommonPlatform = stat.platforms && stat.platforms.length > 0 
          ? stat.platforms[0] 
          : 'Unknown';
          
        return {
          authorId: author.author_id,
          username: author.username,
          profilePic: author.profile_pic || '',
          postCount: stat.postCount,
          totalEngagement: stat.totalEngagement,
          flagged: true, // These are all flagged
          platform: mostCommonPlatform
        };
      });
    
    // Apply search filter if provided
    let filteredAuthors = combinedAuthors;
    if (search && search.trim() !== '') {
      const searchLowerCase = search.toLowerCase();
      filteredAuthors = combinedAuthors.filter(author => 
        author.username.toLowerCase().includes(searchLowerCase)
      );
      console.log(`⏱️ Applied search filter at ${Date.now() - startTime}ms - ${filteredAuthors.length} authors match`);
    }
    
    // Apply sorting
    let sortedAuthors = [...filteredAuthors]; // Create a copy to avoid mutation issues
    if (sortBy === 'postCount') {
      sortedAuthors.sort((a, b) => b.postCount - a.postCount);
    } else if (sortBy === 'username') {
      sortedAuthors.sort((a, b) => a.username.localeCompare(b.username));
    } else {
      // Default sort by engagement
      sortedAuthors.sort((a, b) => b.totalEngagement - a.totalEngagement);
    }
    
    // Calculate pagination values
    const totalItems = sortedAuthors.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.min(page, totalPages) || 1;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    
    // Get the paginated subset of authors
    const paginatedAuthors = sortedAuthors.slice(startIndex, endIndex);
    
    console.log(`⏱️ Completed getFlaggedAuthorsByTopicId in ${Date.now() - startTime}ms`);
    
    return {
      topicId: topic._id.toString(),
      topicName: topic.name,
      authors: paginatedAuthors,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    };
  } catch (error) {
    console.error(`Error getting flagged authors for topic ${topicId}:`, error);
    throw error;
  }
};

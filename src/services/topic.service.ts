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
    // Find the topic by ID - using indexed _id field
    const topic = await TopicModel.findById(topicId).lean();
    
    if (!topic) {
      return null; // Topic not found
    }
    
    // Find all posts for this topic using the topic_ids index
    const posts = await Post.find({ topic_ids: new mongoose.Types.ObjectId(topicId) })
      .lean() // Use lean() for better performance
      .select('author_id platform likesCount commentsCount'); // Only get needed fields
    
    // Get unique author_ids from posts for this topic
    const authorIds = [...new Set(posts.map(post => post.author_id))];
    
    // Get all authors in a single query with the index on author_id
    const authors = await Author.find({ author_id: { $in: authorIds } })
      .lean()
      .select('author_id username profile_pic flagged');
    
    // Create a map for faster author lookups
    const authorMap = new Map(
      authors.map(author => [author.author_id, {
        authorId: author.author_id,
        username: author.username,
        profilePic: author.profile_pic,
        postCount: 0,
        totalEngagement: 0,
        flagged: author.flagged,
        platforms: new Map()
      }])
    );
    
    // Process posts to calculate engagement and platforms in a more optimized way
    for (const post of posts) {
      const authorData = authorMap.get(post.author_id);
      if (authorData) {
        authorData.postCount++;
        authorData.totalEngagement += (post.likesCount || 0) + (post.commentsCount || 0);
        
        // Update platform count
        const platformCount = authorData.platforms.get(post.platform) || 0;
        authorData.platforms.set(post.platform, platformCount + 1);
      }
    }
    
    // Convert map to array and determine most common platform for each author
    let authorsArray = [...authorMap.values()].map(author => {
      // Find the most common platform
      let mostCommonPlatform = 'Unknown';
      let maxCount = 0;
      
      for (const [platform, count] of author.platforms.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPlatform = platform;
        }
      }
      
      return {
        ...author,
        platform: mostCommonPlatform,
        platforms: undefined // Remove the platforms map from the final output
      };
    });
    
    // Apply search filter if provided
    if (search && search.trim() !== '') {
      const searchLowerCase = search.toLowerCase();
      authorsArray = authorsArray.filter(author => 
        author.username.toLowerCase().includes(searchLowerCase)
      );
    }
    
    // Apply sorting
    if (sortBy === 'postCount') {
      authorsArray.sort((a, b) => b.postCount - a.postCount);
    } else if (sortBy === 'username') {
      authorsArray.sort((a, b) => a.username.localeCompare(b.username));
    } else {
      // Default sort by engagement
      authorsArray.sort((a, b) => b.totalEngagement - a.totalEngagement);
    }
    
    // Calculate pagination values
    const totalItems = authorsArray.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.min(page, totalPages) || 1;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    
    // Get the paginated subset of authors
    const paginatedAuthors = authorsArray.slice(startIndex, endIndex);
    
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

// New function to get flagged authors for a topic
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
    // Find the topic by ID
    const topic = await TopicModel.findById(topicId).lean();
    
    if (!topic) {
      return null; // Topic not found
    }
    
    // Get all flagged authors using the flagged index
    const flaggedAuthors = await Author.find({ flagged: true })
      .lean()
      .select('author_id username profile_pic');
    
    // Use a Set for faster lookups
    const flaggedAuthorIds = new Set(flaggedAuthors.map(author => author.author_id));
    
    // Find all posts for this topic with author_id that is in flaggedAuthorIds
    // Use the compound topic_ids + author_id index
    const posts = await Post.find({ 
        topic_ids: new mongoose.Types.ObjectId(topicId),
        author_id: { $in: [...flaggedAuthorIds] }
      })
      .lean()
      .select('author_id platform likesCount commentsCount');
    
    // Create a map for faster author lookups
    const authorMap = new Map();
    
    // Process posts more efficiently
    for (const post of posts) {
      const authorId = post.author_id;
      
      if (!authorMap.has(authorId)) {
        // Find author in our prefetched list
        const author = flaggedAuthors.find(a => a.author_id === authorId);
        
        if (author) {
          authorMap.set(authorId, {
            authorId: author.author_id,
            username: author.username,
            profilePic: author.profile_pic,
            postCount: 1,
            totalEngagement: (post.likesCount || 0) + (post.commentsCount || 0),
            flagged: true,
            platforms: new Map([[post.platform, 1]]) // Initialize platform count
          });
        }
      } else {
        // Update existing author data
        const authorData = authorMap.get(authorId);
        authorData.postCount += 1;
        authorData.totalEngagement += (post.likesCount || 0) + (post.commentsCount || 0);
        
        // Update platform count
        const platformCount = authorData.platforms.get(post.platform) || 0;
        authorData.platforms.set(post.platform, platformCount + 1);
        
        authorMap.set(authorId, authorData);
      }
    }
    
    // Convert map to array and determine most common platform for each author
    let authorsArray = Array.from(authorMap.values()).map(author => {
      // Find the most common platform
      let mostCommonPlatform = 'Unknown';
      let maxCount = 0;
      
      for (const [platform, count] of author.platforms.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonPlatform = platform;
        }
      }
      
      return {
        ...author,
        platform: mostCommonPlatform,
        platforms: undefined // Remove the platforms map from the final output
      };
    });
    
    // Apply search filter if provided
    if (search && search.trim() !== '') {
      const searchLowerCase = search.toLowerCase();
      authorsArray = authorsArray.filter(author => 
        author.username.toLowerCase().includes(searchLowerCase)
      );
    }
    
    // Apply sorting
    if (sortBy === 'postCount') {
      authorsArray.sort((a, b) => b.postCount - a.postCount);
    } else if (sortBy === 'username') {
      authorsArray.sort((a, b) => a.username.localeCompare(b.username));
    } else {
      // Default sort by engagement
      authorsArray.sort((a, b) => b.totalEngagement - a.totalEngagement);
    }
    
    // Calculate pagination values
    const totalItems = authorsArray.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.min(page, totalPages) || 1;
    const startIndex = (currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    
    // Get the paginated subset of authors
    const paginatedAuthors = authorsArray.slice(startIndex, endIndex);
    
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

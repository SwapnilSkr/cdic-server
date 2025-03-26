import { TopicModel, Topic } from "../models/topic.model";
import Post from "../models/post.model";

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

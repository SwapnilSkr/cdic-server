import { TopicModel, Topic } from "../models/topic.model";

export const createTopic = async (topicData: Omit<Topic, "_id">): Promise<Topic> => {
  const topic = new TopicModel(topicData);
  return await topic.save();
};

// New function to get all topics with pagination
export const getAllTopics = async (page: number, limit: number): Promise<{ topics: Topic[]; total: number }> => {
  const total = await TopicModel.countDocuments();
  const topics = await TopicModel.find()
    .skip((page - 1) * limit)
    .limit(limit);
  return { topics, total };
};

export const updateTopic = async (topicId: string, topicData: Partial<Topic>): Promise<Topic | null> => {
  return await TopicModel.findByIdAndUpdate(topicId, topicData, { new: true });
};

export const deleteTopic = async (topicId: string): Promise<Topic | null> => {
  return await TopicModel.findByIdAndDelete(topicId);
};

import { Request, Response } from "express";
import { createTopic, getAllTopics, updateTopic, deleteTopic, deleteTopicAndPosts } from "../services/topic.service";

export const createTopicController = async (req: Request, res: Response) => {
  try {
    const topicData = req.body;
    const newTopic = await createTopic(topicData);
    res.status(201).json(newTopic);
  } catch (error) {
    res.status(500).json({ message: "Error creating topic", error });
  }
};

// New controller to get all topics
export const getAllTopicsController = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 5;

  try {
    const { topics, total } = await getAllTopics(page, limit);
    res.status(200).json({ topics, total });
  } catch (error) {
    res.status(500).json({ message: "Error fetching topics", error });
  }
};

export const updateTopicController = async (req: Request, res: Response) => {
  const topicId = req.params.id;
  const topicData = req.body;

  try {
    const updatedTopic = await updateTopic(topicId, topicData);
    if (!updatedTopic) {
      res.status(404).json({ message: "Topic not found" });
      return;
    }
    res.status(200).json(updatedTopic);
  } catch (error) {
    console.error("Error updating topic:", error);
    res.status(500).json({ message: "Error updating topic", error });
  }
};

export const deleteTopicController = async (req: Request, res: Response)  => {
  const topicId = req.params.id;

  try {
    const deletedTopic = await deleteTopicAndPosts(topicId);
    if (!deletedTopic) {
       res.status(404).json({ message: "Topic not found" });
       return;
    }
    res.status(204).send(); // No content
  } catch (error) {
    res.status(500).json({ message: "Error deleting topic", error });
  }
};

import { Request, Response } from "express";
import { createTopic, getAllTopics, updateTopic, deleteTopic, deleteTopicAndPosts, getAuthorsGroupedByTopic, getAuthorsByTopicId, getFlaggedAuthorsByTopicId } from "../services/topic.service";

export const createTopicController = async (req: Request, res: Response) => {
  try {
    const topicData = req.body;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const newTopic = await createTopic(topicData, userId);
    res.status(201).json(newTopic);
  } catch (error) {
    res.status(500).json({ message: "Error creating topic", error });
  }
};

// New controller to get all topics
export const getAllTopicsController = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 5;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const { topics, total } = await getAllTopics(page, limit, userId);
    res.status(200).json({ topics, total });
  } catch (error) {
    console.error("Error fetching topics:", error);
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

export const getAuthorsGroupedByTopicController = async (req: Request, res: Response) => {
  try {
    const topicAuthors = await getAuthorsGroupedByTopic();
    res.status(200).json(topicAuthors);
  } catch (error) {
    console.error("Error getting authors grouped by topic:", error);
    res.status(500).json({ message: "Error getting authors grouped by topic", error });
  }
};

export const getAuthorsByTopicIdController = async (req: Request, res: Response) => {
  try {
    const topicId = req.params.id;
    
    if (!topicId) {
      res.status(400).json({ message: "Topic ID is required" });
      return;
    }
    
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'engagement';
    const search = (req.query.search as string) || '';
    
    // Validate page and limit
    if (page < 1) {
      res.status(400).json({ message: "Page must be a positive integer" });
      return;
    }
    
    if (limit < 1 || limit > 100) {
      res.status(400).json({ message: "Limit must be between 1 and 100" });
      return;
    }
    
    // Validate sortBy
    const validSortOptions = ['engagement', 'postCount', 'username'];
    if (!validSortOptions.includes(sortBy)) {
      res.status(400).json({ 
        message: `Invalid sort option. Valid options are: ${validSortOptions.join(', ')}` 
      });
      return;
    }

    const result = await getAuthorsByTopicId(topicId, page, limit, sortBy, search);
    
    if (!result) {
      res.status(404).json({ message: "Topic not found" });
      return;
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting authors for specific topic:", error);
    res.status(500).json({ message: "Error getting authors for specific topic", error });
  }
};

export const getFlaggedAuthorsByTopicIdController = async (req: Request, res: Response) => {
  try {
    const topicId = req.params.id;
    
    if (!topicId) {
      res.status(400).json({ message: "Topic ID is required" });
      return;
    }
    
    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || 'engagement';
    const search = (req.query.search as string) || '';
    
    // Validate page and limit
    if (page < 1) {
      res.status(400).json({ message: "Page must be a positive integer" });
      return;
    }
    
    if (limit < 1 || limit > 100) {
      res.status(400).json({ message: "Limit must be between 1 and 100" });
      return;
    }
    
    // Validate sortBy
    const validSortOptions = ['engagement', 'postCount', 'username'];
    if (!validSortOptions.includes(sortBy)) {
      res.status(400).json({ 
        message: `Invalid sort option. Valid options are: ${validSortOptions.join(', ')}` 
      });
      return;
    }

    const result = await getFlaggedAuthorsByTopicId(topicId, page, limit, sortBy, search);
    
    if (!result) {
      res.status(404).json({ message: "Topic not found" });
      return;
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error getting flagged authors for specific topic:", error);
    res.status(500).json({ message: "Error getting flagged authors for specific topic", error });
  }
};

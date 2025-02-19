import { Request, Response } from 'express';
import { generateResponse, getChatHistory } from '../services/ai.service';

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    const userId = req.user?.id;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid messages format' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const response = await generateResponse(messages, userId);
    res.json({ message: response });
  } catch (error) {
    console.error('AI Controller Error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
};

export const getChatHistoryController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const history = await getChatHistory(userId.toString());
    res.json({ messages: history });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
}; 
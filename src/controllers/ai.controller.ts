import { Request, Response } from 'express';
import { generateResponse } from '../services/ai.service';

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
     res.status(400).json({ error: 'Invalid messages format' });
     return
    }

    const response = await generateResponse(messages);
    res.json({ message: response });
    return
  } catch (error) {
    console.error('AI Controller Error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
    return
  }
}; 
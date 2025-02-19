import { Request, Response } from 'express';
import { getAllAuthorsInfo } from '../services/author.service';
import Author from '../models/author.model';
import { toggleAuthorFlagService } from '../services/author.service';

export const fetchAllAuthors = async (req: Request, res: Response) => {
  const { 
    page = 1, 
    limit = 10, 
    search = '', 
    platform = '' 
  } = req.query;

  const result = await getAllAuthorsInfo(
    Number(page), 
    Number(limit), 
    search as string,
    platform as string
  );

  res.json(result);
};

export const toggleAuthorFlag = async (req: Request, res: Response) => {
  try {
    const { authorId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const updatedAuthor = await toggleAuthorFlagService(authorId, userId);
    res.status(200).json({
      message: "Author flag toggled successfully",
      flagged: updatedAuthor.flagged
    });
  } catch (error) {
    console.error("❌ Error in toggleAuthorFlag controller:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 
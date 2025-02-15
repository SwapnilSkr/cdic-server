import { Request, Response } from 'express';
import { getAllAuthorsInfo } from '../services/author.service';
import Author from '../models/author.model';

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
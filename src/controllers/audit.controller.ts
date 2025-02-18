import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';

export const createAudit = async (req: Request, res: Response) => {
  try {
    const { action, actionType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    const audit = await auditService.createAudit({
      userId,
      action,
      actionType
    });

    res.status(201).json(audit);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || 'Failed to create audit'
    });
  }
};

export const getAudits = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await auditService.getAllAudits(page, limit);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || 'Failed to fetch audits'
    });
  }
}; 
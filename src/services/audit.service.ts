import { Audit, IAudit } from '../models/audit.model';

interface CreateAuditData {
  userId: string;
  action: string;
  actionType: 'profile' | 'flag';
}

export const createAudit = async (data: CreateAuditData) => {
  const audit = new Audit({
    user: data.userId,
    action: data.action,
    actionType: data.actionType
  });

  await audit.save();
  return audit;
};

export const getAllAudits = async (page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const audits = await Audit.find()
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'name email')
    .lean();

  const total = await Audit.countDocuments();

  return {
    audits,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  };
}; 
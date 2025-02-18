import mongoose, { Schema, Document } from 'mongoose';

export interface IAudit extends Document {
  user: mongoose.Types.ObjectId;
  action: string;
  actionType: 'profile' | 'flag';
  timestamp: Date;
}

const auditSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  actionType: {
    type: String,
    enum: ['profile', 'flag'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export const Audit = mongoose.model<IAudit>('Audit', auditSchema);

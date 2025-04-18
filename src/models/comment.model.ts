import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
  postId: Types.ObjectId; // Reference to the Post
  userId: Types.ObjectId; // Reference to the User who commented
  content: string;
  mentions: Types.ObjectId[]; // Array of User references mentioned
  parentId: Types.ObjectId | null; // For threaded comments (optional)
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    postId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Post', 
      required: true, 
      index: true 
    },
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    content: { type: String, required: true, trim: true },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export default mongoose.model<IComment>('Comment', commentSchema); 
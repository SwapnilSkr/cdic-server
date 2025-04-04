import mongoose, { Schema, Document } from "mongoose";

// Define TypeScript Interface for a Post
export interface IPost extends Document {
  platform: string;
  post_id: string;
  author_id: string;
  profile_pic: string;
  username: string;
  caption: string;
  image_url: string;
  title: string;
  video_url: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  created_at: Date;
  post_url: string; // New field to store Instagram post link
  flagged: boolean;
  flaggedBy: mongoose.Types.ObjectId[]; // Array of User references
  flagTimestamp: Date | null;
  flaggedStatus: 'pending' | 'reviewed' | 'escalated' | null;
  topic_ids: mongoose.Types.ObjectId[]; // New field for topic references
  dismissed: boolean; // Global dismiss flag
  dismissTimestamp: Date | null;
}

// MongoDB Schema & Model
const postSchema = new Schema<IPost>({
  platform: { type: String, required: true },
  post_id: { type: String, required: true },
  author_id: { type: String, required: true },
  profile_pic: { type: String, required: true },
  username: { type: String, required: true },
  caption: { type: String, required: false },
  image_url: { type: String, required: false },
  title: { type: String, required: false },
  video_url: { type: String, required: false },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  created_at: { type: Date, required: true },
  post_url: { type: String, required: true }, // Store post link
  flagged: { type: Boolean, default: false },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  flagTimestamp: { type: Date, default: null },
  flaggedStatus: { 
    type: String, 
    enum: ['pending', 'reviewed', 'escalated', null],
    default: null 
  },
  topic_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }], // New field for topic references
  dismissed: { type: Boolean, default: false },
  dismissTimestamp: { type: Date, default: null },
});

const Post = mongoose.model<IPost>("Post", postSchema);

export default Post;

import mongoose, { Schema, Document } from "mongoose";

// Define TypeScript Interface for a Post
export interface IPost extends Document {
  platform: string;
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
}

// MongoDB Schema & Model
const postSchema = new Schema<IPost>({
  platform: { type: String, required: true },
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
});

const Post = mongoose.model<IPost>("Post", postSchema);

export default Post;

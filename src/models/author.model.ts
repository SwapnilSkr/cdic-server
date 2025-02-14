import mongoose, { Document, Schema } from 'mongoose';

export interface IAuthor extends Document {
  author_id: string;
  username: string;
  profile_pic: string;
  followers_count: number;
  posts_count: number;
  profile_link: string;
}

const authorSchema = new Schema<IAuthor>({
  author_id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  profile_pic: { type: String, default: '' },
  followers_count: { type: Number, default: 0 },
  posts_count: { type: Number, default: 0 },
  profile_link: { type: String, default: '' },
}, {
  timestamps: true
});

export default mongoose.model<IAuthor>('Author', authorSchema); 
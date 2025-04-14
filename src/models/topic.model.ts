import mongoose, { Schema, Document } from "mongoose";

export interface Topic extends Document {
  name: string;
  description: string;
  tags: string[];
  active: boolean;
  alertThreshold: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sentimentHistory: any[]; // Adjust type as necessary
}

const topicSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    tags: { type: [String], required: false },
    active: { type: Boolean, default: true },
    alertThreshold: { type: Number, default: 75 },
    sentiment: {
      positive: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      negative: { type: Number, default: 0 },
    },
    sentimentHistory: { type: [Object], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const TopicModel = mongoose.model<Topic>("Topic", topicSchema);

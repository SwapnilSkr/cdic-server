import mongoose, { Schema, Document } from "mongoose";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AIChatHistory extends Document {
  userId: mongoose.Types.ObjectId;
  messages: Message[];
  lastUpdated: Date;
  created_at: Date;
}

const messageSchema = new Schema({
  role: { 
    type: String, 
    required: true, 
    enum: ["user", "assistant"] 
  },
  content: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

const aiChatHistorySchema = new Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  messages: [messageSchema],
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  timestamps: { 
    createdAt: 'created_at',
    updatedAt: false 
  } 
});

// Index for faster queries
aiChatHistorySchema.index({ userId: 1 });

export const AIChatHistoryModel = mongoose.model<AIChatHistory>("AIChatHistory", aiChatHistorySchema); 
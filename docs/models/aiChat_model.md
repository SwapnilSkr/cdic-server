# AI Chat History Model (`src/models/aiChat.model.ts`)

Stores the conversation history between a user and the AI assistant.

## Schema Definition

```typescript
{
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true // Added index for faster lookup
  },
  messages: [
    {
      role: { type: String, required: true, enum: ["user", "assistant"] },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  lastUpdated: { type: Date, default: Date.now }
}
```

-   `userId` (ObjectId, Ref: 'User', Required, Indexed): Reference to the `User` this chat history belongs to.
-   `messages` (Array[Message]): An array containing the individual messages of the conversation.
    -   `role` (String, Enum["user", "assistant"], Required): Indicates whether the message is from the user or the AI assistant.
    -   `content` (String, Required): The text content of the message.
    -   `timestamp` (Date, Default: Date.now): When the message was recorded.
-   `lastUpdated` (Date, Default: Date.now): Timestamp indicating the last time the conversation was updated (a message was added).

*A `created_at` timestamp is automatically added. The standard `updatedAt` is disabled in favor of `lastUpdated`.* 

## Features

-   **Indexing:** An index is defined on `userId` to efficiently retrieve the chat history for a specific user.

## Relationships

-   **User:** Each `AIChatHistory` document belongs to exactly one `User` (via `userId`). 
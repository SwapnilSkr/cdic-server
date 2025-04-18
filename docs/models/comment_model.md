# Comment Model (`src/models/comment.model.ts`)

Represents a comment made by a user on a specific post, typically within the context of a review or discussion.

## Schema Definition

```typescript
{
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
}
```

-   `postId` (ObjectId, Ref: 'Post', Required, Indexed): Link to the `Post` document this comment belongs to.
-   `userId` (ObjectId, Ref: 'User', Required): Link to the `User` document representing the author of the comment.
-   `content` (String, Required): The textual content of the comment.
-   `mentions` (Array[ObjectId], Ref: 'User', Default: []): An array of `User` IDs who were mentioned (e.g., using `@username`) within the comment content.
-   `parentId` (ObjectId, Ref: 'Comment', Default: null): If this comment is a reply to another comment, this field links to the parent `Comment` document. Used for implementing threaded comments.

*Timestamps (`createdAt`, `updatedAt`) are automatically added by Mongoose.*

## Relationships

-   **Post:** Each comment belongs to exactly one `Post`.
-   **User (Author):** Each comment is authored by exactly one `User`.
-   **User (Mentions):** A comment can mention multiple `User` documents.
-   **Comment (Parent):** A comment can optionally be a reply to another `Comment`. 
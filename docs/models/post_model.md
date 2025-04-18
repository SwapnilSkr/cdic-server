# Post Model (`src/models/post.model.ts`)

Represents an individual piece of content (e.g., social media post, news article) collected and monitored by the system.

## Schema Definition

```typescript
{
  platform: { type: String, required: true },
  post_id: { type: String, required: true },
  author_id: { type: String, required: true }, // Links to Author via external ID
  profile_pic: { type: String, required: true }, // Author's profile pic (denormalized)
  username: { type: String, required: true }, // Author's username (denormalized)
  caption: { type: String, required: false },
  image_url: { type: String, required: false },
  title: { type: String, required: false },
  video_url: { type: String, required: false },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  created_at: { type: Date, required: true }, // Original post creation date
  post_url: { type: String, required: true },
  flagged: { type: Boolean, default: false },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  flagTimestamp: { type: Date, default: null },
  flaggedStatus: { 
    type: String, 
    enum: ['pending', 'reviewed', 'escalated', null],
    default: null 
  },
  topic_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
  dismissed: { type: Boolean, default: false },
  dismissTimestamp: { type: Date, default: null },
  fetched: { type: Boolean, default: false },
}
```

-   `platform` (String, Required): The source platform (e.g., 'Instagram', 'Twitter', 'YouTube', 'News').
-   `post_id` (String, Required): The unique identifier for the post on its source platform.
-   `author_id` (String, Required): The unique identifier of the author on the source platform.
-   `profile_pic` (String, Required): Denormalized author profile picture URL.
-   `username` (String, Required): Denormalized author username.
-   `caption` (String): Text content or caption of the post.
-   `image_url` (String): URL of the primary image associated with the post.
-   `title` (String): Title of the post (e.g., for news articles, YouTube videos).
-   `video_url` (String): URL of the primary video associated with the post.
-   `likesCount` (Number, Default: 0): Number of likes/reactions.
-   `commentsCount` (Number, Default: 0): Number of comments.
-   `viewsCount` (Number, Default: 0): Number of views (if applicable).
-   `created_at` (Date, Required): The original creation timestamp of the post on its platform.
-   `post_url` (String, Required): Direct URL to the post on its source platform.
-   `flagged` (Boolean, Default: false): Indicates if the post has been flagged for review.
-   `flaggedBy` (Array[ObjectId], Ref: 'User', Default: []): An array of User IDs who have flagged this post.
-   `flagTimestamp` (Date, Default: null): Timestamp of when the post was last flagged.
-   `flaggedStatus` (String, Enum['pending', 'reviewed', 'escalated', null], Default: null): Current review status of the flagged post.
-   `topic_ids` (Array[ObjectId], Ref: 'Topic', Default: []): References to `Topic` documents associated with this post.
-   `dismissed` (Boolean, Default: false): Indicates if the post has been globally dismissed from view/processing.
-   `dismissTimestamp` (Date, Default: null): Timestamp of when the post was dismissed.
-   `fetched` (Boolean, Default: false): Status indicating if the post data has been successfully fetched/processed.

*Mongoose automatically adds its own `_id` and potentially `__v`. No separate `timestamps` are explicitly configured for this model.* 

## Relationships

-   **Author:** Each post belongs to one `Author`. This relationship is maintained via the `author_id` field (which likely corresponds to the `author_id` in the `Author` model) and also includes denormalized author information (`username`, `profile_pic`).
-   **Topic:** A post can be associated with multiple `Topic` documents (via the `topic_ids` array).
-   **User:** Multiple `User` documents can flag a post (via the `flaggedBy` array). 
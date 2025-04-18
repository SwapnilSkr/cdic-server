# Author Model (`src/models/author.model.ts`)

Represents a content creator or social media handle monitored by the system.

## Schema Definition

```typescript
{
  author_id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  profile_pic: { type: String, default: '' },
  followers_count: { type: Number, default: 0 },
  posts_count: { type: Number, default: 0 }, // Note: This seems redundant if Posts are linked via author_id
  profile_link: { type: String, default: '' },
  flagged: { type: Boolean, default: false },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  flagTimestamp: { type: Date, default: null },
  flaggedStatus: { 
    type: String, 
    enum: ['pending', 'reviewed', 'escalated', null],
    default: null 
  }
}
```

-   `author_id` (String, Required, Unique): The unique identifier for the author (likely from the source platform).
-   `username` (String, Required): The author's username.
-   `profile_pic` (String, Default: ''): URL of the author's profile picture.
-   `followers_count` (Number, Default: 0): Number of followers the author has.
-   `posts_count` (Number, Default: 0): Number of posts by the author. (Consider if this is actively maintained or derived from associated `Post` documents).
-   `profile_link` (String, Default: ''): URL to the author's profile page.
-   `flagged` (Boolean, Default: false): Indicates if the author has been flagged for review.
-   `flaggedBy` (Array[ObjectId], Ref: 'User', Default: []): An array of User IDs who have flagged this author.
-   `flagTimestamp` (Date, Default: null): Timestamp of when the author was last flagged.
-   `flaggedStatus` (String, Enum['pending', 'reviewed', 'escalated', null], Default: null): The current review status of the flagged author.

*Timestamps (`createdAt`, `updatedAt`) are automatically added.* 

## Relationships

-   **Post:** An author can create many `Post` documents. The relationship is typically established by storing the `author_id` within each `Post` document.
-   **User:** Multiple `User` documents can flag an author (via the `flaggedBy` array). 
# Topic Model (`src/models/topic.model.ts`)

Represents a specific subject, theme, or keyword group being tracked within the collected content.

## Schema Definition

```typescript
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
  sentimentHistory: { type: [Object], default: [] }, // Consider defining a sub-schema if structure is consistent
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}
```

-   `name` (String, Required): The primary name of the topic.
-   `description` (String): A brief description of the topic.
-   `tags` (Array[String]): Associated keywords or tags used for grouping or searching related content.
-   `active` (Boolean, Default: true): Whether the topic is currently being actively monitored.
-   `alertThreshold` (Number, Default: 75): A threshold value potentially used for triggering alerts related to this topic (e.g., based on sentiment or volume).
-   `sentiment` (Object): Stores aggregated sentiment scores for the topic.
    -   `positive` (Number, Default: 0): Aggregate positive sentiment score.
    -   `neutral` (Number, Default: 0): Aggregate neutral sentiment score.
    -   `negative` (Number, Default: 0): Aggregate negative sentiment score.
-   `sentimentHistory` (Array[Object], Default: []): An array to store historical sentiment data points over time. The exact structure of objects within this array is not defined by a sub-schema but should be consistent (e.g., `{ timestamp: Date, positive: Number, neutral: Number, negative: Number }`).
-   `createdBy` (ObjectId, Ref: 'User'): Reference to the `User` who created this topic.

*Timestamps (`createdAt`, `updatedAt`) are automatically added.* 

## Relationships

-   **Post:** A topic can be associated with multiple `Post` documents (via the `topic_ids` array in the `Post` model).
-   **User:** Each topic is created by one `User` (via `createdBy`). 
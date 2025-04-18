# Topic Service (`src/services/topic.service.ts`)

Handles business logic related to managing topics, including creation, retrieval, updates, deletion, and fetching associated author information.

## Key Responsibilities

-   Creating new topics, associating them with the creating user.
-   Retrieving topics with pagination, scoped to the requesting user.
-   Updating existing topic details.
-   Deleting topics, with options to either:
    -   Delete all associated `Post` documents.
    -   Remove the topic reference (`topic_id`) from associated `Post` documents.
-   Fetching authors associated with topics:
    -   Grouping authors by all active topics.
    -   Fetching authors for a *specific* topic ID with pagination, sorting (by engagement, post count, etc.), and search filtering by username.
    -   Fetching *flagged* authors for a specific topic ID with pagination, sorting, and search.
-   Utility for creating necessary database indexes across `Post`, `Author`, and `Topic` models for performance optimization.

## Core Functions

-   `createIndexes()`: Creates background indexes on `Post`, `Author`, and `Topic` collections for fields commonly used in queries (e.g., `topic_ids`, `author_id`, `flagged`, `createdBy`). (Intended to be run once).
-   `createTopic(topicData, userId)`: Creates and saves a new topic document.
-   `getAllTopics(page, limit, userId)`: Retrieves a paginated list of topics created by the specified user.
-   `updateTopic(topicId, topicData)`: Updates a topic by its ID.
-   `deleteTopic(topicId)`: Deletes a topic by its ID (without affecting posts).
-   `deleteTopicAndPosts(topicId)`: Deletes a topic and all `Post` documents that reference it.
-   `deleteTopicAndUpdatePosts(topicId)`: Deletes a topic and removes its ID from the `topic_ids` array in all associated `Post` documents.
-   `getAuthorsGroupedByTopic()`: Fetches all topics and aggregates author statistics (post count, engagement) for each topic.
-   `getAuthorsByTopicId(topicId, page, limit, sortBy, search)`: Fetches a paginated list of authors whose posts are associated with the given `topicId`. It aggregates post count and engagement for each author within that topic, supports sorting, and allows searching by author username. Uses MongoDB aggregation pipeline for efficiency.
-   `getFlaggedAuthorsByTopicId(topicId, page, limit, sortBy, search)`: Similar to `getAuthorsByTopicId`, but specifically retrieves authors who are marked as `flagged: true` and have posts associated with the given `topicId`. Also uses MongoDB aggregation.

## Fetching Authors by Topic (`getAuthorsByTopicId` / `getFlaggedAuthorsByTopicId`) Flow

```mermaid
sequenceDiagram
    participant Controller
    participant TopicService
    participant TopicModel
    participant PostModel
    participant AuthorModel

    Controller->>TopicService: get[Flagged]AuthorsByTopicId(topicId, page, limit, sortBy, search)
    TopicService->>TopicModel: findById(topicId)
    TopicModel-->>TopicService: Topic Document
    
    opt Fetch Flagged Authors Only
      TopicService->>AuthorModel: find({ flagged: true }, { author_id: 1 })
      AuthorModel-->>TopicService: List of Flagged Author IDs
    end

    TopicService->>PostModel: aggregate(pipeline)
    Note right of TopicService: Pipeline Steps:
    1. $match posts by topic_id 
       (and author_id IN flaggedAuthorIds if applicable)
       (and author username if search term provided)
    2. $group by author_id (sum posts, sum engagement, add platform to set)
    3. $lookup Author details (username, profilePic, flagged status)
    4. $sort based on sortBy parameter
    5. $skip based on page
    6. $limit based on limit
    
    activate PostModel
    PostModel-->>TopicService: Aggregated Author Stats & Details
    deactivate PostModel

    TopicService->>TopicService: Calculate Pagination Metadata
    TopicService-->>Controller: { topicName, authors, pagination }
```

## Dependencies

-   `mongoose`: For database interactions.
-   Models: `TopicModel`, `Post`, `Author`. 
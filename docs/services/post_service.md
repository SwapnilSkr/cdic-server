# Post Service (`src/services/post.service.ts`)

This is a comprehensive service responsible for fetching, storing, retrieving, and managing posts from various social media and news platforms.

## Key Responsibilities

-   **Data Fetching & Storage:**
    -   Fetching posts/videos/news based on keywords or URLs from Instagram, YouTube, Twitter, Google News, and Reddit.
    -   Utilizing external APIs: HikerAPI (Instagram), Google YouTube Data API, SocialDataTools (Twitter), SerpApi (Google News), direct Reddit API calls.
    -   Handling pagination (e.g., `nextPageId`, `pageToken`) from external APIs to fetch multiple pages of results (up to a `MAX_POSTS` limit).
    -   Parsing complex and sometimes inconsistent API responses from different sources.
    -   Creating or updating associated `Author` documents when fetching posts.
    -   Storing fetched data into the `Post` collection, mapping API fields to the `IPost` schema.
    -   Preventing duplicate post entries by checking `post_id` before insertion.
    -   Associating fetched posts with a specific `topicId`.
-   **Data Retrieval & Filtering:**
    -   Retrieving posts with pagination (`getAllPosts`).
    -   Applying complex filters based on platforms, date ranges, flag status, and keywords.
    -   Implementing sorting based on various criteria.
    -   Retrieving flagged posts with specific filters (`getFlaggedPostsService`).
    -   Retrieving detailed information for a single post (`getPostDetailsService`).
    -   Retrieving posts marked as reviewed (`getReviewedPostsService`).
    -   Providing a feed of the most discussed posts from today (`getTodayMostDiscussedFeedWithTopics`).
-   **Post Management:**
    -   Toggling the `flagged` status of a post and updating `flaggedBy` and `flagTimestamp` (`togglePostFlagService`).
    -   Updating the `flaggedStatus` ('pending', 'reviewed', 'escalated') of a post (`updatePostFlagStatus`).
    -   Marking a post as dismissed (`dismissPostService`).
-   **Statistics:**
    -   Calculating platform-wide statistics (counts, engagement) by aggregating `Post` data (`getPlatformStatistics` - Note: similar function exists in `contentSearch.service`).
    -   Calculating overall post statistics (`getPostStatistics`).
-   **Boolean Query Processing:**
    -   Parsing complex boolean search queries (supporting AND, OR, NOT, parentheses, exact phrases) (`processBooleanSearch`, `parseComplexQuery`).
    -   Filtering existing posts *locally* based on a parsed boolean query against post content (`filterPostsByBooleanQuery`).
-   **Utilities & Maintenance:**
    -   Creating necessary database indexes for the `Post` collection (`createPostIndexes`).
    -   Data migration/cleanup functions (e.g., `renamePlatformGoogleNewsToNews`, `deleteAuthorsWithoutPosts`, `addFieldToPosts`).

## Core Fetching Functions (Platform Specific)

-   `fetchAndStoreInstagramPosts(keyword, topicId)`: Fetches Instagram posts via HikerAPI v2 search.
-   `fetchInstagramPostByUrl(url, topicId)`: Fetches a single Instagram post by URL via HikerAPI.
-   `fetchAndStoreYoutubeVideos(keyword, topicId)`: Fetches YouTube videos via Google YouTube API search.
-   `fetchYoutubeByUrl(url, topicId)`: Fetches YouTube video details by URL/ID via Google YouTube API.
-   `fetchAndStoreTwitterPosts(keyword, topicId)`: Fetches Twitter posts via SocialDataTools API.
-   `fetchTwitterPostByUrl(url, topicId)`: Fetches a single Twitter post by URL via SocialDataTools API.
-   `fetchAndStoreGoogleNewsPosts(keyword, topicId)`: Fetches Google News articles via SerpApi.
-   `fetchAndStoreRedditPosts(keyword, topicId)`: Fetches Reddit posts via Reddit API (requires authentication setup).
-   `fetchRedditPostByUrl(url, topicId)`: Fetches a single Reddit post by URL via Reddit API.
-   `fetchPostByUrlService(url, platform, topicId)`: A wrapper function that directs to the correct platform-specific URL fetcher.

## Data Retrieval & Filtering (`getAllPosts`)

```mermaid
sequenceDiagram
    participant Controller
    participant PostService
    participant PostModel

    Controller->>PostService: getAllPosts(skip, limit, filters, userId)
    PostService->>PostService: Build MongoDB Query (baseFilter, keywordFilter)
    Note right of PostService: Applies filters: 
    - dismissed: false (default)
    - platform: {$in: filters.platforms}
    - created_at: {$gte: start, $lte: end}
    - flagged: (based on filters.flagStatus)
    - flaggedBy: userId (if status='mine')
    - $text: {$search: filters.keyword} (if keyword)
    
    PostService->>PostModel: find(query).sort(sortBy).skip(skip).limit(limit).lean()
    activate PostModel
    PostModel-->>PostService: List of Posts
    deactivate PostModel

    PostService->>PostModel: countDocuments(query)
    activate PostModel
    PostModel-->>PostService: Total Count
    deactivate PostModel
    
    PostService->>PostService: Calculate Pagination
    PostService-->>Controller: { posts, total, totalPages, currentPage }
```

## Boolean Query Filtering (`filterPostsByBooleanQuery`)

This function is different as it fetches *all* posts for a topic first and then applies the boolean filter in the application logic, not in the database query.

```mermaid
graph TD
    A[Input: topicId, booleanQuery] --> B(Fetch ALL Posts for topicId from DB);
    B --> C{Parse Boolean Query (Recursive Descent Parser)};
    C --> D{Build Filter Function (JS function)};
    D --> E{Iterate Through Fetched Posts};
    E -- Filter Function(post.content) is true --> F[Keep Post];
    E -- Filter Function(post.content) is false --> G[Discard Post];
    F --> H[Filtered Post List];
    G --> H;
    H --> I(Potentially Update Posts in DB or Return List);
```

## Dependencies

-   `axios`: For making HTTP requests to external APIs.
-   `serpapi`: Node.js client for SerpApi.
-   `mongoose`: For database interactions.
-   Models: `Post`, `Author`, `Topic`, `User`.
-   Services: `author.service` (for creating authors).
-   Environment Variables: API keys for HikerAPI, YouTube, SocialDataTools, SerpApi, Reddit credentials. 
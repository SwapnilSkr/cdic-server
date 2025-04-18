# Post Controller (`src/controllers/post.controller.ts`)

Handles a wide variety of HTTP requests related to posts, including fetching, management, statistics, and administrative tasks.

## Functions (Summary)

*(Note: Implementation details for many functions are not fully visible in the provided code snippet but can be inferred from function names and called services.)*

-   **`uploadPosts(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/upload`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Creates or updates a topic based on request body, then triggers fetching posts for that topic from various platforms (Twitter, YouTube, Instagram, Reddit, Google News). It handles keyword extraction from boolean topic names and calls `post.service.filterPostsByBooleanQuery` after fetching. Responds with success or a list of errors if fetches failed for some platforms.
-   **`fetchPostByUrl(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/fetch-by-url`
    -   **Middleware:** None
    -   **Description:** Fetches and stores a single post by its URL.
    -   **Logic:** Extracts `url`, `platform`, and `topicId` from the request body. Calls `post.service.fetchPostByUrlService` and responds with the fetched post or an error.
-   **`getAllStoredPosts(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/all`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves a paginated list of posts with filtering.
    -   **Logic:** Parses query parameters (`page`, `limit`, `platforms`, `startDate`, `endDate`, `flagStatus`, `sortBy`, `keyword`). Constructs a `filters` object. Calls `post.service.getAllPosts` and responds with the posts and pagination data.
-   **`getFlaggedPosts(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/flagged`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves flagged posts with optional filters.
    -   **Logic:** Parses query parameters for date range (`from`, `to`), `status`, `page`, `limit`. Calls `post.service.getFlaggedPostsService` and responds with the results.
-   **`togglePostFlag(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/toggle-flag/:postId`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Toggles the flag status of a specific post.
    -   **Logic:** Extracts `postId` from params and `userId` from `req.user`. Calls `post.service.togglePostFlagService`. Responds with success message and updated flag status.
-   **`updatePostStatus(req: Request, res: Response)`**
    -   **Route:** `PUT /api/posts/:postId/status`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Updates the review status (`flaggedStatus`) of a post.
    -   **Logic:** Extracts `postId` from params and `status` from the request body. Calls `post.service.updatePostFlagStatus`. Responds with success message.
-   **`fetchPlatformStatistics(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/platform-statistics`
    -   **Middleware:** None
    -   **Description:** Retrieves platform-based statistics.
    -   **Logic:** Calls `post.service.getPlatformStatistics` and responds with the stats.
-   **`getPostStats(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/statistics`
    -   **Middleware:** None
    -   **Description:** Retrieves overall post statistics.
    -   **Logic:** Calls `post.service.getPostStatistics` and responds with the stats.
-   **`getPostDetails(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/:postId`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves details for a single post.
    -   **Logic:** Extracts `postId` from params. Calls `post.service.getPostDetailsService`. Responds with the post details or a 404 if not found.
-   **`getTodayMostDiscussedFeed(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/today-discussed`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves a feed of today's most discussed posts.
    -   **Logic:** Calls `post.service.getTodayMostDiscussedFeedWithTopics` and responds with the feed data.
-   **`getReviewedPosts(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/reviewed`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves posts marked as reviewed.
    -   **Logic:** Parses optional `limit` query parameter. Calls `post.service.getReviewedPostsService`. Responds with the reviewed posts.
-   **`dismissPost(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/dismiss/:postId`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Marks a post as dismissed.
    -   **Logic:** Extracts `postId` from params. Calls `post.service.dismissPostService`. Responds with success message.
-   **`triggerFetchAllTopics(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/fetch-all-topics`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Initiates the background task to fetch posts for all active topics.
    -   **Logic:** Calls `cron.service.fetchAllTopics` asynchronously (fire and forget). Responds immediately with a 200 status indicating the process has started.

### Utility / Admin Functions

-   **`renamePlatformController(req: Request, res: Response)`**
    -   **Route:** `PUT /api/posts/rename-platform`
    -   **Middleware:** None
    -   **Description:** Renames 'Google News' platform to 'News' in the database.
    -   **Logic:** Calls `post.service.renamePlatformGoogleNewsToNews`. Responds with the count of updated posts.
-   **`addFieldToPostsController(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/add-field`
    -   **Middleware:** None
    -   **Description:** Adds a default field/value to all post documents (utility).
    -   **Logic:** Calls `post.service.addFieldToPosts`. Responds with success message.
-   **`testRedditAuth(req: Request, res: Response)`**
    -   **Route:** `POST /api/posts/test-reddit`
    -   **Middleware:** None
    -   **Description:** Tests Reddit API authentication and fetches sample data.
-   **`testBooleanQuery(req: Request, res: Response)`**
    -   **Route:** `GET /api/posts/test-query`
    -   **Middleware:** None
    -   **Description:** Tests the boolean query parsing logic.
    -   **Logic:** Extracts `query` from query params. Calls `post.service.processBooleanSearch` and `post.service.extractKeywordsFromBooleanQuery`. Responds with the parsed structure and extracted keywords.

## Dependencies

-   `express`: For Request and Response types.
-   Services: `post.service`, `topic.service`, `ai.service`, `cron.service`.
-   Models: `Topic`, `Post` (used indirectly via services). 
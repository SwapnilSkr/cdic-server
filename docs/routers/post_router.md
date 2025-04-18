# Post Router (`src/routers/post.route.ts`)

Base Path: `/api/posts`

Handles routes related to fetching, managing, and retrieving posts.

## Endpoints

-   **`POST /upload`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `uploadPosts` (`post.controller.ts`)
    -   **Description:** Likely triggers fetching posts based on keywords/topics provided in the request body.
-   **`POST /fetch-by-url`**
    -   **Middleware:** None
    -   **Controller:** `fetchPostByUrl` (`post.controller.ts`)
    -   **Description:** Fetches and stores a single post given its URL and platform.
-   **`GET /all`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getAllStoredPosts` (`post.controller.ts`)
    -   **Description:** Retrieves a paginated list of all stored posts, potentially with filters applied via query parameters.
-   **`GET /flagged`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getFlaggedPosts` (`post.controller.ts`)
    -   **Description:** Retrieves a list of posts marked as flagged, potentially with filters.
-   **`POST /toggle-flag/:postId`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `togglePostFlag` (`post.controller.ts`)
    -   **Description:** Toggles the flagged status for a specific post.
-   **`GET /platform-statistics`**
    -   **Middleware:** None
    -   **Controller:** `fetchPlatformStatistics` (`post.controller.ts`)
    -   **Description:** Retrieves aggregated statistics grouped by platform.
-   **`GET /statistics`**
    -   **Middleware:** None
    -   **Controller:** `getPostStats` (`post.controller.ts`)
    -   **Description:** Retrieves overall post statistics.
-   **`GET /today-discussed`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getTodayMostDiscussedFeed` (`post.controller.ts`)
    -   **Description:** Retrieves a feed of the most discussed posts created today.
-   **`GET /reviewed`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getReviewedPosts` (`post.controller.ts`)
    -   **Description:** Retrieves posts that have been marked with a reviewed status.
-   **`POST /add-field`**
    -   **Middleware:** None
    -   **Controller:** `addFieldToPostsController` (`post.controller.ts`)
    -   **Description:** Admin/utility endpoint to add a new field to existing post documents.
-   **`PUT /rename-platform`**
    -   **Middleware:** None
    -   **Controller:** `renamePlatformController` (`post.controller.ts`)
    -   **Description:** Admin/utility endpoint to rename a platform value across posts (e.g., 'Google News' to 'News').
-   **`POST /fetch-all-topics`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `triggerFetchAllTopics` (`post.controller.ts`)
    -   **Description:** Initiates the background cron job to fetch posts for all active topics.
-   **`POST /test-reddit`**
    -   **Middleware:** None
    -   **Controller:** `testRedditAuth` (`post.controller.ts`)
    -   **Description:** Utility endpoint to test Reddit API authentication.
-   **`POST /dismiss/:postId`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `dismissPost` (`post.controller.ts`)
    -   **Description:** Marks a specific post as dismissed.
-   **`GET /test-query`**
    -   **Middleware:** None
    -   **Controller:** `testBooleanQuery` (`post.controller.ts`)
    -   **Description:** Utility endpoint for testing the boolean query parsing logic.
-   **`PUT /:postId/status`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `updatePostStatus` (`post.controller.ts`)
    -   **Description:** Updates the review status (`flaggedStatus`) of a specific post.
-   **`GET /:postId`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getPostDetails` (`post.controller.ts`)
    -   **Description:** Retrieves detailed information for a single post. 
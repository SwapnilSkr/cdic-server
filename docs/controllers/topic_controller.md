# Topic Controller (`src/controllers/topic.controller.ts`)

Handles HTTP requests related to managing topics and retrieving associated author information.

## Functions

-   **`createTopicController(req: Request, res: Response)`**
    -   **Route:** `POST /api/topics`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Creates a new topic.
    -   **Logic:** Extracts topic data from `req.body` and `userId` from `req.user`. Calls `topic.service.createTopic`. Responds with the new topic (201) or an error (500).
-   **`getAllTopicsController(req: Request, res: Response)`**
    -   **Route:** `GET /api/topics`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves topics for the authenticated user with pagination.
    -   **Logic:** Parses `page` and `limit` from query params. Gets `userId` from `req.user`. Calls `topic.service.getAllTopics`. Responds with topics and total count (200) or an error (500).
-   **`updateTopicController(req: Request, res: Response)`**
    -   **Route:** `PUT /api/topics/:id`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Updates an existing topic.
    -   **Logic:** Extracts `topicId` from `req.params` and topic data from `req.body`. Calls `topic.service.updateTopic`. Responds with the updated topic (200), not found (404), or an error (500).
-   **`deleteTopicController(req: Request, res: Response)`**
    -   **Route:** `DELETE /api/topics/:id`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Deletes a topic and its associated posts.
    -   **Logic:** Extracts `topicId` from `req.params`. Calls `topic.service.deleteTopicAndPosts`. Responds with no content (204), not found (404), or an error (500).
-   **`getAuthorsGroupedByTopicController(req: Request, res: Response)`**
    -   **Route:** `GET /api/topics/authors`
    -   **Middleware:** None
    -   **Description:** Retrieves authors grouped by the topics they are associated with.
    -   **Logic:** Calls `topic.service.getAuthorsGroupedByTopic`. Responds with the grouped data (200) or an error (500).
-   **`getAuthorsByTopicIdController(req: Request, res: Response)`**
    -   **Route:** `GET /api/topics/:id/authors`
    -   **Middleware:** None
    -   **Description:** Retrieves authors associated with a specific topic, with pagination, sorting, and search.
    -   **Logic:** Extracts `topicId` from `req.params`. Parses and validates `page`, `limit`, `sortBy`, `search` from query params. Calls `topic.service.getAuthorsByTopicId`. Responds with the results (200), topic not found (404), bad request (400 for invalid params), or an error (500).
-   **`getFlaggedAuthorsByTopicIdController(req: Request, res: Response)`**
    -   **Route:** `GET /api/topics/:id/authors/flagged`
    -   **Middleware:** None
    -   **Description:** Retrieves *flagged* authors associated with a specific topic, with pagination, sorting, and search.
    -   **Logic:** Extracts `topicId` from `req.params`. Parses and validates `page`, `limit`, `sortBy`, `search` from query params. Calls `topic.service.getFlaggedAuthorsByTopicId`. Responds with the results (200), topic not found (404), bad request (400 for invalid params), or an error (500).

## Dependencies

-   `express`: For Request and Response types.
-   Services: `topic.service`. 
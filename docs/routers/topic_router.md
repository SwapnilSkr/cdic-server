# Topic Router (`src/routers/topic.route.ts`)

Base Path: `/api/topics`

Handles routes related to managing topics and retrieving associated authors.

## Endpoints

-   **`POST /`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `createTopicController` (`topic.controller.ts`)
    -   **Description:** Creates a new topic.
-   **`GET /`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getAllTopicsController` (`topic.controller.ts`)
    -   **Description:** Retrieves a list of topics (likely filtered for the authenticated user), potentially with pagination.
-   **`GET /authors`**
    -   **Middleware:** None
    -   **Controller:** `getAuthorsGroupedByTopicController` (`topic.controller.ts`)
    -   **Description:** Retrieves authors grouped by the topics their posts are associated with.
-   **`GET /:id/authors/flagged`**
    -   **Middleware:** None
    -   **Controller:** `getFlaggedAuthorsByTopicIdController` (`topic.controller.ts`)
    -   **Description:** Retrieves flagged authors associated with a specific topic, with pagination and filtering options.
-   **`GET /:id/authors`**
    -   **Middleware:** None
    -   **Controller:** `getAuthorsByTopicIdController` (`topic.controller.ts`)
    -   **Description:** Retrieves authors associated with a specific topic, with pagination and filtering options.
-   **`PUT /:id`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `updateTopicController` (`topic.controller.ts`)
    -   **Description:** Updates the details of a specific topic.
-   **`DELETE /:id`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `deleteTopicController` (`topic.controller.ts`)
    -   **Description:** Deletes a specific topic (and potentially associated posts, depending on controller logic). 
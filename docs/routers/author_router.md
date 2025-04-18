# Author Router (`src/routers/author.route.ts`)

Base Path: `/api/authors`

Handles routes related to author profiles.

## Endpoints

-   **`POST /:authorId/flag`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `toggleAuthorFlag` (`author.controller.ts`)
    -   **Description:** Toggles the flagged status for a specific author. The authenticated user is recorded as the one performing the action.
-   **`GET /`**
    -   **Middleware:** None (Note: `fetchAllAuthors` controller might implement its own access control or filtering)
    -   **Controller:** `fetchAllAuthors` (`author.controller.ts`)
    -   **Description:** Retrieves a list of authors, potentially with pagination and filters applied via query parameters. 
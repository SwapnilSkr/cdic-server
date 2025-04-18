# Author Controller (`src/controllers/author.controller.ts`)

Handles HTTP requests related to author profiles.

## Functions

-   **`fetchAllAuthors(req: Request, res: Response)`**
    -   **Route:** `GET /api/authors`
    -   **Middleware:** None
    -   **Description:** Retrieves a paginated and filtered list of authors.
    -   **Logic:**
        1.  Extracts query parameters: `page` (default 1), `limit` (default 10), `search` (default ''), `platform` (default ''), `flagged` (default '').
        2.  Calls `author.service.getAllAuthorsInfo` with the parsed parameters.
        3.  Sends the result (containing authors and total count) back as JSON.

-   **`toggleAuthorFlag(req: Request, res: Response)`**
    -   **Route:** `POST /api/authors/:authorId/flag`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Toggles the flagged status of a specific author.
    -   **Logic:**
        1.  Extracts `authorId` from route parameters (`req.params`).
        2.  Gets the authenticated `userId` from `req.user`.
        3.  Validates that `userId` exists.
        4.  Calls `author.service.toggleAuthorFlagService(authorId, userId)`.
        5.  Sends a success message and the updated `flagged` status back as JSON with a 200 status.
        6.  Handles errors by logging and sending a 500 status.

## Dependencies

-   `express`: For Request and Response types.
-   Services: `author.service` (`getAllAuthorsInfo`, `toggleAuthorFlagService`).
-   Models: `Author` (used indirectly via service). 
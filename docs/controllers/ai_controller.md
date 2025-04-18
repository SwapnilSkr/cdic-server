# AI Controller (`src/controllers/ai.controller.ts`)

Handles HTTP requests related to the AI chat functionality.

## Functions

-   **`chat(req: Request, res: Response)`**
    -   **Route:** `POST /api/ai/chat`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Processes incoming chat messages.
    -   **Logic:**
        1.  Extracts `messages` array from the request body.
        2.  Gets the authenticated `userId` from `req.user`.
        3.  Validates that `messages` is an array and `userId` exists.
        4.  Calls `ai.service.generateResponse(messages, userId)`.
        5.  Sends the generated response message back as JSON: `{ message: response }`.
        6.  Handles errors by logging and sending a 500 status.

-   **`getChatHistoryController(req: Request, res: Response)`**
    -   **Route:** `GET /api/ai/history`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Retrieves the chat history for the authenticated user.
    -   **Logic:**
        1.  Gets the authenticated `userId` from `req.user`.
        2.  Validates that `userId` exists.
        3.  Calls `ai.service.getChatHistory(userId)`.
        4.  Sends the retrieved message history back as JSON: `{ messages: history }`.
        5.  Handles errors by logging and sending a 500 status.

## Dependencies

-   `express`: For Request and Response types.
-   Services: `ai.service` (`generateResponse`, `getChatHistory`). 
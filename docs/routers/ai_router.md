# AI Router (`src/routers/ai.route.ts`)

Base Path: `/api/ai`

Handles routes related to AI chat interactions.

## Endpoints

-   **`POST /chat`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `chat` (`ai.controller.ts`)
    -   **Description:** Sends a user message (and potentially conversation history) to the AI service for processing and receives a generated response.
-   **`GET /history`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getChatHistoryController` (`ai.controller.ts`)
    -   **Description:** Retrieves the authenticated user's AI chat history. 
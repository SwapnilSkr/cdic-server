# User Router (`src/routers/user.route.ts`)

Base Path: `/api/users`

Handles routes related to user authentication, profile management, and administration.

## Endpoints

### Public Routes

-   **`POST /register`**
    -   **Middleware:** None
    -   **Controller:** `registerUser` (`user.controller.ts`)
    -   **Description:** Registers a new user.
-   **`POST /login`**
    -   **Middleware:** None
    -   **Controller:** `loginUser` (`user.controller.ts`)
    -   **Description:** Logs in a user and returns a JWT token.

### Protected Routes (Require Authentication)

-   **`PUT /profile`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `updateUserProfile` (`user.controller.ts`)
    -   **Description:** Updates the profile details (e.g., name, email) of the authenticated user.
-   **`PUT /password`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `updateUserPassword` (`user.controller.ts`)
    -   **Description:** Updates the password for the authenticated user (requires current password).

#### Blocked Accounts Management

-   **`GET /me/blocked-accounts`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `getBlockedAccounts` (`user.controller.ts`)
    -   **Description:** Retrieves the list of accounts currently blocked by the authenticated user.
-   **`PUT /me/blocked-accounts`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `updateBlockedAccounts` (`user.controller.ts`)
    -   **Description:** Replaces the entire list of accounts blocked by the authenticated user. Expects a request body with a `blockedAccounts` array, where each element is an object `{ platform: string, identifier: string }`.
-   **`DELETE /me/blocked-accounts`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `removeBlockedAccount` (`user.controller.ts`)
    -   **Description:** Removes a specific account from the authenticated user's blocklist. Expects a request body with `{ platform: string, identifier: string }` of the account to unblock.

### Admin-Only Routes (Require Authentication + Admin Role)

-   **`GET /all`**
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Controller:** `getAllUsers` (`user.controller.ts`)
    -   **Description:** Retrieves a list of all users.
-   **`PUT /`**
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Controller:** `updateUser` (`user.controller.ts`)
    -   **Description:** Updates the details (e.g., role, name) of a specific user (identified in request body or params).
-   **`DELETE /:userId`**
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Controller:** `deleteUser` (`user.controller.ts`)
    -   **Description:** Deletes a specific user by their ID. 
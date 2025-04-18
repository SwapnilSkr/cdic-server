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
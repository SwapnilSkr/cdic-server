# User Controller (`src/controllers/user.controller.ts`)

Handles HTTP requests related to user authentication, profile management, and administration. Creates audit logs for relevant actions.

## Functions

-   **`registerUser(req: Request, res: Response)`**
    -   **Route:** `POST /api/users/register`
    -   **Middleware:** None
    -   **Description:** Registers a new user.
    -   **Logic:** Extracts `email`, `password`, `name`, `role` from `req.body`. Validates required fields. Calls `user.service.register`. Creates an audit log entry ("User Registration"). Responds with the user object (201) or an error (400).
-   **`loginUser(req: Request, res: Response)`**
    -   **Route:** `POST /api/users/login`
    -   **Middleware:** None
    -   **Description:** Logs in a user.
    -   **Logic:** Extracts `email`, `password` from `req.body`. Validates fields. Calls `user.service.login`. Creates an audit log entry ("User Login"). Responds with the user object and token (200) or an error (401).
-   **`updateUserProfile(req: Request, res: Response)`**
    -   **Route:** `PUT /api/users/profile`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Updates the authenticated user's profile.
    -   **Logic:** Gets `userId` from `req.user`. Extracts `name`, `email` from `req.body`. Calls `user.service.updateUser`. Creates an audit log entry ("Profile Update"). Responds with the updated user object (200) or an error (400).
-   **`updateUserPassword(req: Request, res: Response)`**
    -   **Route:** `PUT /api/users/password`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Updates the authenticated user's password.
    -   **Logic:** Gets `userId` from `req.user`. Extracts `currentPassword`, `newPassword` from `req.body`. Calls `user.service.updatePassword`. Creates an audit log entry ("Password Change"). Responds with a success message (200) or an error (400).
-   **`getAllUsers(req: Request, res: Response)`**
    -   **Route:** `GET /api/users/all`
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Description:** Retrieves all users (admin only).
    -   **Logic:** Calls `user.service.getAllUsers`. Responds with the list of users (200) or an error (500).
-   **`updateUser(req: Request, res: Response)`**
    -   **Route:** `PUT /api/users/`
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Description:** Updates the role and name of a specific user (admin only).
    -   **Logic:** Gets logged-in `userId` from `req.user`. Extracts target `userId`, `newRole`, `name` from `req.body`. Calls `user.service.updateUserRole`. Creates an audit log entry ("Role Update") using the logged-in user's ID. Responds with the updated user object (200) or an error (400).
-   **`deleteUser(req: Request, res: Response)`**
    -   **Route:** `DELETE /api/users/:userId`
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Description:** Deletes a specific user (admin only).
    -   **Logic:** Gets logged-in `userId` from `req.user`. Extracts target `userId` from `req.params`. Calls `user.service.deleteUser`. Creates an audit log entry ("User Deletion") using the logged-in user's ID. Responds with a success message (200) or an error (400).

## Dependencies

-   `express`: For Request and Response types.
-   Services: `user.service`, `audit.service`. 
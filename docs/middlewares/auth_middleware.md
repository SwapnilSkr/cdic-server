# Authentication Middleware (`src/middlewares/auth.middleware.ts`)

Provides Express middleware functions for handling authentication and authorization using JSON Web Tokens (JWT).

## Global Request Extension

The file extends the global `Express.Request` interface to include an optional `user` property:

```typescript
interface Request {
  user?: {
    id: string;
    role?: string;
  };
}
```

This allows the `authenticateToken` middleware to attach the authenticated user's ID and role to the request object for downstream handlers.

## Constants

-   `JWT_SECRET`: Reads the JWT secret key from `process.env.JWT_SECRET`. **Ensure this environment variable is set securely.** Defaults to 'your-secret-key' if not set (which is insecure for production).

## Middleware Functions

-   **`authenticateToken(req: Request, res: Response, next: NextFunction)`**
    -   **Purpose:** Verifies the JWT token provided in the `Authorization` header.
    -   **Logic:**
        1.  Extracts the token from the `Authorization: Bearer <token>` header.
        2.  If no token is found, sends a 401 (Unauthorized) response.
        3.  Uses `jwt.verify` to validate the token against the `JWT_SECRET`.
        4.  If verification fails (invalid or expired token), sends a 403 (Forbidden) response.
        5.  If verification succeeds, retrieves the full user document from the `User` model using the `id` from the decoded token.
        6.  Attaches an object `{ id: decoded.id, role: user?.role }` to `req.user`.
        7.  Calls `next()` to pass control to the next middleware or route handler.
        8.  Catches potential errors during verification or user lookup and sends a 500 response.

-   **`requireRole(roles: string[])`**
    -   **Purpose:** Creates a middleware function that checks if the authenticated user has one of the specified roles.
    -   **Usage:** Typically used *after* `authenticateToken` in the middleware chain.
        ```javascript
        // Example usage in a router
        router.get('/admin-only', authenticateToken, requireRole(['admin']), adminController);
        ```
    -   **Logic:**
        1.  Checks if `req.user` and `req.user.role` exist (implies `authenticateToken` ran successfully).
        2.  If not authenticated, sends a 401 response.
        3.  Checks if the `req.user.role` is included in the `roles` array passed to the factory function.
        4.  If the role is not included, sends a 403 (Forbidden) response.
        5.  If the role is allowed, calls `next()`.

## Dependencies

-   `express`: For Request, Response, NextFunction types.
-   `jsonwebtoken`: For verifying JWT tokens.
-   Models: `User` (to fetch user role after token verification). 
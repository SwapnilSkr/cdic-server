# Audit Controller (`src/controllers/audit.controller.ts`)

Handles HTTP requests related to audit logging.

## Functions

-   **`createAudit(req: Request, res: Response)`**
    -   **Route:** `POST /api/audit`
    -   **Middleware:** `authenticateToken`
    -   **Description:** Creates a new audit log entry.
    -   **Logic:**
        1.  Extracts `action` and `actionType` from the request body.
        2.  Gets the authenticated `userId` from `req.user`.
        3.  Validates that `userId` exists.
        4.  Calls `audit.service.createAudit({ userId, action, actionType })`.
        5.  Sends the created audit entry back with a 201 status.
        6.  Handles errors by sending a 500 status with an error message.

-   **`getAudits(req: Request, res: Response)`**
    -   **Route:** `GET /api/audit`
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Description:** Retrieves a paginated list of audit entries (admin only).
    -   **Logic:**
        1.  Parses `page` and `limit` query parameters (defaulting to 1 and 10).
        2.  Calls `audit.service.getAllAudits(page, limit)`.
        3.  Sends the result (containing audits and pagination info) back with a 200 status.
        4.  Handles errors by sending a 500 status with an error message.

## Dependencies

-   `express`: For Request and Response types.
-   Services: `audit.service` (`createAudit`, `getAllAudits`). 
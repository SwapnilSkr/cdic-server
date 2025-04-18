# Audit Router (`src/routers/audit.route.ts`)

Base Path: `/api/audit`

Handles routes related to audit log entries.

## Endpoints

-   **`POST /`**
    -   **Middleware:** `authenticateToken`
    -   **Controller:** `createAudit` (`audit.controller.ts`)
    -   **Description:** Creates a new audit log entry. The request body should contain the action details.
-   **`GET /`**
    -   **Middleware:** `authenticateToken`, `requireRole(['admin'])`
    -   **Controller:** `getAudits` (`audit.controller.ts`)
    -   **Description:** Retrieves a paginated list of all audit log entries. Requires admin privileges. 
# Audit Service (`src/services/audit.service.ts`)

Handles the creation and retrieval of audit log entries.

## Key Responsibilities

-   Creating new audit log entries based on user actions.
-   Retrieving a paginated list of all audit log entries, sorted by timestamp.

## Core Functions

-   `createAudit(data: { userId, action, actionType })`: Creates and saves a new `Audit` document.
-   `getAllAudits(page, limit)`: Retrieves a paginated list of audit entries.
    -   Sorts entries by `timestamp` in descending order (most recent first).
    -   Populates the `user` field with the user's `name` and `email`.
    -   Returns the list of audits and pagination metadata (total items, current page, total pages).

## Dependencies

-   Models: `Audit`.
-   `mongoose`: Used implicitly via the model. 
# API Endpoint Summary

This document provides a summary of the available API endpoints, grouped by resource.

**Base URL:** `/api`

*(Note: `[Auth]` indicates authentication required, `[Admin]` indicates admin role required)*

## AI (`/ai`)

-   `POST /chat` [Auth]: Send chat message and get AI response.
-   `GET /history` [Auth]: Get user's chat history.

## Audit (`/audit`)

-   `POST /` [Auth]: Create a new audit log entry.
-   `GET /` [Auth, Admin]: Get all audit log entries (paginated).

## Authors (`/authors`)

-   `GET /`: Get list of authors (paginated, filterable by search, platform, flagged status).
-   `POST /:authorId/flag` [Auth]: Toggle the flagged status of an author.

## Posts (`/posts`)

-   `POST /upload` [Auth]: Trigger fetch for posts associated with a new/updated topic.
-   `POST /fetch-by-url`: Fetch and store a single post by URL.
-   `GET /all` [Auth]: Get all stored posts (paginated, filterable).
-   `GET /flagged` [Auth]: Get flagged posts (paginated, filterable).
-   `POST /toggle-flag/:postId` [Auth]: Toggle the flagged status of a post.
-   `GET /platform-statistics`: Get statistics grouped by platform.
-   `GET /statistics`: Get overall post statistics.
-   `GET /today-discussed` [Auth]: Get feed of today's most discussed posts.
-   `GET /reviewed` [Auth]: Get posts marked as reviewed.
-   `POST /dismiss/:postId` [Auth]: Mark a post as dismissed.
-   `PUT /:postId/status` [Auth]: Update the review status of a post.
-   `GET /:postId` [Auth]: Get details for a single post.
-   `POST /fetch-all-topics` [Auth]: Trigger background job to fetch posts for all active topics.
-   *(Admin/Utility Endpoints omitted for brevity: `/add-field`, `/rename-platform`, `/test-reddit`, `/test-query`)*
-   `POST /:postId/comments` [Auth]: Add a comment to a post.
-   `GET /:postId/comments` [Auth]: Get comments for a post (paginated).
-   `PUT /:postId/comments/:commentId` [Auth]: Update a specific comment.
-   `DELETE /:postId/comments/:commentId` [Auth]: Delete a specific comment.

## Topics (`/topics`)

-   `POST /` [Auth]: Create a new topic.
-   `GET /` [Auth]: Get topics for the authenticated user (paginated).
-   `GET /authors`: Get authors grouped by topic.
-   `GET /:id/authors/flagged`: Get flagged authors for a specific topic (paginated, filterable).
-   `GET /:id/authors`: Get authors for a specific topic (paginated, filterable).
-   `PUT /:id` [Auth]: Update a specific topic.
-   `DELETE /:id` [Auth]: Delete a specific topic (and associated posts).

## Users (`/users`)

-   `POST /register`: Register a new user.
-   `POST /login`: Log in a user, receive JWT.
-   `PUT /profile` [Auth]: Update authenticated user's profile (name, email).
-   `PUT /password` [Auth]: Update authenticated user's password.
-   `GET /all` [Auth, Admin]: Get a list of all users.
-   `PUT /` [Auth, Admin]: Update a specific user's details (role, name).
-   `DELETE /:userId` [Auth, Admin]: Delete a specific user. 
# Data Models (`src/models`)

This section describes the Mongoose data models used in the application to interact with the MongoDB database.

## Available Models

-   [User](./user_model.md): Represents application users.
-   [AIChatHistory](./aiChat_model.md): Stores the history of conversations between users and the AI assistant.
-   [Author](./author_model.md): Represents content creators or social media handles monitored by the system.
-   [Post](./post_model.md): Represents individual pieces of content (e.g., social media posts, articles) collected by the system.
-   [Topic](./topic_model.md): Represents specific subjects or themes tracked within the content.
-   [Audit](./audit_model.md): Records actions performed within the system for auditing purposes.
-   [Comment](./comment_model.md): Represents user comments on posts, often for review purposes.

## Model Relationship Diagram (Simplified)

This diagram shows the primary relationships between the core data models.

```mermaid
classDiagram
    direction LR

    class User {
        +ObjectId _id
        +String username
        +String email
        +String password
        +String role
    }

    class AIChatHistory {
        +ObjectId _id
        +ObjectId userId
        +Message[] messages
    }

    class Author {
        +ObjectId _id
        +String author_id
        +String username
        +String name
        +String platform
        +Number followers_count
        +String profile_image_url
    }

    class Post {
        +ObjectId _id
        +String post_id
        +String author_id
        +String platform
        +String caption
        +String media_url
        +Date created_at
        +Number likesCount
        +Number commentsCount
        +Number viewsCount
        +String flagged
        +ObjectId topic_id
    }

    class Topic {
        +ObjectId _id
        +String name
        +String description
        +String[] keywords
        +String status
    }

    class Audit {
      +ObjectId _id
      +ObjectId userId
      +String action
      +String entity
      +ObjectId entityId
      +Object details
      +Date timestamp
    }

    User "1" -- "1" AIChatHistory : has
    User "1" -- "*" Audit : performs
    Author "1" -- "*" Post : creates
    Topic "1" -- "*" Post : relates to
    Post ..> Author : contains author_id
    Post ..> Topic : contains topic_id
    AIChatHistory ..> User : contains userId
    Audit ..> User : contains userId
```

*Note: Cardinality (e.g., `1`, `*`) indicates typical relationships (one-to-one, one-to-many). Dotted lines (`..>`) indicate a reference via an ID field.* 
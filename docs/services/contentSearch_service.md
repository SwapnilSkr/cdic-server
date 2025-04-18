# Content Search Service (`src/services/contentSearch.service.ts`)

This service provides functionality for searching and retrieving information about posts, authors, and topics from the database. It leverages AI for understanding natural language queries and summarizing results.

## Key Responsibilities

-   Searching `Post` documents based on content keywords, platform, timeframe, and related incidents/topics.
-   Searching `Author` documents by username and enriching results with platform statistics and recent posts.
-   Calculating and retrieving detailed platform statistics (post counts, engagement, unique authors, etc.).
-   Retrieving posts associated with a specific author or topic.
-   Performing an "intelligent search" that determines the user's likely intent (posts, authors, topics, stats) and executes the appropriate search strategy.
-   Using OpenAI (`gpt-4o-mini`) to extract structured search entities (names, platforms, timeframe, incident) from natural language queries, considering recent conversation history.
-   Using OpenAI (`gpt-4o-mini`) to generate a concise summary of search results based on the original query.
-   Building complex MongoDB query objects based on extracted search entities.

## Core Functions

-   `extractSearchEntities(query: string, last5Messages: any[])`: Uses OpenAI to analyze a user query (and recent chat context) to extract structured search parameters like names, platforms, timeframe, and incident/topic keywords.
-   `buildContentSearchQuery(entities: {...})`: Constructs a MongoDB query object for the `Post` collection based on the entities extracted by `extractSearchEntities`. It handles `$or` conditions for names/keywords and filters for platform and `created_at` timeframe.
-   `searchPostsByContent(query: string, limit: number, last5Messages: any[])`: Searches posts using `extractSearchEntities` and `buildContentSearchQuery`.
-   `searchAuthors(query: string, limit: number, includeDetailedPosts: boolean, last5Messages: any[])`: Searches authors by name using `extractSearchEntities`. If `includeDetailedPosts` is true, it enriches author data with detailed stats (total posts, likes, comments, avg engagement) and lists recent/top posts by querying the `Post` collection.
-   `getPlatformStatistics()`: Aggregates data from the `Post` collection to provide comprehensive statistics per platform (post count, engagement totals, views, unique authors, avg engagement) and overall totals (posts, authors, topics, flagged posts, total engagement).
-   `getPostsByAuthor(authorId: string, limit: number)`: Retrieves recent posts for a specific author ID.
-   `getPostsByTopic(topic: string, limit: number, last5Messages: any[])`: Searches posts related to a specific topic using `extractSearchEntities`.
-   `determineSearchIntent(query: string, last5Messages: any[])`: Uses OpenAI to predict the primary entity the user is searching for (e.g., "posts", "authors", "topics", "statistics") based on the query and conversation context.
-   `generateResultsSummary(results: any[], prompt: string)`: Uses OpenAI to create a natural language summary of the search results, tailored to the original search prompt.
-   `intelligentSearch(query: string, limit: number, last5Messages: any[])`: Orchestrates the primary search flow:
    1.  Calls `determineSearchIntent`.
    2.  Based on the intent, calls the relevant search function (`searchPostsByContent`, `searchAuthors`, `getPostsByTopic`, `getPlatformStatistics`).
    3.  Calls `generateResultsSummary` to summarize the findings.
    4.  Returns the type of data found, the data itself, and the summary.

## `intelligentSearch` Flow Diagram

```mermaid
graph TD
    subgraph IntelligentSearch
        direction LR
        A[Input Query + History] --> B{Determine Intent (AI)};
        B -- Posts --> C[searchPostsByContent];
        B -- Authors --> D[searchAuthors];
        B -- Topics --> E[getPostsByTopic];
        B -- Statistics --> F[getPlatformStatistics];
        C --> G[Results];
        D --> G;
        E --> G;
        F --> G;
        G --> H{Generate Summary (AI)};
        H --> I[Output: {type, data, summary}];
    end

    subgraph Dependencies
        C --> X{extractSearchEntities (AI)};
        D --> X;
        E --> X;
        X --> Y[buildContentSearchQuery];
        C --> Y;
        E --> Y;
        Y --> Z[(Database)];
        F --> Z;
        D --> Z;
    end
```

## Dependencies

-   `openai`: Node.js library for interacting with the OpenAI API.
-   `dotenv`: For loading environment variables.
-   Models: `Post`, `Author`, `TopicModel`. 
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import dotenv from "dotenv";
import { AIChatHistoryModel } from "../models/aiChat.model";
import mongoose from "mongoose";
import Post from "../models/post.model";
import Author from "../models/author.model";
import { TopicModel } from "../models/topic.model";
import {
  intelligentSearch,
  getPlatformStatistics,
} from "./contentSearch.service";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const APP_CONTEXT = `You are a helpful assistant for the Verideck dashboard application.
It is a platform that allows users to monitor and fact-check media across multiple channels.
You can help users with:
- Navigation through the dashboard
- Understanding different features and sections
- Explaining how to use various tools and functionalities
- Providing guidance on available actions
- Answering questions about posts and authors in the database

The dashboard contains the following main sections. You can help users navigate through these sections:
- Dashboard (${process.env.CLIENT_URL}/dashboard): Overview of key metrics and recent activities
- Media Feed (${process.env.CLIENT_URL}/dashboard/feed): List of all media and their status
- Topics (${process.env.CLIENT_URL}/dashboard/topics): List of all topics and their status
- Reporting (${process.env.CLIENT_URL}/dashboard/reporting): List of all reporting and their status
- Flagged Posts (${process.env.CLIENT_URL}/dashboard/flagged): List of all flagged posts and their status
- Handles (${process.env.CLIENT_URL}/dashboard/handles): List of all social media handles and their status
- User Management (${process.env.CLIENT_URL}/dashboard/user): List of all users and their status

When asked specifically about the database:
- You have the ability to provide information about post and author metrics
- You can report on platform statistics, flagged content, and review status
- You can help users understand the distribution and engagement metrics across platforms

Response format:
- Keep responses concise and focused on the question
- If you don't have specific database information, you should indicate that clearly
- When providing statistics, present them in a clear, structured format
`;

export const getChatHistory = async (userId: string) => {
  try {
    const history = await AIChatHistoryModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });
    return history?.messages || [];
  } catch (error) {
    console.error("Error fetching chat history:", error);
    throw error;
  }
};

async function classifyUserIntent(message: string): Promise<{
  queryType: string;
  platforms: string[];
  timeframe: string;
  metric: string;
  sortBy: string;
  limit: number;
  filters: Record<string, any>;
}> {
  try {
    const prompt = `
You are analyzing a user's query to a dashboard system for media monitoring. 
Extract the following information from this query: "${message}"

1. Query Type: What kind of data is being requested? (posts, authors, topics, statistics, etc.)
2. Platforms: Which platforms are mentioned? (Instagram, Twitter, YouTube, News, or "all" if not specified)
3. Timeframe: What time period is being asked about? (today, this week, this month, all time, etc.)
4. Metric: What specific metric is being asked about? (count, engagement, likes, followers, growth, etc.)
5. Sort By: How should results be sorted? (newest, oldest, most popular, highest engagement, etc.)
6. Limit: How many results are requested? (default to 5 if not specified)
7. Filters: Any specific filters mentioned? (flagged content, specific topics, etc.)

Return ONLY a JSON object with these fields. Do not include any explanation or commentary.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      queryType: result.queryType || "unknown",
      platforms: result.platforms || ["all"],
      timeframe: result.timeframe || "all time",
      metric: result.metric || "count",
      sortBy: result.sortBy || "newest",
      limit: result.limit || 5,
      filters: result.filters || {},
    };
  } catch (error) {
    console.error("Error classifying user intent:", error);
    return {
      queryType: "unknown",
      platforms: ["all"],
      timeframe: "all time",
      metric: "count",
      sortBy: "newest",
      limit: 5,
      filters: {},
    };
  }
}

async function fetchDatabaseInfo(message: string): Promise<string | null> {
  try {
    const intent = await classifyUserIntent(message);
    console.log(`Classified user intent: ${JSON.stringify(intent)}`);

    if (intent.queryType === "unknown") {
      return null;
    }

    let dbInfo = "";

    const timeframeFilter: any = {};
    if (intent.timeframe !== "all time") {
      const now = new Date();
      let startDate = new Date();

      if (intent.timeframe === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (intent.timeframe === "this week") {
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        startDate.setHours(0, 0, 0, 0);
      } else if (intent.timeframe === "this month") {
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      } else if (intent.timeframe === "this year") {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else if (intent.timeframe === "last 24 hours") {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (intent.timeframe === "last 7 days") {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (intent.timeframe === "last 30 days") {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      timeframeFilter.created_at = { $gte: startDate, $lte: now };
    }

    const platformFilter: any = {};
    if (intent.platforms.length > 0 && !intent.platforms.includes("all")) {
      platformFilter.platform = { $in: intent.platforms };
    }

    const baseFilter = { ...timeframeFilter, ...platformFilter };
    if (intent.filters.flagged) {
      baseFilter.flagged = true;
    }

    if (intent.queryType.toLowerCase().includes("post")) {
      if (intent.metric === "count") {
        const totalQuery = { ...baseFilter };
        const totalPosts = await Post.countDocuments(totalQuery);

        const flaggedQuery = { ...baseFilter, flagged: true };
        const flaggedPosts = await Post.countDocuments(flaggedQuery);

        dbInfo += `Post Statistics (${intent.timeframe}):\n`;
        dbInfo += `- Total Posts: ${totalPosts}\n`;
        dbInfo += `- Flagged Posts: ${flaggedPosts}\n`;

        if (intent.platforms.includes("all")) {
          const platformStats = await Post.aggregate([
            { $match: timeframeFilter },
            {
              $group: {
                _id: "$platform",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ]);

          if (platformStats.length > 0) {
            dbInfo += `\nPlatform Distribution:\n`;
            platformStats.forEach((platform) => {
              if (platform._id) {
                dbInfo += `- ${platform._id}: ${platform.count} posts\n`;
              }
            });
          }
        }
      } else if (
        intent.metric === "engagement" ||
        intent.metric === "popular"
      ) {
        const sortOption: any = {};
        if (intent.metric === "engagement") {
          sortOption.likesCount = -1;
          sortOption.commentsCount = -1;
        } else if (intent.sortBy === "newest") {
          sortOption.created_at = -1;
        } else if (intent.sortBy === "oldest") {
          sortOption.created_at = 1;
        }

        const posts = await Post.find(baseFilter)
          .sort(sortOption)
          .limit(intent.limit);

        if (posts.length > 0) {
          dbInfo += `Top ${posts.length} Posts by ${intent.sortBy} (${intent.timeframe}):\n`;
          posts.forEach((post, index) => {
            const caption = post.caption || post.title || "No caption";
            const truncatedCaption =
              caption.length > 50 ? caption.substring(0, 47) + "..." : caption;
            dbInfo += `${index + 1}. Platform: ${post.platform}, Engagement: ${
              post.likesCount + post.commentsCount
            }, Caption: "${truncatedCaption}"\n`;
          });
        } else {
          dbInfo += `No posts found matching the criteria.\n`;
        }
      }
    } else if (
      intent.queryType.toLowerCase().includes("author") ||
      intent.queryType.toLowerCase().includes("handle")
    ) {
      if (intent.metric === "count") {
        const totalAuthors = await Author.countDocuments();
        const flaggedAuthors = await Author.countDocuments({ flagged: true });

        dbInfo += `Author Statistics:\n`;
        dbInfo += `- Total Authors/Handles: ${totalAuthors}\n`;
        dbInfo += `- Flagged Authors: ${flaggedAuthors}\n`;
      } else if (intent.metric === "followers" || intent.metric === "popular") {
        const sortOption: any = {};
        if (intent.metric === "followers") {
          sortOption.followers_count = -1;
        }

        const authors = await Author.find({})
          .sort(sortOption)
          .limit(intent.limit);

        if (authors.length > 0) {
          dbInfo += `Top ${authors.length} Authors by Followers:\n`;
          for (const [index, author] of authors.entries()) {
            const post = await Post.findOne({ author_id: author.author_id });
            dbInfo += `${index + 1}. ${author.username} (${
              post?.platform || "Unknown"
            }): ${author.followers_count.toLocaleString()} followers\n`;
          }
        }
      }
    } else if (intent.queryType.toLowerCase().includes("topic")) {
      const topics = await TopicModel.find({}).limit(intent.limit);

      if (topics.length > 0) {
        dbInfo += `Topics in the system:\n`;
        topics.forEach((topic, index) => {
          dbInfo += `${index + 1}. ${topic.name} (${
            topic.active ? "Active" : "Inactive"
          })\n`;
        });
      }
    } else if (
      intent.queryType.toLowerCase().includes("stat") ||
      intent.queryType.toLowerCase().includes("metric")
    ) {
      const stats = await getPlatformStatistics();

      dbInfo += `Dashboard Statistics:\n`;
      dbInfo += `- Total Posts: ${stats.totals.postCount}\n`;
      dbInfo += `- Total Authors: ${stats.totals.authorCount}\n`;
      dbInfo += `- Flagged Posts: ${stats.totals.flaggedPostCount}\n`;
      dbInfo += `- Total Topics: ${stats.totals.topicCount}\n`;

      dbInfo += `\nPlatform Distribution:\n`;
      stats.platforms.forEach(
        (platform: { _id: any; postCount: any; avgEngagement: number }) => {
          if (platform._id) {
            dbInfo += `- ${platform._id}: ${platform.postCount} posts, ${
              Math.round(platform.avgEngagement * 100) / 100
            } avg engagement\n`;
          }
        }
      );

      dbInfo += `\nAuthor Distribution by Platform:\n`;
      stats.authorsByPlatform.forEach(
        (platform: { _id: any; authorCount: any; avgFollowers: number }) => {
          if (platform._id) {
            dbInfo += `- ${platform._id}: ${
              platform.authorCount
            } authors, ${Math.round(platform.avgFollowers)} avg followers\n`;
          }
        }
      );
    }

    return dbInfo || null;
  } catch (error) {
    console.error("Error fetching database info:", error);
    return null;
  }
}

export const generateResponse = async (
  messages: ChatCompletionMessageParam[],
  userId: string
) => {
  try {
    const latestMessage = messages[messages.length - 1];
    let dbInfo: string | null = null;
    let searchResults: any = null;

    //get last 5 messages
    const chatHistory = await getChatHistory(userId);
    const last5Messages = chatHistory.slice(-5);

    if (
      latestMessage.role === "user" &&
      typeof latestMessage.content === "string"
    ) {
      console.log("Analyzing user message for potential database queries...");

      const isDbQuery = await isDataBaseRelatedQuery(latestMessage.content);

      if (isDbQuery) {
        console.log(
          "Message appears to be database-related, fetching relevant information..."
        );

        try {
          // First, check if the query is related to platform statistics
          if (
            latestMessage.content.toLowerCase().includes("platform") &&
            (latestMessage.content.toLowerCase().includes("stat") ||
              latestMessage.content.toLowerCase().includes("metrics") ||
              latestMessage.content.toLowerCase().includes("distribution"))
          ) {
            const stats = await getPlatformStatistics();
            searchResults = {
              type: "stats",
              data: [stats],
              summary:
                "Here are the platform statistics across our monitoring system.",
            };
          }
          // Next, check if it's specifically about an author
          else if (
            latestMessage.content.toLowerCase().includes("author") ||
            latestMessage.content.toLowerCase().includes("account") ||
            latestMessage.content.toLowerCase().includes("creator") ||
            latestMessage.content.toLowerCase().includes("handle")
          ) {
            searchResults = await intelligentSearch(latestMessage.content, 5, last5Messages);

            // If no author results found, this will fall through to the next check
            if (
              searchResults.type !== "author" ||
              searchResults.data.length === 0
            ) {
              searchResults = null;
            }
          }
          // Otherwise try generic intelligent search
          else {
            searchResults = await intelligentSearch(latestMessage.content, 5, last5Messages);
          }

          if (
            searchResults &&
            searchResults.data &&
            searchResults.data.length > 0
          ) {
            console.log(
              `Found ${searchResults.data.length} specific results for the query`
            );

            dbInfo = `Search Results for "${latestMessage.content}":\n\n`;
            dbInfo += `${searchResults.summary}\n\n`;

            if (
              searchResults.type === "post" ||
              searchResults.type === "topic" ||
              searchResults.type === "incident"
            ) {
              dbInfo += "Sample Posts:\n";
              searchResults.data
                .slice(0, 3)
                .forEach((post: any, index: number) => {
                  const content = post.caption || post.title || "No caption";
                  const platform = post.platform || "Unknown platform";
                  const engagement =
                    (post.likesCount || 0) + (post.commentsCount || 0);
                  const date = post.created_at
                    ? new Date(post.created_at).toLocaleDateString()
                    : "Unknown date";

                  dbInfo += `${index + 1}. ${platform} post from ${date}\n`;
                  dbInfo += `   Content: "${content.substring(0, 100)}${
                    content.length > 100 ? "..." : ""
                  }"\n`;
                  dbInfo += `   Engagement: ${engagement} interactions\n\n`;
                });
            } else if (searchResults.type === "author") {
              dbInfo += "Creator Information:\n";
              searchResults.data
                .slice(0, 3)
                .forEach((author: any, index: number) => {
                  const followerCount = author.followers_count
                    ? author.followers_count.toLocaleString()
                    : "Unknown";
                  const platform = author.platform || "Unknown platform";

                  dbInfo += `${index + 1}. ${author.username} (${platform})\n`;
                  dbInfo += `   Followers: ${followerCount}\n`;

                  // Include author statistics if available
                  if (author.stats) {
                    dbInfo += `   Total Posts: ${author.stats.totalPosts}\n`;
                    dbInfo += `   Total Likes: ${author.stats.totalLikes}\n`;
                    dbInfo += `   Avg Engagement: ${
                      Math.round(author.stats.avgEngagement * 100) / 100
                    }\n`;
                  }

                  // Include recent posts from this author
                  if (author.recentPosts && author.recentPosts.length > 0) {
                    dbInfo += `   Recent Posts:\n`;
                    author.recentPosts
                      .slice(0, 3)
                      .forEach((post: any, postIndex: number) => {
                        dbInfo += `     ${
                          postIndex + 1
                        }. "${post.content.substring(0, 50)}${
                          post.content.length > 50 ? "..." : ""
                        }"\n`;
                        dbInfo += `        Platform: ${
                          post.platform
                        }, Engagement: ${
                          post.engagement.likes + post.engagement.comments
                        }\n`;
                      });
                  }
                  dbInfo += `\n`;
                });
            } else if (searchResults.type === "stats") {
              const stats = searchResults.data[0];

              dbInfo += "Platform Statistics Overview:\n";
              dbInfo += `- Total Content: ${stats.totals.postCount.toLocaleString()} posts\n`;
              dbInfo += `- Total Creators: ${stats.totals.authorCount.toLocaleString()} authors\n`;
              dbInfo += `- Flagged Content: ${stats.totals.flaggedPostCount.toLocaleString()} posts\n`;
              dbInfo += `- Total Engagement: ${
                stats.totals.totalEngagement?.toLocaleString() || "N/A"
              } interactions\n\n`;

              dbInfo += "Content Distribution by Platform:\n";
              stats.platforms.forEach(
                (platform: {
                  _id: any;
                  engagementRate: number;
                  postCount: { toLocaleString: () => any };
                  uniqueAuthorCount: any;
                  avgEngagement: any;
                }) => {
                  if (platform._id) {
                    const engagementRate = platform.engagementRate
                      ? `${(
                          Math.round(platform.engagementRate * 100) / 100
                        ).toFixed(2)}%`
                      : "N/A";

                    dbInfo += `- ${
                      platform._id
                    }: ${platform.postCount.toLocaleString()} posts | `;
                    dbInfo += `${(
                      platform.uniqueAuthorCount || 0
                    ).toLocaleString()} creators | `;
                    dbInfo += `${Math.round(
                      platform.avgEngagement || 0
                    ).toLocaleString()} avg. engagement | `;
                    dbInfo += `${engagementRate} engagement rate\n`;
                  }
                }
              );

              dbInfo += "\nCreator Distribution by Platform:\n";
              stats.authorsByPlatform.forEach(
                (platform: {
                  _id: any;
                  authorCount: { toLocaleString: () => any };
                  avgFollowers: any;
                  maxFollowers: any;
                }) => {
                  if (platform._id) {
                    dbInfo += `- ${
                      platform._id
                    }: ${platform.authorCount.toLocaleString()} creators | `;
                    dbInfo += `${Math.round(
                      platform.avgFollowers || 0
                    ).toLocaleString()} avg. followers | `;
                    dbInfo += `${(
                      platform.maxFollowers || 0
                    ).toLocaleString()} max followers\n`;
                  }
                }
              );

              if (stats.flaggedContent && stats.flaggedContent.length > 0) {
                dbInfo += "\nFlagged Content by Platform:\n";
                stats.flaggedContent.forEach(
                  (platform: {
                    _id: any;
                    flaggedCount: { toLocaleString: () => any };
                    avgEngagement: any;
                  }) => {
                    if (platform._id) {
                      dbInfo += `- ${
                        platform._id
                      }: ${platform.flaggedCount.toLocaleString()} flagged posts | `;
                      dbInfo += `${Math.round(
                        platform.avgEngagement || 0
                      ).toLocaleString()} avg. engagement\n`;
                    }
                  }
                );
              }

              if (stats.timeDistribution && stats.timeDistribution.length > 0) {
                dbInfo += "\nContent Activity (Last 6 Months):\n";
                stats.timeDistribution.forEach(
                  (period: {
                    _id: { month: number; year: any };
                    count: { toLocaleString: () => any };
                    totalEngagement: any;
                  }) => {
                    const monthNames = [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ];
                    const month = monthNames[period._id.month - 1 || 0];
                    const year = period._id.year;

                    dbInfo += `- ${month} ${year}: ${period.count.toLocaleString()} posts | `;
                    dbInfo += `${(
                      period.totalEngagement || 0
                    ).toLocaleString()} total engagement\n`;
                  }
                );
              }

              if (stats.platformHealth && stats.platformHealth.length > 0) {
                dbInfo += "\nPlatform Health Metrics:\n";
                stats.platformHealth.forEach(
                  (platform: {
                    platform: any;
                    postToAuthorRatio: any;
                    avgPostEngagement: any;
                  }) => {
                    if (platform.platform) {
                      dbInfo += `- ${platform.platform}: `;
                      dbInfo += `${(platform.postToAuthorRatio || 0).toFixed(
                        1
                      )} posts per creator | `;
                      dbInfo += `${Math.round(
                        platform.avgPostEngagement || 0
                      ).toLocaleString()} engagement per post\n`;
                    }
                  }
                );
              }
            }
          } else {
            console.log(
              "No specific content results found, falling back to general statistics"
            );
            dbInfo = await fetchDatabaseInfo(latestMessage.content);
          }
        } catch (searchError) {
          console.error("Error during intelligent search:", searchError);
          dbInfo = await fetchDatabaseInfo(latestMessage.content);
        }

        if (dbInfo) {
          console.log("Successfully retrieved database information");
        } else {
          console.log("No relevant database information found");
        }
      } else {
        console.log("Message does not appear to be database-related");
      }
    }

    let enhancedContext = APP_CONTEXT;
    if (dbInfo) {
      enhancedContext += `\n\nHere is current information from the database that might be relevant to this query:\n${dbInfo}\n\nIncorporate the above database information naturally in your response without mentioning that it comes from a database query. Present the information as factual knowledge about the dashboard's current state. If there are specific posts, authors, or content mentioned, refer to them directly and naturally in your response.`;
    }

    const conversationWithContext = [
      { role: "system", content: enhancedContext },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages:
        conversationWithContext as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message;

    await AIChatHistoryModel.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $push: {
          messages: [
            {
              role: "user",
              content: messages[messages.length - 1].content,
              timestamp: new Date(),
            },
            {
              role: "assistant",
              content: aiResponse.content,
              timestamp: new Date(),
            },
          ],
        },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true, new: true }
    );

    return aiResponse;
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate AI response");
  }
};

async function isDataBaseRelatedQuery(message: string): Promise<boolean> {
  try {
    const prompt = `
You are analyzing a user's query to determine if it's asking for information about a media monitoring dashboard's database.

Query: "${message}"

The system can answer questions about:
1. Post statistics (counts, engagement, platforms)
2. Author/creator/account/handle information
3. Platform metrics and comparisons
4. Flagged content statistics
5. Topic trends and data
6. Specific incidents or content in the database
7. Specific authors or creators and their content
8. Platform statistics (counts, engagement, platforms)

Is the user asking for any information that would require querying a database of posts, authors, or topics?
The user can ask questions in a very vague way as well. So you need to understand the intent of the user's question.
So basically if user asks anything other than greetings, return "yes" even if they ask about information that is not in the database.
Answer with only "yes" or "no".
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 5,
    });

    const response =
      completion.choices[0].message.content?.toLowerCase().trim() || "";
    return response === "yes";
  } catch (error) {
    console.error("Error classifying database query:", error);
    return true;
  }
}

export const convertSearchQueryToHashtag = async (searchQuery: string) => {
  const prompt = `Convert the following search query to a hashtag: ${searchQuery}
  The conversion should be done in a way that is easy to search for on Instagram.
  No need to convert it in the exact format of the search query, just make it a hashtag optimized for Instagram search.
  Return only the hashtag, no other text or explanation.
  `;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    let content = completion.choices[0].message.content;

    if (content && content.startsWith("#")) {
      content = content.substring(1);
    }

    content = content ? content.trim().replace(/\s+/g, "") : null;

    return content;
  } catch (error) {
    console.error("Error converting search query to hashtag:", error);
    throw error;
  }
};

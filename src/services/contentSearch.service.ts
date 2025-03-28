import Post from "../models/post.model";
import Author from "../models/author.model";
import { TopicModel } from "../models/topic.model";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const searchPostsByContent = async (
  query: string,
  limit: number = 5,
  last5Messages: any[] = []
): Promise<any[]> => {
  try {
    console.log(`🔍 Performing semantic search for: "${query}"`);
    const searchEntities = await extractSearchEntities(query, last5Messages);
    console.log("Search entities:", searchEntities);
    const mongoQuery = buildContentSearchQuery(searchEntities);
    console.log(
      "Mongo query:",
      JSON.stringify(
        mongoQuery,
        (key, value) => {
          if (value instanceof RegExp) {
            return value.toString();
          }
          return value;
        },
        2
      )
    );

    const posts = await Post.find(mongoQuery)
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    console.log("Posts:", posts);
    return posts;
  } catch (error) {
    console.error("❌ Error in semantic post search:", error);
    throw error;
  }
};

export const searchAuthors = async (
  query: string,
  limit: number = 5,
  includeDetailedPosts: boolean = true,
  last5Messages: any[] = [] 
): Promise<any[]> => {
  try {
    console.log(`🔍 Searching for authors matching: "${query}"`);
    const searchEntities = await extractSearchEntities(query, last5Messages);

    let queryConditions = [];

    if (searchEntities.names.length > 0) {
      const nameQueries = searchEntities.names.map((name) => ({
        username: { $regex: name, $options: "i" },
      }));
      queryConditions.push(...nameQueries);
    }

    const findQuery =
      queryConditions.length > 0 ? { $or: queryConditions } : {};

    const authors = await Author.find(findQuery)
      .sort({ followers_count: -1 })
      .limit(limit)
      .lean();

    if (includeDetailedPosts) {
      const enrichedAuthors = await Promise.all(
        authors.map(async (author) => {
          const authorPost = await Post.findOne(
            { author_id: author.author_id },
            { platform: 1 }
          ).lean();

          const recentPosts = await Post.find({ author_id: author.author_id })
            .sort({ created_at: -1, likesCount: -1 })
            .limit(5)
            .lean();

          const stats = {
            totalPosts: await Post.countDocuments({
              author_id: author.author_id,
            }),
            topPosts: await Post.find({ author_id: author.author_id })
              .sort({ likesCount: -1 })
              .limit(5)
              .lean(),
            totalLikes: await Post.aggregate([
              { $match: { author_id: author.author_id } },
              { $group: { _id: null, total: { $sum: "$likesCount" } } },
            ]).then((result) => (result.length > 0 ? result[0].total : 0)),
            totalComments: await Post.aggregate([
              { $match: { author_id: author.author_id } },
              { $group: { _id: null, total: { $sum: "$commentsCount" } } },
            ]).then((result) => (result.length > 0 ? result[0].total : 0)),
            avgEngagement: await Post.aggregate([
              { $match: { author_id: author.author_id } },
              {
                $group: {
                  _id: null,
                  avg: { $avg: { $add: ["$likesCount", "$commentsCount"] } },
                },
              },
            ]).then((result) => (result.length > 0 ? result[0].avg : 0)),
          };

          return {
            ...author,
            platform: authorPost?.platform || "Unknown",
            stats,
            recentPosts: recentPosts.map((post) => ({
              id: post._id,
              content: post.caption || post.title || "",
              created_at: post.created_at,
              platform: post.platform,
              engagement: {
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0,
              },
            })),
          };
        })
      );

      return enrichedAuthors;
    }

    return authors;
  } catch (error) {
    console.error("❌ Error searching authors:", error);
    throw error;
  }
};

export const getPlatformStatistics = async (): Promise<any> => {
  try {
    console.log("Getting platform statistics...");

    const [
      platformStatsBasic,
      authorCounts,
      flaggedCounts,
      totalPosts,
      totalAuthors,
      flaggedPostCount,
      topicCount,
      totalEngagement,
    ] = await Promise.all([
      Post.aggregate([
        {
          $group: {
            _id: "$platform",
            postCount: { $sum: 1 },
            totalLikes: { $sum: { $ifNull: ["$likesCount", 0] } },
            totalComments: { $sum: { $ifNull: ["$commentsCount", 0] } },
            totalViews: { $sum: { $ifNull: ["$viewsCount", 0] } },
            uniqueAuthors: { $addToSet: "$author_id" },
            avgEngagement: {
              $avg: {
                $add: [
                  { $ifNull: ["$likesCount", 0] },
                  { $ifNull: ["$commentsCount", 0] },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            postCount: 1,
            totalLikes: 1,
            totalComments: 1,
            totalViews: 1,
            uniqueAuthorCount: { $size: "$uniqueAuthors" },
            avgEngagement: 1,
          },
        },
        { $sort: { postCount: -1 } },
      ]),

      Post.aggregate([
        {
          $group: {
            _id: {
              platform: "$platform",
              author: "$author_id",
            },
          },
        },
        {
          $group: {
            _id: "$_id.platform",
            authorCount: { $sum: 1 },
          },
        },
        { $sort: { authorCount: -1 } },
      ]),

      Post.aggregate([
        {
          $match: { flagged: true },
        },
        {
          $group: {
            _id: "$platform",
            flaggedCount: { $sum: 1 },
            avgEngagement: {
              $avg: {
                $add: [
                  { $ifNull: ["$likesCount", 0] },
                  { $ifNull: ["$commentsCount", 0] },
                ],
              },
            },
          },
        },
        { $sort: { flaggedCount: -1 } },
      ]),

      Post.countDocuments(),
      Author.countDocuments(),
      Post.countDocuments({ flagged: true }),
      TopicModel.countDocuments(),

      Post.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $add: [
                  { $ifNull: ["$likesCount", 0] },
                  { $ifNull: ["$commentsCount", 0] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    const timeDistribution = await Post.aggregate([
      {
        $match: {
          created_at: {
            $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$created_at" },
            month: { $month: "$created_at" },
          },
          count: { $sum: 1 },
          totalEngagement: {
            $sum: {
              $add: [
                { $ifNull: ["$likesCount", 0] },
                { $ifNull: ["$commentsCount", 0] },
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 },
    ]);

    const topAuthors = await Author.find()
      .sort({ followers_count: -1 })
      .limit(100)
      .lean();

    const authorsByPlatform: {
      _id: any;
      authorCount: any;
      avgFollowers: number;
      maxFollowers: number;
      minFollowers: number;
    }[] = [];
    const platformFollowersMap = new Map();

    const authorPlatformMap = new Map();
    for (const platform of platformStatsBasic) {
      platformFollowersMap.set(platform._id, []);
    }

    const topAuthorIds = topAuthors.map((a) => a.author_id);

    if (topAuthorIds.length > 0) {
      const authorPosts = await Post.find({ author_id: { $in: topAuthorIds } })
        .select("author_id platform")
        .lean();

      for (const post of authorPosts) {
        authorPlatformMap.set(post.author_id, post.platform);
      }

      for (const author of topAuthors) {
        const platform = authorPlatformMap.get(author.author_id);
        if (platform && platformFollowersMap.has(platform)) {
          platformFollowersMap.get(platform).push(author.followers_count || 0);
        }
      }

      for (const [platform, followers] of platformFollowersMap.entries()) {
        if (followers.length > 0) {
          const avgFollowers =
            followers.reduce((a: any, b: any) => a + b, 0) / followers.length;
          const maxFollowers = Math.max(...followers);
          const minFollowers = Math.min(...followers);

          authorsByPlatform.push({
            _id: platform,
            authorCount: followers.length,
            avgFollowers,
            maxFollowers,
            minFollowers,
          });
        }
      }
    }

    for (const platformAuthors of authorCounts) {
      const match = authorsByPlatform.find(
        (p) => p._id === platformAuthors._id
      );
      if (match) {
        match.authorCount = platformAuthors.authorCount;
      } else {
        authorsByPlatform.push({
          _id: platformAuthors._id,
          authorCount: platformAuthors.authorCount,
          avgFollowers: 0,
          maxFollowers: 0,
          minFollowers: 0,
        });
      }
    }

    const totals = {
      postCount: totalPosts,
      authorCount: totalAuthors,
      flaggedPostCount: flaggedPostCount,
      topicCount: topicCount,
      totalEngagement:
        totalEngagement.length > 0 ? totalEngagement[0].total : 0,
    };

    const platformStats = platformStatsBasic.map((platform) => {
      const authorsForPlatform = authorsByPlatform.find(
        (a) => a._id === platform._id
      );
      const authorCount = authorsForPlatform?.authorCount || 0;
      const avgFollowers = authorsForPlatform?.avgFollowers || 0;
      const totalFollowers = authorCount * avgFollowers;

      const engagementRate =
        totalFollowers > 0
          ? ((platform.totalLikes + platform.totalComments) / totalFollowers) *
            100
          : 0;

      return {
        ...platform,
        totalFollowers,
        engagementRate,
      };
    });

    const platformHealthMetrics = platformStats.map((platform) => {
      const authorsForPlatform = authorsByPlatform.find(
        (a) => a._id === platform._id
      ) || {
        authorCount: 0,
        avgFollowers: 0,
      };

      return {
        platform: platform._id,
        postToAuthorRatio:
          platform.uniqueAuthorCount > 0
            ? platform.postCount / platform.uniqueAuthorCount
            : 0,
        avgPostEngagement: platform.avgEngagement,
        avgFollowersPerAuthor: authorsForPlatform.avgFollowers,
        totalReach: platform.totalFollowers,
        contentVolume: platform.postCount,
      };
    });

    return {
      platforms: platformStats,
      authorsByPlatform,
      timeDistribution,
      flaggedContent: flaggedCounts,
      platformHealth: platformHealthMetrics,
      totals,
    };
  } catch (error) {
    console.error("❌ Error getting platform statistics:", error);
    throw error;
  }
};

async function extractSearchEntities(query: string, last5Messages: any[]): Promise<{
  names: string[];
  platforms: string[];
  timeframe: { start: Date; end: Date } | null;
  incident?: string | null;
}> {
  try {
    const prompt = `
You are analyzing a search query for a social media monitoring platform related to author, post, topic or incident or something related to them. 
Extract the following information from this query: "${query}"


1. Names: Identify any person names, organization names, topics in general, posts or specific usernames mentioned. 
   If there's a full name, include both the full name AND individual parts.
   Example: "John Doe" should return ["John Doe", "John", "Doe", "John Doe's post"]

2. Platforms: Identify any platforms mentioned (Instagram, Twitter, YouTube, News)

3. Timeframe: Identify any time periods mentioned. This could be:
   - Natural language (today, this week, this month, last year, etc.)
   - Specific dates ("January 1, 2023", "2023-01-01", "01/01/2023", etc.)
   - Date ranges ("between January and March", "from 2022 to 2023")
   Return the exact timeframe text as found in the query.

4. Incident: If the query refers to a specific incident or event, identify it.
   Be specific but concise.

Here is the conversation history:
${last5Messages.map((message) => `${message.role}: ${message.content}`).join("\n") || "No conversation history available"}

If you think that the user is asking vague questions, then search the conversation history to see if he might be trying to search for something related to the previous queries.
If you get enough context with the current query, then you can ignore the conversation history.


Format your response as JSON object with these fields. Return ONLY the JSON object without any explanation.
Example:
{
  "names": ["John Doe", "John", "Doe"],
  "platforms": ["Twitter"],
  "timeframe": "from January 1, 2023 to March 15, 2023",
  "incident": "John Doe's controversial statement about XYZ"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    if (result.names && result.names.length > 0) {
      const extractedNames = [...result.names];

      for (const name of result.names) {
        if (name.includes(" ")) {
          const parts = name.split(" ");
          for (const part of parts) {
            if (part.length > 1 && !extractedNames.includes(part)) {
              extractedNames.push(part);
            }
          }
        }
      }

      result.names = extractedNames;
    }

    let timeframe = null;
    if (result.timeframe) {
      const now = new Date();
      let startDate = new Date();
      let endDate = new Date();

      const datePattern =
        /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2}|[a-z]+ \d{1,2},? \d{4}|\d{1,2} [a-z]+ \d{4})\b/gi;
      const dateMatches = result.timeframe.match(datePattern);

      const hasFromTo =
        /\b(from|between|after|since)\b.*\b(to|until|before|and)\b/i.test(
          result.timeframe
        );
      const hasFrom = /\b(from|after|since|starting)\b/i.test(result.timeframe);
      const hasTo = /\b(to|until|before|ending)\b/i.test(result.timeframe);

      if (dateMatches && dateMatches.length > 0) {
        try {
          const dates = dateMatches.map(
            (dateStr: string | number | Date) => new Date(dateStr)
          );
          const validDates = dates.filter(
            (d: { getTime: () => number }) => !isNaN(d.getTime())
          );

          if (validDates.length === 2) {
            validDates.sort(
              (a: { getTime: () => number }, b: { getTime: () => number }) =>
                a.getTime() - b.getTime()
            );
            startDate = validDates[0];
            endDate = validDates[1];
            endDate.setHours(23, 59, 59, 999);
            timeframe = { start: startDate, end: endDate };
          } else if (validDates.length === 1) {
            if (hasTo && !hasFrom) {
              endDate = validDates[0];
              endDate.setHours(23, 59, 59, 999);
              startDate = new Date(0);
              timeframe = { start: startDate, end: endDate };
            } else {
              startDate = validDates[0];
              startDate.setHours(0, 0, 0, 0);
              timeframe = { start: startDate, end: now };
            }
          }
        } catch (e) {
          console.error("Error parsing specific dates:", e);
        }
      }

      if (!timeframe) {
        if (result.timeframe.includes("today")) {
          startDate.setHours(0, 0, 0, 0);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("yesterday")) {
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(23, 59, 59, 999);
          timeframe = { start: startDate, end: endDate };
        } else if (result.timeframe.includes("this week")) {
          const day = startDate.getDay();
          startDate.setDate(startDate.getDate() - day);
          startDate.setHours(0, 0, 0, 0);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("last week")) {
          const day = startDate.getDay();
          startDate.setDate(startDate.getDate() - day - 7);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          timeframe = { start: startDate, end: endDate };
        } else if (result.timeframe.includes("this month")) {
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("last month")) {
          startDate.setMonth(startDate.getMonth() - 1);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
          endDate.setDate(0);
          endDate.setHours(23, 59, 59, 999);
          timeframe = { start: startDate, end: endDate };
        } else if (result.timeframe.includes("this year")) {
          startDate = new Date(now.getFullYear(), 0, 1);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("last year")) {
          startDate = new Date(now.getFullYear() - 1, 0, 1);
          endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
          timeframe = { start: startDate, end: endDate };
        } else if (
          result.timeframe.includes("last 24 hours") ||
          result.timeframe.includes("last day")
        ) {
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("last 7 days")) {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          timeframe = { start: startDate, end: now };
        } else if (result.timeframe.includes("last 30 days")) {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          timeframe = { start: startDate, end: now };
        }

        const months = [
          "january",
          "february",
          "march",
          "april",
          "may",
          "june",
          "july",
          "august",
          "september",
          "october",
          "november",
          "december",
        ];
        const yearMatch = result.timeframe.match(/\b(20\d{2})\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();

        for (let i = 0; i < months.length; i++) {
          if (result.timeframe.toLowerCase().includes(months[i])) {
            startDate = new Date(year, i, 1);
            endDate = new Date(year, i + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            timeframe = { start: startDate, end: endDate };
            break;
          }
        }
      }
    }

    return {
      names: result.names || [],
      platforms: result.platforms || [],
      timeframe,
      incident: result.incident || null,
    };
  } catch (error) {
    console.error("Error extracting search entities:", error);
    return {
      names: [],
      platforms: [],
      timeframe: null,
      incident: null,
    };
  }
}

function buildContentSearchQuery(entities: {
  names: string[];
  platforms: string[];
  timeframe: { start: Date; end: Date } | null;
  incident?: string | null;
}): any {
  const query: any = {};
  const conditions: any[] = [];

  if (entities.platforms.length > 0) {
    query.platform = { $in: entities.platforms };
  }

  if (entities.timeframe) {
    query.created_at = {
      $gte: entities.timeframe.start,
      $lte: entities.timeframe.end,
    };
  }

  if (entities.names.length > 0) {
    for (const name of entities.names) {
      if (name.includes(" ")) {
        conditions.push({
          $or: [
            { caption: { $regex: name, $options: "i" } },
            { title: { $regex: name, $options: "i" } },
          ],
        });
      } else {
        conditions.push({
          $or: [
            { caption: { $regex: name, $options: "i" } },
            { title: { $regex: name, $options: "i" } },
          ],
        });
      }
    }

    if (entities.names.length > 1) {
      const fullNameParts = entities.names.filter(
        (name) => !name.includes(" ")
      );
      if (fullNameParts.length > 1) {
        const namePartConditions = fullNameParts.map((part) => ({
          $or: [
            { caption: { $regex: part, $options: "i" } },
            { title: { $regex: part, $options: "i" } },
          ],
        }));

        conditions.push({ $and: namePartConditions });
      }
    }
  }

  if (entities.incident) {
    conditions.push({
      $or: [
        { caption: { $regex: entities.incident, $options: "i" } },
        { title: { $regex: entities.incident, $options: "i" } },
      ],
    });
  }

  if (conditions.length > 0) {
    query.$or = conditions;
  }

  return query;
}

export const getPostsByAuthor = async (
  authorId: string,
  limit: number = 10
): Promise<any[]> => {
  try {
    const posts = await Post.find({ author_id: authorId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();

    return posts;
  } catch (error) {
    console.error("❌ Error fetching posts by author:", error);
    throw error;
  }
};

export const getPostsByTopic = async (
  topic: string,
  limit: number = 10,
  last5Messages: any[] = []
): Promise<any[]> => {
  try {
    const topicDoc = await TopicModel.findOne({
      name: { $regex: topic, $options: "i" },
    });

    if (topicDoc) {
      const posts = await Post.find({ topic_ids: { $in: [topicDoc._id] } })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

      if (posts.length > 0) {
        return posts;
      }
    }

    return await searchPostsByContent(topic, limit, last5Messages);
  } catch (error) {
    console.error("❌ Error fetching posts by topic:", error);
    throw error;
  }
};

export const intelligentSearch = async (
  query: string,
  limit: number = 5,
  last5Messages: any[] = []
): Promise<{
  type: string;
  data: any[];
  summary: string;
}> => {
  try {
    const searchIntent = await determineSearchIntent(query, last5Messages);
    let results: any[] = [];
    let summaryPrompt = "";

    switch (searchIntent.primaryEntity) {
      case "post":
        results = await searchPostsByContent(query, limit, last5Messages);
        summaryPrompt = `Summarize these ${results.length} posts about "${query}" for a social media monitoring dashboard. Include key themes, platforms, include the posts in the summary and the engagement levels.`;
        break;

      case "author":
        results = await searchAuthors(query, limit, true, last5Messages);
        summaryPrompt = `Summarize these ${results.length} authors related to "${query}" for a social media monitoring dashboard. Include their platforms, follower counts, top posts, engagement metrics, and notable content themes.`;
        break;

      case "topic":
        results = await getPostsByTopic(query, limit);
        summaryPrompt = `Summarize these ${results.length} posts about the topic "${query}" for a social media monitoring dashboard. Include key themes, platforms, and engagement levels.`;
        break;

      case "incident":
        results = await searchPostsByContent(query, limit, last5Messages);
        summaryPrompt = `Summarize these ${results.length} posts about the incident "${query}" for a social media monitoring dashboard. Include key details, platforms involved, and engagement metrics.`;
        break;

      case "stats":
        results = [await getPlatformStatistics()];
        summaryPrompt = `Summarize these platform statistics for a social media monitoring dashboard. Include key metrics across platforms, content distribution, and author engagement figures.`;
        break;

      default:
        const postResults = await searchPostsByContent(
          query,
          Math.floor(limit / 2),
          last5Messages
        );
        const authorResults = await searchAuthors(
          query,
          Math.ceil(limit / 2),
          true,
          last5Messages
        );

        if (postResults.length > 0) {
          results = postResults;
          summaryPrompt = `Summarize these ${results.length} posts related to "${query}" for a social media monitoring dashboard.`;
        } else if (authorResults.length > 0) {
          results = authorResults;
          summaryPrompt = `Summarize these ${results.length} authors related to "${query}" for a social media monitoring dashboard.`;
        } else {
          if (
            query.toLowerCase().includes("platform") ||
            query.toLowerCase().includes("stat") ||
            query.toLowerCase().includes("metrics")
          ) {
            results = [await getPlatformStatistics()];
            summaryPrompt = `Summarize these platform statistics for a social media monitoring dashboard.`;
          }
        }
        break;
    }

    let summary = "";
    if (results.length > 0 && summaryPrompt) {
      summary = await generateResultsSummary(results, summaryPrompt);
    } else {
      summary = `No results found for "${query}". Try broadening your search or using different keywords.`;
    }

    return {
      type: searchIntent.primaryEntity,
      data: results,
      summary,
    };
  } catch (error) {
    console.error("❌ Error in intelligent search:", error);
    throw error;
  }
};

async function determineSearchIntent(query: string, last5Messages: any[]): Promise<{
  primaryEntity: string;
  confidence: number;
}> {
  try {
    const prompt = `
You are analyzing a search query for a social media monitoring platform. 
Determine what the user is primarily looking for in this query: "${query}"

Here is the conversation history:
${last5Messages.map((message) => `${message.role}: ${message.content}`).join("\n") || "No conversation history available"}

If you think that the user is asking vague questions, then search the conversation history to see what the user's intent might be.
If you get enough context for the user's intent with the current query, then you can ignore the conversation history.

Select ONE primary entity type from:
- post (looking for specific social media posts or content)
- author (looking for specific creators/authors/handles)
- topic (looking for a general theme or subject)
- incident (looking for posts related to a specific event)
- stats (looking for statistics or metrics related to the application platform/dashboard whose name is Verideck)

Return ONLY a JSON object with:
1. primaryEntity: The primary entity type from the options above
2. confidence: A confidence score from 0 to 1

Example:
{
  "primaryEntity": "incident",
  "confidence": 0.85
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    return {
      primaryEntity: result.primaryEntity || "post",
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error("Error determining search intent:", error);
    return {
      primaryEntity: "post",
      confidence: 0.5,
    };
  }
}

/**
 * Generate a summary of search results using AI
 */
async function generateResultsSummary(
  results: any[],
  prompt: string
): Promise<string> {
  try {
    let resultsData: any = results;

    // For platform stats, format the data specifically
    if (results.length === 1 && results[0].platforms && results[0].totals) {
      const stats = results[0];
      resultsData = {
        platforms: stats.platforms.map((p: any) => ({
          name: p._id,
          posts: p.postCount,
          engagement: Math.round(p.avgEngagement * 100) / 100,
        })),
        authors: stats.authorsByPlatform.map((p: any) => ({
          platform: p._id,
          count: p.authorCount,
          avgFollowers: Math.round(p.avgFollowers),
        })),
        totals: stats.totals,
      };
    }

    const resultsJson = JSON.stringify(resultsData);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nHere is the data to summarize:\n${resultsJson.substring(
            0,
            3000
          )}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error("Error generating results summary:", error);
    return `Found ${results.length} results matching your search.`;
  }
}

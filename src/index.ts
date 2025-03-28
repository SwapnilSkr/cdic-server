import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "../config/database";
import postRouter from "./routers/post.route";
import topicRouter from "./routers/topic.route";
import authorRouter from "./routers/author.route";
import aiRouter from "./routers/ai.route";
import userRouter from "./routers/user.route";
import auditRouter from "./routers/audit.route";
import { initCronJobs } from "./services/cron.service";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/posts", postRouter);
app.use("/api/topics", topicRouter);
app.use("/api/authors", authorRouter);
app.use("/api/ai", aiRouter);
app.use("/api/auth", userRouter);
app.use("/api/audit", auditRouter);

// Connect to MongoDB
connectDB()
  .then(() => {
    // Initialize cron jobs after database connection is established
    initCronJobs();
    
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "../config/database";
import postRouter from "./routers/post.route";
import topicRouter from "./routers/topic.route";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

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

// Connect to MongoDB
connectDB()
  .then(() => {
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

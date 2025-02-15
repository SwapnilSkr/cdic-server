import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add this constant at the top of the file, after the openai initialization
const APP_CONTEXT = `You are a helpful assistant for the Verideck dashboard application.
It is a platform that allows users to monitor and fact-check media across multiple channels.
You can help users with:
- Navigation through the dashboard
- Understanding different features and sections
- Explaining how to use various tools and functionalities
- Providing guidance on available actions

The dashboard contains the following main sections. You can help users navigate through these sections and also provide clean links to the sections without any additional text and parenthesis:ß
- Dashboard (${process.env.CLIENT_URL}/dashboard): Overview of key metrics and recent activities
- Media Feed (${process.env.CLIENT_URL}/dashboard/feed): List of all media and their status
- Topics (${process.env.CLIENT_URL}/dashboard/topics): List of all topics and their status
- Reporting (${process.env.CLIENT_URL}/dashboard/reporting): List of all reporting and their status
- Ask AI (${process.env.CLIENT_URL}/dashboard/ai-chat): Ask AI a question
- Handles (${process.env.CLIENT_URL}/dashboard/handles): List of all social media handles and their status
- User Management (${process.env.CLIENT_URL}/dashboard/user): List of all users and their status

You can also help users with:
- Understanding the different metrics and KPIs
- Providing insights on how to improve their monitoring and fact-checking efforts
- Offering suggestions for better reporting and analysis
`;

export const generateResponse = async (messages: ChatCompletionMessageParam[]) => {
  try {
    // Add system message to the beginning of the conversation
    const conversationWithContext = [
      { role: 'system', content: APP_CONTEXT },
      ...messages
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversationWithContext as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 500,
    });

    return completion.choices[0].message;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to generate AI response');
  }
}; 
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add this constant at the top of the file, after the openai initialization
const APP_CONTEXT = `You are a helpful assistant for the CDIC dashboard application. You can help users with:
- Navigation through the dashboard
- Understanding different features and sections
- Explaining how to use various tools and functionalities
- Providing guidance on available actions

The dashboard contains the following main sections:
[ADD YOUR APP'S SECTIONS AND DESCRIPTIONS HERE]
[Example:
- Home (/dashboard): Overview of key metrics and recent activities
- Projects (/projects): List of all projects and their status
- Settings (/settings): User and application configuration
...]`;

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
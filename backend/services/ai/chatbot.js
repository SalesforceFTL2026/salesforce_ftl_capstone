import { GoogleGenerativeAI } from '@google/generative-ai';

// Create the Gemini client once, using the key from .env.
// This is the Gemini equivalent of the `anthropic` client in clients.js.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ask Gemini a question and get back its text answer.
// @param {string} message - the user's question
// @returns {Promise<string>} the AI's reply
export async function askChatbot(message) {
  // Pick which model to use. gemini-2.0-flash is free and fast.
  // If this ever errors with "model not found", just change this string.
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Send the question and wait for the response.
  const result = await model.generateContent(message);

  // Dig the plain text out of the response object.
  return result.response.text();
}
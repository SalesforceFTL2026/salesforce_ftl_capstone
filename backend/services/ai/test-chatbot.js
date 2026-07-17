import 'dotenv/config';
import { askChatbot } from './chatbot.js';

// Call our function with a test question and print the answer.
const answer = await askChatbot('In one sentence, what should I do during an earthquake?');
console.log('\n🤖 Chatbot says:\n', answer, '\n');
import { askLLM } from '../services/ai/chatbot.js';
import * as requestModel from '../models/requestModel.js';

/**
 * Chat Controller
 * Handles the help-seeker's AI assistant chat.
 */

// How many prior turns of the conversation we accept from the client. Keeping
// this bounded protects the model's context window and our token usage.
const MAX_HISTORY_TURNS = 10;
// Allowed roles for a history message coming from the client.
const VALID_ROLES = new Set(['user', 'assistant']);

// Build the system prompt that makes the assistant aware of *this* help-seeker:
// who they are and what help requests they currently have open.
const buildSystemPrompt = (user, requests) => {
  const requestLines = requests.length
    ? requests
        .map(
          (r) =>
            `- ${r.category} (urgency: ${r.urgency}, status: ${r.status}) at ${r.location}: "${r.description}"`
        )
        .join('\n')
    : '- (no requests submitted yet)';

  return `You are a helpful, calm assistant for MapResponse, a disaster-relief platform.
You are chatting with a help-seeker who may be in a stressful or emergency situation.
Be concise, practical, warm, and reassuring. Give clear safety guidance and help them
understand and manage their help requests.

The person you are helping:
- Name: ${user.name}
- Location: ${user.location || 'not provided'}

Their current help requests (${requests.length}):
${requestLines}

Use this context to give relevant, personalized help. If they ask about the status of
their requests, answer using the list above and do not invent requests that aren't listed.
If they describe a new need, you can suggest they submit a new request from their dashboard.
For any life-threatening emergency, always tell them to call local emergency services (911)
immediately.`;
};

// POST /api/chat
// Body: { message: string, history?: [{ role: 'user'|'assistant', content: string }] }
// Replies with the assistant's answer, grounded in the help-seeker's own data.
export const chat = async (req, res) => {
  try {
    // This assistant is for help-seekers managing their own requests.
    if (req.user.role !== 'help-seeker') {
      return res.status(403).json({
        success: false,
        message: 'The help assistant is only available to help-seekers.',
      });
    }

    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please include a non-empty message.',
      });
    }

    // Sanitize the client-provided history: keep only well-formed user/assistant
    // turns, and cap how many we forward to the model.
    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              VALID_ROLES.has(m.role) &&
              typeof m.content === 'string' &&
              m.content.trim() !== ''
          )
          .slice(-MAX_HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    // Pull the help-seeker's own requests so the assistant can speak to them.
    const requests = await requestModel.getRequestsByUser(req.user.id);
    const systemPrompt = buildSystemPrompt(req.user, requests);

    const reply = await askLLM(message, { systemPrompt, history: safeHistory });

    res.status(200).json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      message: 'The assistant is unavailable right now. Please try again in a moment.',
      error: error.message,
    });
  }
};

import { Router, Request, Response } from 'express';
import { ChatbotEngine, ChatSessionContext } from '../utils/GymBotEngine.js';

const router = Router();

// Instantiate global chatbot NLP engine
const botEngine = new ChatbotEngine();

// In-memory session context storage
const sessions = new Map<string, ChatSessionContext>();

const getOrCreateSession = (sessionId: string): ChatSessionContext => {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      messageCount: 0,
      lastMentionedAmount: null,
      lastMentionedPlan: null,
      lastMentionedSection: null,
    });
  }
  return sessions.get(sessionId)!;
};

// POST /api/gymbot/message
router.post('/message', (req: Request, res: Response) => {
  try {
    const { message, sessionId, role } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'Message and sessionId are required.' });
    }

    const session = getOrCreateSession(sessionId);
    const response = botEngine.handleMessage(message, session, role);
    
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Chatbot message routing error:', error);
    return res.status(500).json({ error: 'Internal chatbot engine error.' });
  }
});

// POST /api/gymbot/reset
router.post('/reset', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required.' });
    }
    
    sessions.delete(sessionId);
    return res.status(200).json({ message: 'Session history successfully reset.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal chatbot engine error.' });
  }
});

// GET /api/gymbot/history/:sessionId
router.get('/history/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = getOrCreateSession(sessionId);
    return res.status(200).json(session);
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal chatbot error.' });
  }
});

export default router;

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  User,
  AlertCircle
} from 'lucide-react';

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  metadata?: {
    tag: string;
    confidence: number;
    method: string;
    entities: {
      amount: number | null;
      plan: string | null;
      section: string | null;
    };
  };
  suggestions?: string[];
}

// Client-side markdown renderer helper
const renderMarkdown = (text: string) => {
  // Bold **text** -> <strong>text</strong>
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline backticks `code` -> <code>code</code>
  html = html.replace(/`(.*?)`/g, '<code class="bg-slate-900 text-gym-primary px-1 py-0.5 rounded font-mono text-xs">$1</code>');
  // Linebreaks -> <br/>
  html = html.replace(/\n/g, '<br/>');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export const GymBot: React.FC = () => {
  const { user } = useAuth();
  
  // Local session ID based on user ID or timestamp
  const [sessionId] = useState(`session_${user?.id || Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest bubble
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load chat history on start
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await apiFetch<any>(`/gymbot/history/${sessionId}`);
        if (data && data.history && data.history.length > 0) {
          setMessages(data.history);
        } else {
          // Send welcome message
          setMessages([
            {
              sender: 'bot',
              text: "Hello! I am **GymBot AI**, your smart fitness dashboard assistant. Ask me about membership pricing, class schedules, profile picture customization, or our biometric synchronization syncing agent! What can I help you check today?",
              timestamp: new Date().toISOString(),
              suggestions: ["View Membership Plans", "Group Class Schedules", "Biometric Check-in Help"]
            }
          ]);
        }
      } catch (err: any) {
        console.error('Failed to load chat history:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [sessionId]);

  // Send a message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    
    // Add user message to UI
    const userMsg: ChatMessage = {
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiFetch<any>('/gymbot/message', {
        method: 'POST',
        body: {
          message: text,
          sessionId: sessionId,
        },
      });
      
      setMessages(prev => [...prev, response]);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the Chatbot engine.');
    } finally {
      setLoading(false);
    }
  };

  // Reset conversation context
  const handleResetChat = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await apiFetch<any>('/gymbot/reset', {
        method: 'POST',
        body: { sessionId },
      });
      setMessages([
        {
          sender: 'bot',
          text: "Conversation context successfully reset! How can I assist you with your fitness portal today?",
          timestamp: new Date().toISOString(),
          suggestions: ["View Membership Plans", "Group Class Schedules", "Biometric Check-in Help"]
        }
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to reset chatbot context.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-gym-text">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gym-secondary flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-gym-primary" />
            GymBot AI Assistant
          </h1>
          <p className="text-gym-muted text-sm mt-1">
            Interact with our scaled attention-network NLP chatbot to query plans, timing, and system rules.
          </p>
        </div>
        
        <button
          onClick={handleResetChat}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded-xl text-xs font-bold transition-all self-start cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
          Reset Chat memory
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Layout Chat Card (Full Width) */}
      <div className="flex flex-col glass-card rounded-2xl border border-slate-100 h-[650px] relative overflow-hidden bg-white/70 w-full">
        
        {/* Chat bubbles list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Icon wrapper */}
              <div className={`h-8 w-8 rounded-full shrink-0 flex items-center justify-center border ${
                msg.sender === 'user' 
                  ? 'bg-gym-secondary text-white border-gym-secondary/10' 
                  : 'bg-gym-primary/10 text-gym-primary border-gym-primary/20'
              }`}>
                {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>

              {/* Bubble content */}
              <div className="space-y-1">
                <div className={`p-4 rounded-2xl text-sm ${
                  msg.sender === 'user'
                    ? 'bg-gym-secondary text-white rounded-tr-none'
                    : 'bg-slate-50 text-gym-text border border-slate-100 rounded-tl-none leading-relaxed'
                }`}>
                  {renderMarkdown(msg.text)}
                </div>
                <span className="block text-[9px] text-gym-muted text-right px-1 mt-0.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {loading && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center bg-gym-primary/10 text-gym-primary border border-gym-primary/20">
                <Sparkles className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 rounded-tl-none flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestions block */}
        {messages.length > 0 && !loading && (
          <div className="px-6 py-2 flex flex-wrap gap-2 justify-start border-t border-slate-100 bg-slate-50/50">
            {(messages[messages.length - 1].suggestions || ["View Membership Plans", "Group Class Schedules", "Biometric Check-in Help"]).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(suggestion)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-gym-primary text-gym-muted hover:text-gym-primary rounded-full text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input Action Controls */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="p-4 border-t border-slate-100 flex gap-3 bg-white"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask anything about Gymnasium (e.g. what plans do you have?)"
            className="gym-input focus:ring-1 focus:ring-gym-primary/25"
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="px-5 bg-gym-primary text-white hover:bg-gym-primary/90 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-all cursor-pointer flex items-center justify-center"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      </div>
    </div>
  );
};

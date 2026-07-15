import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Brain, 
  X, 
  User, 
  DollarSign, 
  Layers, 
  Bookmark, 
  Activity,
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

const renderMarkdown = (text: string) => {
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.*?)`/g, '<code class="bg-slate-900 text-gym-primary px-1 py-0.5 rounded font-mono text-[10px]">$1</code>');
  html = html.replace(/\n/g, '<br/>');
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
};

export const GymBotWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(`session_widget_${user?.id || 'anonymous'}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Explainability drawer state
  const [activeMetadata, setActiveMetadata] = useState<ChatMessage['metadata'] | null>(null);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, loading, isOpen]);

  // Load context-history on drawer toggle
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const fetchHistory = async () => {
        try {
          setLoading(true);
          const data = await apiFetch<any>(`/gymbot/history/${sessionId}`);
          if (data && data.history && data.history.length > 0) {
            setMessages(data.history);
            const lastBot = [...data.history].reverse().find(m => m.sender === 'bot');
            if (lastBot && lastBot.metadata) {
              setActiveMetadata(lastBot.metadata);
            }
          } else {
            // Welcome message tailored by role
            let welcome = "Hello! I am **GymBot AI**, your smart dashboard assistant. ";
            if (user) {
              welcome += `You are logged in as a **${user.role}**. Ask me about plans, branch hours, schedules, or updates!`;
            } else {
              welcome += "Ask me about membership pricing, branches, timing, or rules! Log in to access secure member portals or biometric synchronization diagnostics.";
            }
            setMessages([
              {
                sender: 'bot',
                text: welcome,
                timestamp: new Date().toISOString(),
                suggestions: user?.role === 'ADMIN' 
                  ? ["Active Members List", "Biometric Sync", "Gym Hour Guidelines"] 
                  : ["View Membership Plans", "Group Class Schedules", "Opening Hours"]
              }
            ]);
          }
        } catch (err) {
          console.error('Failed to load widget chat history:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, sessionId, user]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

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
          role: user?.role, // Pass user role to enforce RBAC
        },
      });

      setMessages(prev => [...prev, response]);
      if (response.metadata) {
        setActiveMetadata(response.metadata);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the Chatbot engine.');
    } finally {
      setLoading(false);
    }
  };

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
          text: "Chat memory wiped. Ask me anything!",
          timestamp: new Date().toISOString(),
          suggestions: ["View Membership Plans", "Group Class Schedules"]
        }
      ]);
      setActiveMetadata(null);
      setShowMetadataPanel(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reset chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 text-gym-text">
      
      {/* Floating Action Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-gradient-to-r from-gym-primary to-gym-secondary text-white rounded-full flex items-center justify-center shadow-xl hover:scale-[1.05] active:scale-95 transition-all duration-200 cursor-pointer relative"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6 animate-pulse" />}
      </button>

      {/* Sliding Chat Dialog Popup */}
      {isOpen && (
        <div className="absolute bottom-18 right-0 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] bg-white/95 backdrop-blur border border-slate-200 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-fade-in">
          
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-gym-primary to-gym-secondary text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5" />
              <div>
                <h4 className="font-extrabold text-sm leading-none">GymBot AI</h4>
                <span className="text-[9px] text-gym-primary-light opacity-80 mt-0.5 block">Online Portal Support</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => setShowMetadataPanel(!showMetadataPanel)}
                className="hover:bg-white/10 p-1.5 rounded transition-all cursor-pointer text-white"
                title="Toggle Brain Explainability Panel"
              >
                <Brain className="h-4 w-4" />
              </button>
              <button 
                onClick={handleResetChat}
                className="hover:bg-white/10 p-1.5 rounded transition-all cursor-pointer text-red-200"
                title="Reset Chat Memory"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Explainability Side-drawer Overlay */}
          {showMetadataPanel && (
            <div className="absolute top-11 bottom-14 left-0 right-0 bg-white z-10 border-b border-slate-200 p-4 overflow-y-auto space-y-4 animate-fade-in text-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="font-extrabold text-gym-secondary flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-gym-primary animate-pulse" />
                  NLP EXPLAINABILITY PANEL
                </span>
                <button 
                  onClick={() => setShowMetadataPanel(false)}
                  className="p-1 hover:bg-slate-100 rounded text-gym-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {activeMetadata ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                    <span className="text-[9px] font-bold text-gym-muted uppercase tracking-wider flex items-center gap-1">
                      <Bookmark className="h-3.5 w-3.5 text-gym-primary" />
                      Classified Intent
                    </span>
                    <p className="font-mono text-xs font-extrabold text-gym-secondary">{activeMetadata.tag}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                    <span className="text-[9px] font-bold text-gym-muted uppercase tracking-wider flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-gym-primary" />
                      Decision Confidence
                    </span>
                    <div className="flex justify-between font-bold text-gym-secondary mb-1">
                      <span>Score:</span>
                      <span className="text-gym-primary">{(activeMetadata.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gym-primary h-full rounded-full" style={{ width: `${activeMetadata.confidence * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                    <span className="text-[9px] font-bold text-gym-muted uppercase tracking-wider flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-gym-primary" />
                      Decision Classifier
                    </span>
                    <p className="font-semibold text-gym-secondary">{activeMetadata.method}</p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                    <span className="text-[9px] font-bold text-gym-muted uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5 text-gym-primary" />
                      Extracted Entities
                    </span>
                    <div className="space-y-1 font-semibold text-gym-secondary text-[11px]">
                      <div className="flex justify-between"><span className="text-gym-muted">Amount:</span><span>{activeMetadata.entities.amount !== null ? `₹${activeMetadata.entities.amount.toLocaleString()}` : 'None'}</span></div>
                      <div className="flex justify-between"><span className="text-gym-muted">Plan:</span><span>{activeMetadata.entities.plan || 'None'}</span></div>
                      <div className="flex justify-between"><span className="text-gym-muted">Section:</span><span>{activeMetadata.entities.section || 'None'}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gym-muted italic text-[11px]">
                  Send a message to see raw model decision vectors.
                </div>
              )}
            </div>
          )}

          {/* Main Bubble Log area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`h-6.5 w-6.5 rounded-full shrink-0 flex items-center justify-center border text-[10px] ${
                  msg.sender === 'user' 
                    ? 'bg-gym-secondary text-white border-gym-secondary/10' 
                    : 'bg-gym-primary/10 text-gym-primary border-gym-primary/20'
                }`}>
                  {msg.sender === 'user' ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                </div>

                <div className="space-y-0.5">
                  <div className={`p-3 rounded-xl text-xs ${
                    msg.sender === 'user'
                      ? 'bg-gym-secondary text-white rounded-tr-none'
                      : 'bg-slate-50 text-gym-text border border-slate-100 rounded-tl-none leading-relaxed'
                  }`}>
                    {renderMarkdown(msg.text)}
                  </div>
                  <span className="block text-[8px] text-gym-muted text-right pr-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 max-w-[80%]">
                <div className="h-6.5 w-6.5 rounded-full shrink-0 flex items-center justify-center bg-gym-primary/10 text-gym-primary border border-gym-primary/20">
                  <Sparkles className="h-3 w-3 animate-spin" />
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 rounded-tl-none flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gym-primary/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-center gap-2 text-[10px] font-bold leading-tight">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestions row */}
          {messages.length > 0 && !loading && (
            <div className="px-4 py-1.5 flex flex-nowrap overflow-x-auto gap-2 border-t border-slate-100 bg-slate-50/50 scrollbar-none shrink-0">
              {(messages[messages.length - 1].suggestions || ["View Membership Plans", "Group Class Schedules"]).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:border-gym-primary text-gym-muted hover:text-gym-primary rounded-full text-[10px] font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer hover:scale-102"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input text box */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="p-3 border-t border-slate-100 flex gap-2 bg-white shrink-0"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything (e.g. plans...)"
              className="gym-input text-xs py-2 px-3 focus:ring-1 focus:ring-gym-primary/20"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="px-3.5 bg-gym-primary text-white hover:bg-gym-primary/95 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
};

import { useState, useEffect, useRef } from 'react';
import { supabase, ChatSession, ChatMessage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Plus, MessageCircle, AlertCircle } from 'lucide-react';

export default function Chatbot() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id);
    }
  }, [currentSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setSessions(data);
      if (data.length > 0 && !currentSession) {
        setCurrentSession(data[0]);
      }
    }
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const createNewSession = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{ user_id: user.id, title: 'New Chat' }])
      .select()
      .single();

    if (!error && data) {
      setSessions([data, ...sessions]);
      setCurrentSession(data);
      setMessages([]);
    }
  };

  const callChatbotAPI = async (userMessage: string): Promise<string> => {
    try {
      const conversationHistory = messages
        .map(m => ({
          role: m.is_bot ? 'assistant' : 'user',
          content: m.message,
        }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response || 'Thank you for sharing. I\'m here to listen.';
    } catch (error) {
      console.error('Chatbot API error:', error);
      setApiError('Connection issue. Using fallback response.');
      return generateFallbackResponse(userMessage);
    }
  };

  const generateFallbackResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
      return "I understand you're feeling anxious. That's a very real experience, and it's brave of you to share it. Try this simple breathing exercise: breathe in for 4 counts, hold for 4, and exhale for 4. What specifically is making you feel anxious today?";
    } else if (lowerMessage.includes('sad') || lowerMessage.includes('depressed')) {
      return "I hear that you're feeling down. These feelings are valid and you're not alone. Have you been able to talk to anyone close to you about what you're experiencing? What's been weighing on you?";
    } else if (lowerMessage.includes('stress')) {
      return "Stress can feel overwhelming. Here are some things that might help: Take short breaks, engage in activities you enjoy, exercise even briefly, and talk to someone you trust. What's been your biggest stressor lately?";
    } else if (lowerMessage.includes('sleep') || lowerMessage.includes('insomnia')) {
      return "Sleep difficulties can really impact how you feel overall. Try maintaining a consistent sleep schedule, avoiding screens 30 minutes before bed, and keeping your room cool and dark. Are you dealing with racing thoughts keeping you awake?";
    } else if (lowerMessage.includes('help') || lowerMessage.includes('crisis') || lowerMessage.includes('harm') || lowerMessage.includes('suicid')) {
      return "I'm really glad you reached out. If you're in crisis, please contact emergency services immediately. In the US, you can call 988 (Suicide & Crisis Lifeline) or text 'HELLO' to 741741. These services are available 24/7. You matter.";
    } else if (lowerMessage.includes('thank')) {
      return "You're very welcome. Reaching out and taking care of your mental health is a sign of strength. I'm here whenever you need to talk.";
    } else {
      return "Thank you for sharing that with me. I'm here to listen and support you. Could you tell me more about what's on your mind?";
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentSession || !user || loading) return;

    setLoading(true);
    setApiError('');
    const userMessage = input.trim();
    setInput('');

    const userMsg = {
      session_id: currentSession.id,
      user_id: user.id,
      message: userMessage,
      is_bot: false,
    };

    const { error: userError } = await supabase
      .from('chat_messages')
      .insert([userMsg]);

    if (userError) {
      console.error('Error sending message:', userError);
      setLoading(false);
      return;
    }

    await loadMessages(currentSession.id);

    const botResponse = await callChatbotAPI(userMessage);

    const botMsg = {
      session_id: currentSession.id,
      user_id: user.id,
      message: botResponse,
      is_bot: true,
    };

    const { error: botError } = await supabase
      .from('chat_messages')
      .insert([botMsg]);

    if (!botError) {
      await loadMessages(currentSession.id);
    }

    setLoading(false);
  };

  return (
    <div className="flex h-full">
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={createNewSession}
            className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setCurrentSession(session)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors border-b border-gray-200 ${
                currentSession?.id === session.id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700 truncate">{session.title}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {new Date(session.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Start a Conversation with MindMate AI
                </h3>
                <p className="text-gray-500">
                  Share what's on your mind. I'm here to listen and support you.
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.is_bot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 ${
                    message.is_bot
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-teal-600 text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.message}</p>
                  <div
                    className={`text-xs mt-1 ${
                      message.is_bot ? 'text-gray-500' : 'text-teal-100'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-4">
          {apiError && (
            <div className="mb-3 bg-yellow-50 text-yellow-700 p-2 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

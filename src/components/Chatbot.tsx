import { useState, useEffect, useRef } from 'react';
import { supabase, ChatSession, ChatMessage } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Plus, MessageCircle, AlertCircle } from 'lucide-react';

type ModelType = 'auto' | 'gemini' | 'claude' | 'groq';

export default function Chatbot() {
  const { user } = useAuth();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [selectedModel, setSelectedModel] = useState<ModelType>('auto');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* -------------------- Effects -------------------- */

  useEffect(() => {
    if (user) loadSessions();
  }, [user]);

  useEffect(() => {
    if (currentSession) loadMessages(currentSession.id);
  }, [currentSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* -------------------- DB Calls -------------------- */

  const loadSessions = async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setSessions(data);
      if (!currentSession && data.length > 0) {
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

    if (!error && data) setMessages(data);
  };

  const createNewSession = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert([{ user_id: user.id, title: 'New Chat' }])
      .select()
      .single();

    if (!error && data) {
      setSessions(prev => [data, ...prev]);
      setCurrentSession(data);
      setMessages([]);
    }
  };

  /* -------------------- AI Call -------------------- */

  const callChatbotAPI = async (userMessage: string): Promise<string> => {
    try {
      setApiError('');

      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.is_bot ? 'assistant' : 'user',
        content: m.message,
      }));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) throw new Error('User not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: userMessage,
            conversationHistory,
            model: selectedModel, // 🔥 send selected model
          }),
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      return data.response;
    } catch (err) {
      console.error('Chatbot API error:', err);
      setApiError('Unable to reach AI service. Please try again.');
      return 'I’m having trouble responding right now. Please try again.';
    }
  };

  /* -------------------- Send Message -------------------- */

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
      console.error(userError);
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

    if (!botError) await loadMessages(currentSession.id);

    setLoading(false);
  };

  /* -------------------- UI -------------------- */

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r flex flex-col">
        <div className="p-4 border-b">
          <button
            onClick={createNewSession}
            className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setCurrentSession(session)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-100 ${
                currentSession?.id === session.id ? 'bg-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-gray-500" />
                <span className="truncate text-sm">{session.title}</span>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(session.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.is_bot ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-2xl ${
                  message.is_bot
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-teal-600 text-white'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.message}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="bg-gray-100 px-4 py-2 rounded-xl w-fit">
              MindMate is thinking…
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input + Model Selector */}
        <div className="border-t p-4 space-y-2">
          {apiError && (
            <div className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded flex gap-2">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </div>
          )}

          {/* Model Selector */}
          <div className="flex gap-2">
            {(['auto', 'gemini', 'claude', 'groq'] as ModelType[]).map(model => (
              <button
                key={model}
                type="button"
                onClick={() => setSelectedModel(model)}
                className={`px-3 py-1 rounded-full text-xs border transition ${
                  selectedModel === model
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {model.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 border rounded-lg px-4 py-2"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-teal-600 text-white px-6 py-2 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

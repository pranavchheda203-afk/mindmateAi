import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Chatbot from './components/Chatbot';
import Community from './components/Community';
import Profile from './components/Profile';

function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'chatbot' | 'community' | 'profile'>('chatbot');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'chatbot' && <Chatbot />}
      {currentView === 'community' && <Community />}
      {currentView === 'profile' && <Profile />}
    </Layout>
  );
}

export default App;

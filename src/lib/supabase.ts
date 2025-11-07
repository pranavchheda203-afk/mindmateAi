import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'patient' | 'doctor' | 'ngo';
  bio: string;
  avatar_url: string;
  specialization?: string;
  organization?: string;
  created_at: string;
  updated_at: string;
};

export type ChatSession = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  user_id: string;
  message: string;
  is_bot: boolean;
  created_at: string;
};

export type CommunityPost = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: 'support' | 'resources' | 'question' | 'success-story';
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
};

export type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
};

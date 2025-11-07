import { useState, useEffect } from 'react';
import { supabase, CommunityPost, PostComment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Heart, MessageSquare, Plus, Filter } from 'lucide-react';
import CreatePost from './CreatePost';
import PostDetail from './PostDetail';

export default function Community() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, [categoryFilter]);

  const loadPosts = async () => {
    setLoading(true);
    let query = supabase
      .from('community_posts')
      .select(`
        *,
        profiles(id, full_name, role, avatar_url)
      `)
      .order('created_at', { ascending: false });

    if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setPosts(data);
    }
    setLoading(false);
  };

  const getLikesCount = async (postId: string): Promise<number> => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    return count || 0;
  };

  const getCommentsCount = async (postId: string): Promise<number> => {
    const { count } = await supabase
      .from('post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    return count || 0;
  };

  const [postStats, setPostStats] = useState<Record<string, { likes: number; comments: number }>>({});

  useEffect(() => {
    const loadStats = async () => {
      const stats: Record<string, { likes: number; comments: number }> = {};
      for (const post of posts) {
        const likes = await getLikesCount(post.id);
        const comments = await getCommentsCount(post.id);
        stats[post.id] = { likes, comments };
      }
      setPostStats(stats);
    };

    if (posts.length > 0) {
      loadStats();
    }
  }, [posts]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'support':
        return 'bg-blue-100 text-blue-800';
      case 'resources':
        return 'bg-green-100 text-green-800';
      case 'question':
        return 'bg-yellow-100 text-yellow-800';
      case 'success-story':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'doctor':
        return (
          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">
            Professional
          </span>
        );
      case 'ngo':
        return (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
            Organization
          </span>
        );
      default:
        return null;
    }
  };

  if (showCreatePost) {
    return (
      <CreatePost
        onClose={() => setShowCreatePost(false)}
        onPostCreated={() => {
          setShowCreatePost(false);
          loadPosts();
        }}
      />
    );
  }

  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onPostUpdated={loadPosts}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Community</h2>
          <button
            onClick={() => setShowCreatePost(true)}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {['all', 'support', 'resources', 'question', 'success-story'].map((category) => (
            <button
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                categoryFilter === category
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category === 'all' ? 'All' : category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No posts yet</h3>
          <p className="text-gray-500 mb-4">Be the first to share with the community</p>
          <button
            onClick={() => setShowCreatePost(true)}
            className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            Create Post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer"
              onClick={() => setSelectedPost(post)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-600 font-semibold">
                    {post.is_anonymous
                      ? 'A'
                      : post.profiles?.full_name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">
                      {post.is_anonymous ? 'Anonymous' : post.profiles?.full_name}
                    </span>
                    {!post.is_anonymous && post.profiles && getRoleBadge(post.profiles.role)}
                    <span className="text-sm text-gray-500">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`inline-block text-xs px-2 py-1 rounded-full mt-1 ${getCategoryColor(post.category)}`}>
                    {post.category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-800 mb-2">{post.title}</h3>
              <p className="text-gray-600 line-clamp-3 mb-4">{post.content}</p>

              <div className="flex items-center gap-4 text-gray-500">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span className="text-sm">{postStats[post.id]?.likes || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">{postStats[post.id]?.comments || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

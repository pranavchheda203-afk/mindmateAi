import { useState, useEffect } from 'react';
import { supabase, CommunityPost, PostComment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Heart, MessageSquare, Send } from 'lucide-react';

type PostDetailProps = {
  post: CommunityPost;
  onClose: () => void;
  onPostUpdated: () => void;
};

export default function PostDetail({ post, onClose, onPostUpdated }: PostDetailProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    loadComments();
    loadLikes();
  }, [post.id]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        *,
        profiles(id, full_name, role, avatar_url)
      `)
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setComments(data);
    }
  };

  const loadLikes = async () => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    setLikesCount(count || 0);

    if (user) {
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    if (isLiked) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('post_likes')
        .insert([{ post_id: post.id, user_id: user.id }]);
    }

    loadLikes();
    onPostUpdated();
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setLoading(true);

    const { error } = await supabase
      .from('post_comments')
      .insert([
        {
          post_id: post.id,
          user_id: user.id,
          content: newComment.trim(),
          is_anonymous: isAnonymous,
        },
      ]);

    if (!error) {
      setNewComment('');
      setIsAnonymous(false);
      loadComments();
      onPostUpdated();
    }

    setLoading(false);
  };

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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Community
      </button>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-teal-600 font-semibold text-lg">
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

        <h1 className="text-2xl font-bold text-gray-800 mb-4">{post.title}</h1>
        <p className="text-gray-700 whitespace-pre-wrap mb-6">{post.content}</p>

        <div className="flex items-center gap-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 transition-colors ${
              isLiked ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likesCount}</span>
          </button>
          <div className="flex items-center gap-2 text-gray-500">
            <MessageSquare className="w-5 h-5" />
            <span>{comments.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Comments</h3>

        <form onSubmit={handleSubmitComment} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-2"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="comment-anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="comment-anonymous" className="text-sm text-gray-700">
                Comment anonymously
              </label>
            </div>
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Comment
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No comments yet. Be the first to comment!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-600 font-semibold text-sm">
                      {comment.is_anonymous
                        ? 'A'
                        : comment.profiles?.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-800 text-sm">
                        {comment.is_anonymous ? 'Anonymous' : comment.profiles?.full_name}
                      </span>
                      {!comment.is_anonymous && comment.profiles && getRoleBadge(comment.profiles.role)}
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm">{comment.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

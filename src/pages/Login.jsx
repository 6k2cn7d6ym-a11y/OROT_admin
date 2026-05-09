import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호 결 다시 확인해줘'
          : signInError.message
      );
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF7F2' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#9B5E45' }}>
            오롯 운영자
          </h1>
          <p className="text-sm text-stone-600">로그인 결</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-stone-200">
          <div>
            <label className="block text-sm mb-1 text-stone-700">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-stone-700">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-md text-white font-medium disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#9B5E45' }}
          >
            {submitting ? '들어가는 결...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

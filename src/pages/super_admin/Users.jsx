import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [crisisCount, setCrisisCount] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('profiles')
        .select(`
          id, nickname, gu, last_active_at, created_at, role,
          consent_states!inner(counselor_consent)
        `)
        .eq('consent_states.counselor_consent', true)
        .eq('role', 'user')
        .order('last_active_at', { ascending: false, nullsFirst: false });

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setUsers(data || []);

      if (data && data.length > 0) {
        const userIds = data.map((u) => u.id);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: crises } = await supabase
          .from('crisis_signals')
          .select('user_id, detected_at')
          .in('user_id', userIds)
          .gte('detected_at', thirtyDaysAgo);

        const counts = {};
        (crises || []).forEach((c) => {
          counts[c.user_id] = (counts[c.user_id] || 0) + 1;
        });
        setCrisisCount(counts);
      }

      setLoading(false);
    };

    fetchUsers();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  const formatRelative = (iso) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return formatDate(iso);
  };

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>사용자</h2>
        <p className="text-sm text-stone-600 mt-1">B 동의자 {users.length}명</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">로딩 결...</p>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-lg p-6 border border-stone-200 text-sm text-stone-500">
          B 동의자 결 X
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">닉네임</th>
                <th className="text-left px-4 py-3 font-medium">자치구</th>
                <th className="text-left px-4 py-3 font-medium">최근 활동</th>
                <th className="text-left px-4 py-3 font-medium">위기 (30일)</th>
                <th className="text-left px-4 py-3 font-medium">가입</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const crises = crisisCount[u.id] || 0;
                return (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/super_admin/users/${u.id}`)}
                    className="border-t border-stone-200 hover:bg-stone-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-stone-800">{u.nickname || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{u.gu || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{formatRelative(u.last_active_at)}</td>
                    <td className="px-4 py-3">
                      {crises > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                          {crises}건
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{formatDate(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

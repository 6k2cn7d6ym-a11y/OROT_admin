import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AddAdminModal from './AddAdminModal';
import EditAdminModal from './EditAdminModal';

export default function AdminManagement() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const fetchAdmins = async () => {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.rpc('list_admins');
    if (error) {
      setError(error.message);
    } else {
      setAdmins(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
  };

  return (
    <div className="px-8 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>admin 관리</h2>
          <p className="text-sm text-stone-600 mt-1">박힌 admin {admins.length}명</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-md text-white text-sm font-medium"
          style={{ backgroundColor: '#9B5E45' }}
        >
          + admin 추가
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">로딩 결...</p>
      ) : admins.length === 0 ? (
        <p className="text-sm text-stone-500">박힌 admin X</p>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">닉네임</th>
                <th className="text-left px-4 py-3 font-medium">이메일</th>
                <th className="text-left px-4 py-3 font-medium">role</th>
                <th className="text-left px-4 py-3 font-medium">admin_type</th>
                <th className="text-left px-4 py-3 font-medium">자치구</th>
                <th className="text-left px-4 py-3 font-medium">자격</th>
                <th className="text-left px-4 py-3 font-medium">박힌 일자</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => {
                const isSuperAdmin = a.role === 'super_admin';
                return (
                  <tr
                    key={a.id}
                    onClick={() => !isSuperAdmin && setEditTarget(a)}
                    className={
                      isSuperAdmin
                        ? 'border-t border-stone-200'
                        : 'border-t border-stone-200 hover:bg-stone-50 cursor-pointer'
                    }
                  >
                    <td className="px-4 py-3 text-stone-800">{a.nickname || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{a.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isSuperAdmin ? '#7B9472' : '#9B5E45',
                          color: 'white',
                        }}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{a.admin_type || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{a.assigned_gu || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{a.clinical_role || '—'}</td>
                    <td className="px-4 py-3 text-stone-600">{formatDate(a.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddAdminModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchAdmins(); }}
        />
      )}

      {editTarget && (
        <EditAdminModal
          admin={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchAdmins(); }}
        />
      )}
    </div>
  );
}

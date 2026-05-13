import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const CALL_TYPE_LABELS = {
  in_person: '대면',
  phone: '유선',
  video: '화상',
  other: '기타',
};

const CALL_TYPE_ICONS = {
  in_person: '🤝',
  phone: '📞',
  video: '🎥',
  other: '📝',
};

export default function CallLogs({ profile, isSuperAdmin = false }) {
  const [logs, setLogs] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [adminMap, setAdminMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [guFilter, setGuFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  const fetchLogs = async () => {
    const { data: rows, error } = await supabase
      .from('call_logs')
      .select('id, user_id, admin_id, occurred_at, duration_minutes, call_type, notes, follow_up, created_at, updated_at')
      .order('occurred_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('call_logs 로드 실패:', error);
      setLoading(false);
      return;
    }

    setLogs(rows || []);

    const userIds = [...new Set((rows || []).map(r => r.user_id))];
    const adminIds = [...new Set((rows || []).map(r => r.admin_id).filter(Boolean))];
    const allIds = [...new Set([...userIds, ...adminIds])];

    if (allIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nickname, gu, verified_at')
        .in('id', allIds);

      const userM = {};
      const adminM = {};
      (profs || []).forEach(p => {
        if (userIds.includes(p.id)) userM[p.id] = p;
        if (adminIds.includes(p.id)) adminM[p.id] = p;
      });
      setProfileMap(userM);
      setAdminMap(adminM);
    } else {
      setProfileMap({});
      setAdminMap({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel(`call_logs_${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (typeFilter !== 'all' && log.call_type !== typeFilter) return false;
      if (guFilter !== 'all') {
        const up = profileMap[log.user_id];
        if (!up || up.gu !== guFilter) return false;
      }
      return true;
    });
  }, [logs, typeFilter, guFilter, profileMap]);

  const gus = useMemo(() => {
    const set = new Set();
    Object.values(profileMap).forEach(p => p.gu && set.add(p.gu));
    return [...set].sort();
  }, [profileMap]);

  const selectedLog = logs.find(l => l.id === selectedId);

  const handleSave = async (formData) => {
    const payload = {
      user_id: formData.user_id,
      admin_id: profile.id,
      occurred_at: formData.occurred_at,
      duration_minutes: formData.duration_minutes,
      call_type: formData.call_type,
      notes: formData.notes,
      follow_up: formData.follow_up,
    };

    if (editingLog) {
      const { error } = await supabase
        .from('call_logs')
        .update(payload)
        .eq('id', editingLog.id);
      if (error) {
        alert('수정 실패: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('call_logs')
        .insert(payload);
      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
    }

    setShowForm(false);
    setEditingLog(null);
    fetchLogs();
  };

  const handleDelete = async (id) => {
    if (!confirm('이 통화 기록을 삭제하시겠습니까?')) return;
    const { error } = await supabase
      .from('call_logs')
      .delete()
      .eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    setSelectedId(null);
    fetchLogs();
  };

  if (loading) {
    return <div className="p-8 text-stone-500">로드 중...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>
          대면/유선통화 일지
        </h2>
        <button
          onClick={() => { setEditingLog(null); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium rounded-md text-white"
          style={{ backgroundColor: '#7B9472' }}
        >
          + 새 기록
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {['all', 'in_person', 'phone', 'video', 'other'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 text-xs rounded-full border"
            style={{
              backgroundColor: typeFilter === t ? '#9B5E45' : 'white',
              color: typeFilter === t ? 'white' : '#57534E',
              borderColor: typeFilter === t ? '#9B5E45' : '#D6D3D1',
            }}
          >
            {t === 'all' ? '전체' : CALL_TYPE_LABELS[t]}
          </button>
        ))}

        {isSuperAdmin && gus.length > 0 && (
          <select
            value={guFilter}
            onChange={(e) => setGuFilter(e.target.value)}
            className="ml-2 px-3 py-1.5 text-xs rounded-full border border-stone-300 bg-white"
          >
            <option value="all">전체 자치구</option>
            {gus.map(gu => <option key={gu} value={gu}>{gu}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 max-w-md">
          {filteredLogs.length === 0 ? (
            <div className="text-stone-500 text-sm py-8 text-center">
              기록된 통화 일지가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map(log => {
                const up = profileMap[log.user_id];
                const ap = adminMap[log.admin_id];
                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedId(log.id)}
                    className="p-4 bg-white rounded-md cursor-pointer hover:shadow-sm transition-shadow border"
                    style={{
                      borderColor: selectedId === log.id ? '#9B5E45' : '#E7E5E4',
                    }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-stone-700">
                        {CALL_TYPE_ICONS[log.call_type]} {CALL_TYPE_LABELS[log.call_type]}
                      </span>
                      <span className="text-xs text-stone-500">
                        {log.duration_minutes ? `${log.duration_minutes}분` : ''}
                      </span>
                    </div>
                    <div className="text-sm font-medium" style={{ color: '#9B5E45' }}>
                      {up?.nickname || '(알 수 없음)'}{up?.gu ? ` · ${up.gu}` : ''}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {new Date(log.occurred_at).toLocaleString('ko-KR')}
                    </div>
                    {log.notes && (
                      <div className="text-xs text-stone-600 mt-2 line-clamp-2">
                        {log.notes}
                      </div>
                    )}
                    <div className="text-xs text-stone-400 mt-2">
                      작성: {ap?.nickname || '-'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedLog && (
          <div className="flex-1 bg-white rounded-md p-6 border border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedId(null)}
                className="text-sm text-stone-500"
              >
                ← 목록
              </button>
              <div className="flex gap-2">
                {selectedLog.admin_id === profile.id && (
                  <button
                    onClick={() => { setEditingLog(selectedLog); setShowForm(true); }}
                    className="text-sm text-stone-600 hover:text-stone-900"
                  >
                    수정
                  </button>
                )}
                {(selectedLog.admin_id === profile.id || isSuperAdmin) && (
                  <button
                    onClick={() => handleDelete(selectedLog.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs text-stone-500 mb-1">대상</div>
                <div className="font-medium" style={{ color: '#9B5E45' }}>
                  {profileMap[selectedLog.user_id]?.nickname || '(알 수 없음)'}
                </div>
                <div className="text-xs text-stone-500">
                  {profileMap[selectedLog.user_id]?.gu || ''}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-stone-500 mb-1">유형</div>
                  <div>{CALL_TYPE_ICONS[selectedLog.call_type]} {CALL_TYPE_LABELS[selectedLog.call_type]}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 mb-1">통화 시간</div>
                  <div>{selectedLog.duration_minutes ? `${selectedLog.duration_minutes}분` : '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-stone-500 mb-1">일시</div>
                <div>{new Date(selectedLog.occurred_at).toLocaleString('ko-KR')}</div>
              </div>

              <div>
                <div className="text-xs text-stone-500 mb-1">메모</div>
                <div className="whitespace-pre-wrap bg-stone-50 p-3 rounded text-stone-700">
                  {selectedLog.notes || '-'}
                </div>
              </div>

              <div>
                <div className="text-xs text-stone-500 mb-1">후속 조치</div>
                <div className="whitespace-pre-wrap bg-stone-50 p-3 rounded text-stone-700">
                  {selectedLog.follow_up || '-'}
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 text-xs text-stone-400">
                <div>작성: {adminMap[selectedLog.admin_id]?.nickname || '-'} · {new Date(selectedLog.created_at).toLocaleString('ko-KR')}</div>
                {selectedLog.updated_at && selectedLog.updated_at !== selectedLog.created_at && (
                  <div>수정: {new Date(selectedLog.updated_at).toLocaleString('ko-KR')}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <CallLogForm
          editing={editingLog}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingLog(null); }}
        />
      )}
    </div>
  );
}

function CallLogForm({ editing, onSave, onCancel }) {
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [form, setForm] = useState({
    occurred_at: editing ? new Date(editing.occurred_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    duration_minutes: editing?.duration_minutes || '',
    call_type: editing?.call_type || 'phone',
    notes: editing?.notes || '',
    follow_up: editing?.follow_up || '',
  });

  useEffect(() => {
    if (editing?.user_id) {
      supabase
        .from('profiles')
        .select('id, nickname, gu')
        .eq('id', editing.user_id)
        .single()
        .then(({ data }) => {
          if (data) setSelectedUser(data);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nickname, gu')
        .ilike('nickname', `%${userQuery}%`)
        .limit(10);
      setUserResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedUser?.id) {
      alert('대상 사용자를 선택해주세요.');
      return;
    }
    onSave({
      user_id: selectedUser.id,
      occurred_at: new Date(form.occurred_at).toISOString(),
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      call_type: form.call_type,
      notes: form.notes,
      follow_up: form.follow_up,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-auto"
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#9B5E45' }}>
          {editing ? '통화 기록 수정' : '새 통화 기록'}
        </h3>

        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-stone-600 mb-1">대상 사용자</label>
            {selectedUser ? (
              <div className="flex items-center justify-between p-2 bg-stone-50 rounded">
                <span>
                  {selectedUser.nickname}
                  {selectedUser.gu && <span className="text-xs text-stone-500 ml-2">{selectedUser.gu}</span>}
                </span>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setUserQuery(''); }}
                    className="text-xs text-stone-500"
                  >
                    변경
                  </button>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="닉네임으로 검색"
                  className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
                />
                {userResults.length > 0 && (
                  <div className="mt-1 border border-stone-200 rounded max-h-40 overflow-auto">
                    {userResults.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUser(u); setUserResults([]); setUserQuery(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-stone-50 text-sm border-b border-stone-100 last:border-b-0"
                      >
                        {u.nickname}
                        {u.gu && <span className="text-xs text-stone-500 ml-2">{u.gu}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-600 mb-1">통화 유형</label>
              <select
                value={form.call_type}
                onChange={(e) => setForm({ ...form, call_type: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
              >
                <option value="in_person">대면</option>
                <option value="phone">유선</option>
                <option value="video">화상</option>
                <option value="other">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-600 mb-1">통화 시간 (분)</label>
              <input
                type="number"
                min="0"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-stone-600 mb-1">일시</label>
            <input
              type="datetime-local"
              value={form.occurred_at}
              onChange={(e) => setForm({ ...form, occurred_at: e.target.value })}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-600 mb-1">메모</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              placeholder="통화 내용, 사용자 상태 등"
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-600 mb-1">후속 조치</label>
            <textarea
              value={form.follow_up}
              onChange={(e) => setForm({ ...form, follow_up: e.target.value })}
              rows={3}
              placeholder="재통화 일정, 위기 알림 연계 등"
              className="w-full px-3 py-2 border border-stone-300 rounded text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 text-sm text-stone-600 border border-stone-300 rounded"
          >
            취소
          </button>
          <button
            type="submit"
            className="flex-1 py-2 text-sm text-white rounded"
            style={{ backgroundColor: '#7B9472' }}
          >
            저장
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export default function CrisisAlerts({ profile, isSuperAdmin = false }) {
  const [signals, setSignals] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [guFilter, setGuFilter] = useState('all');

  const fetchSignals = async () => {
    const { data: rows, error } = await supabase
      .from('crisis_signals')
      .select('id, user_id, detected_at, keywords, context, action_taken, status, handled_by, handled_at')
      .order('detected_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('crisis_signals 로드 실패:', error);
      setLoading(false);
      return;
    }

    setSignals(rows || []);

    // 관련 profiles 따로 로드
    const userIds = [...new Set((rows || []).map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, nickname, gu, verified_at')
        .in('id', userIds);

      const map = {};
      (profs || []).forEach(p => { map[p.id] = p; });
      setProfileMap(map);
    } else {
      setProfileMap({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();

    const channel = supabase
      .channel(`crisis_signals_${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'crisis_signals' },
        () => fetchSignals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자치구 목록 (super_admin 필터 칩용)
  const guList = useMemo(() => {
    const set = new Set(
      Object.values(profileMap).map(p => p.gu).filter(Boolean)
    );
    return Array.from(set).sort();
  }, [profileMap]);

  // 필터링
  const filtered = useMemo(() => {
    return signals.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (isSuperAdmin && guFilter !== 'all') {
        const p = profileMap[s.user_id];
        if (!p || p.gu !== guFilter) return false;
      }
      return true;
    });
  }, [signals, profileMap, statusFilter, guFilter, isSuperAdmin]);

  // 미처리 카운트 (상단 표시용)
  const pendingCount = useMemo(
    () => signals.filter(s => s.status === 'pending').length,
    [signals]
  );

  // 상태 업데이트
  const updateStatus = async (id, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'pending') {
      updates.handled_by = null;
      updates.handled_at = null;
    } else {
      updates.handled_by = profile.id;
      updates.handled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('crisis_signals')
      .update(updates)
      .eq('id', id);

    if (error) {
      alert('상태 변경 실패: ' + error.message);
      return;
    }
    fetchSignals();
  };

  // 메모 저장
  const saveMemo = async (id, memo) => {
    const { error } = await supabase
      .from('crisis_signals')
      .update({ action_taken: memo || null })
      .eq('id', id);

    if (error) {
      alert('메모 저장 실패: ' + error.message);
      return;
    }
    fetchSignals();
  };

  const selected = signals.find(s => s.id === selectedId);
  const selectedProfile = selected ? profileMap[selected.user_id] : null;

  return (
    <div className="flex h-full">
      {/* 좌측 — 목록 */}
      <div className="w-96 border-r border-stone-200 flex flex-col">
        <div className="p-5 border-b border-stone-200">
          <h2 className="text-lg font-semibold" style={{ color: '#9B5E45' }}>
            위기 알림
            {pendingCount > 0 && (
              <span
                className="ml-2 inline-flex items-center justify-center text-xs font-semibold rounded-full px-2 py-0.5"
                style={{ backgroundColor: '#DC2626', color: '#fff' }}
              >
                {pendingCount}
              </span>
            )}
          </h2>

          <div className="flex flex-wrap gap-1 mt-3 text-xs">
            {[
              { v: 'all', label: '전체' },
              { v: 'pending', label: '미처리' },
              { v: 'in_progress', label: '처리 중' },
              { v: 'resolved', label: '완료' },
            ].map(f => (
              <button
                key={f.v}
                onClick={() => setStatusFilter(f.v)}
                className="px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  backgroundColor: statusFilter === f.v ? '#9B5E45' : 'transparent',
                  color: statusFilter === f.v ? '#fff' : '#57534E',
                  borderColor: statusFilter === f.v ? '#9B5E45' : '#E7E5E4',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {isSuperAdmin && guList.length > 0 && (
            <select
              value={guFilter}
              onChange={(e) => setGuFilter(e.target.value)}
              className="mt-2 w-full text-xs px-2 py-1.5 border border-stone-200 rounded"
              style={{ color: '#57534E' }}
            >
              <option value="all">전체 자치구</option>
              {guList.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {loading && (
            <p className="p-5 text-sm text-stone-500">로딩 중...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="p-5 text-sm text-stone-500">표시할 위기 알림이 없어요.</p>
          )}
          {!loading && filtered.map(s => {
            const statusInfo = {
              pending: { color: '#DC2626', label: '미처리' },
              in_progress: { color: '#D97706', label: '처리 중' },
              resolved: { color: '#16A34A', label: '완료' },
            }[s.status] || { color: '#57534E', label: s.status };

            const isSelected = s.id === selectedId;
            const userProfile = profileMap[s.user_id];

            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className="block w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors"
                style={{
                  backgroundColor: isSelected ? '#F0EBE3' : 'transparent',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium flex items-center gap-1" style={{ color: statusInfo.color }}>
                    <span style={{ fontSize: '8px' }}>●</span>
                    {statusInfo.label}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(s.detected_at).toLocaleString('ko-KR', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium" style={{ color: '#1A100A' }}>
                  {userProfile?.nickname || '(닉네임 없음)'}
                  {isSuperAdmin && userProfile?.gu && (
                    <span className="text-stone-400 font-normal"> · {userProfile.gu}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-stone-500 truncate">
                  {(s.keywords || []).join(', ')}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 우측 — 상세 */}
      <div className="flex-1 overflow-auto">
        {!selected && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-stone-400">
              좌측에서 항목을 선택해주세요.
            </p>
          </div>
        )}
        {selected && (
          <CrisisDetail
            key={selected.id}
            signal={selected}
            userProfile={selectedProfile}
            onUpdateStatus={updateStatus}
            onSaveMemo={saveMemo}
          />
        )}
      </div>
    </div>
  );
}

function CrisisDetail({ signal, userProfile, onUpdateStatus, onSaveMemo }) {
  const [memo, setMemo] = useState(signal.action_taken || '');
  const [savingMemo, setSavingMemo] = useState(false);

  useEffect(() => {
    setMemo(signal.action_taken || '');
  }, [signal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveMemo = async () => {
    setSavingMemo(true);
    await onSaveMemo(signal.id, memo);
    setSavingMemo(false);
  };

  const memoChanged = memo !== (signal.action_taken || '');

  return (
    <div className="p-8 max-w-2xl">
      <h3 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>
        위기 신호 상세
      </h3>

      <div className="mt-6 space-y-4">
        <Field label="사용자">
          {userProfile?.nickname || '(닉네임 없음)'}
        </Field>
        <Field label="자치구">
          {userProfile?.gu || '미지정'}
        </Field>
        <Field label="발급번호 연결">
          {userProfile?.verified_at ? '예' : '아니오'}
        </Field>
        <Field label="감지 키워드">
          {(signal.keywords || []).join(', ')}
        </Field>
        <Field label="발생 시각">
          {new Date(signal.detected_at).toLocaleString('ko-KR')}
        </Field>
        <Field label="메시지 컨텍스트">
          <div className="bg-stone-50 p-3 rounded text-sm whitespace-pre-wrap">
            {signal.context || '(없음)'}
          </div>
        </Field>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-xs font-medium text-stone-500 mb-2">처리 상태</p>
          <div className="flex gap-2">
            {[
              { v: 'pending', label: '미처리', color: '#DC2626' },
              { v: 'in_progress', label: '처리 중', color: '#D97706' },
              { v: 'resolved', label: '완료', color: '#16A34A' },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => onUpdateStatus(signal.id, s.v)}
                className="px-3 py-1.5 text-sm rounded border transition-colors"
                style={{
                  backgroundColor: signal.status === s.v ? s.color : '#fff',
                  color: signal.status === s.v ? '#fff' : s.color,
                  borderColor: s.color,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-xs font-medium text-stone-500 mb-2">처리 메모</p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={4}
            placeholder="어떤 조치를 했는지 적어주세요 (예: 109 안내, 비상연락처 연락 등)"
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded resize-none focus:outline-none focus:border-stone-400"
          />
          <button
            onClick={handleSaveMemo}
            disabled={savingMemo || !memoChanged}
            className="mt-2 px-4 py-1.5 text-sm rounded text-white transition-opacity"
            style={{
              backgroundColor: '#9B5E45',
              opacity: savingMemo || !memoChanged ? 0.4 : 1,
            }}
          >
            {savingMemo ? '저장 중...' : '메모 저장'}
          </button>
        </div>

        {signal.handled_at && (
          <div className="pt-4 border-t border-stone-200 text-xs text-stone-500">
            마지막 처리: {new Date(signal.handled_at).toLocaleString('ko-KR')}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-500 mb-1">{label}</p>
      <div className="text-sm" style={{ color: '#1A100A' }}>{children}</div>
    </div>
  );
}

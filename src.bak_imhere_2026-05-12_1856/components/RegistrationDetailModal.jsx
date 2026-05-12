import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

function StatusBadge({ status }) {
  if (status === 'linked') {
    return (
      <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: '#7B9472' }}>
        연결됨
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="text-xs px-2 py-0.5 rounded bg-stone-200 text-stone-700">대기</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-400">해제</span>;
}

const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

function Field({ label, children }) {
  return (
    <div className="flex py-2 border-b border-stone-100 last:border-b-0">
      <div className="w-28 text-xs text-stone-500 pt-0.5">{label}</div>
      <div className="flex-1 text-sm text-stone-800">{children}</div>
    </div>
  );
}

export default function RegistrationDetailModal({ registration, onClose }) {
  const [issuerNickname, setIssuerNickname] = useState(null);
  const [linkedNickname, setLinkedNickname] = useState(null);

  useEffect(() => {
    const ids = [];
    if (registration.issued_by) ids.push(registration.issued_by);
    if (registration.linked_user_id) ids.push(registration.linked_user_id);
    if (ids.length === 0) return;

    supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', ids)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(p => { map[p.id] = p.nickname; });
        setIssuerNickname(map[registration.issued_by] || null);
        if (registration.linked_user_id) {
          setLinkedNickname(map[registration.linked_user_id] || null);
        }
      });
  }, [registration.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold" style={{ color: '#9B5E45' }}>발급번호 상세</h3>
        <p className="text-xs text-stone-500 mb-4 font-mono">{registration.gov_assigned_id}</p>

        <div className="bg-stone-50 rounded p-3 mb-4">
          <Field label="자치구">{registration.gu}</Field>
          <Field label="이름">{registration.real_name}</Field>
          <Field label="전화">{registration.phone}</Field>
          <Field label="주소">{registration.address}</Field>
        </div>

        <div className="bg-stone-50 rounded p-3 mb-4">
          <Field label="발행일">{formatDateTime(registration.issued_at)}</Field>
          <Field label="발행자">{issuerNickname || '—'}</Field>
          <Field label="status"><StatusBadge status={registration.status} /></Field>
          <Field label="연결된 사용자">
            {registration.linked_user_id
              ? (linkedNickname || '—')
              : <span className="text-stone-400">미연결</span>}
          </Field>
          {registration.linked_at && (
            <Field label="연결일">{formatDateTime(registration.linked_at)}</Field>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

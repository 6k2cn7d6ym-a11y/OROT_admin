import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SEOUL_GU } from '../../lib/constants';
import RegistrationDetailModal from './RegistrationDetailModal';

const STATUS_ORDER = { pending: 0, linked: 1, inactive: 2 };

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

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
};

export default function Registrations() {
  const [gu, setGu] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [registrations, setRegistrations] = useState([]);
  const [linkedUserMap, setLinkedUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [detail, setDetail] = useState(null);

  const fetchList = async () => {
    setLoading(true);
    setListError('');

    const { data, error } = await supabase
      .from('district_registrations')
      .select('*')
      .order('issued_at', { ascending: false });

    if (error) {
      setListError(error.message);
      setLoading(false);
      return;
    }

    setRegistrations(data || []);

    const linkedIds = (data || []).filter(r => r.linked_user_id).map(r => r.linked_user_id);
    if (linkedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .in('id', linkedIds);
      const map = {};
      (profiles || []).forEach(p => { map[p.id] = p.nickname; });
      setLinkedUserMap(map);
    } else {
      setLinkedUserMap({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    const { data, error } = await supabase.rpc('create_district_registration', {
      gu_input: gu,
      real_name_input: name,
      phone_input: phone,
      address_input: address,
    });

    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    const newRow = Array.isArray(data) ? data[0] : data;
    const govId = newRow?.gov_assigned_id || '';

    setGu('');
    setName('');
    setPhone('');
    setAddress('');
    setSubmitting(false);
    alert(`발급번호 박힘: ${govId}`);
    fetchList();
  };

  const sorted = [...registrations].sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (diff !== 0) return diff;
    return new Date(b.issued_at) - new Date(a.issued_at);
  });

  return (
    <div className="px-8 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>발급번호</h2>
        <p className="text-sm text-stone-600 mt-1">자치구 발급번호 발행·관리</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-5 border border-stone-200 mb-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#9B5E45' }}>발급번호 발행</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1 text-stone-700">자치구</label>
            <select
              value={gu}
              onChange={(e) => setGu(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500 bg-white"
            >
              <option value="">선택해줘</option>
              {SEOUL_GU.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-stone-700">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-stone-700">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="010-0000-0000"
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 text-stone-700">주소</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
            />
          </div>
        </div>

        {submitError && <p className="text-sm text-red-600 mb-3">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: '#9B5E45' }}
        >
          {submitting ? '발행 중...' : '발행'}
        </button>
      </form>

      <div className="mb-3">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          발급번호 목록 ({registrations.length}건)
        </h3>
      </div>

      {listError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {listError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">로딩 결...</p>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-lg p-6 border border-stone-200 text-sm text-stone-500">
          박힌 발급번호 X
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">자치구</th>
                <th className="text-left px-4 py-3 font-medium">발급번호</th>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">status</th>
                <th className="text-left px-4 py-3 font-medium">발행일</th>
                <th className="text-left px-4 py-3 font-medium">연결된 사용자</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setDetail(r)}
                  className="border-t border-stone-200 hover:bg-stone-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-stone-700">{r.gu}</td>
                  <td className="px-4 py-3 text-stone-800 font-mono text-xs">{r.gov_assigned_id}</td>
                  <td className="px-4 py-3 text-stone-700">{r.real_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-stone-600">{formatDate(r.issued_at)}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {r.linked_user_id
                      ? (linkedUserMap[r.linked_user_id] || '—')
                      : <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <RegistrationDetailModal
          registration={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

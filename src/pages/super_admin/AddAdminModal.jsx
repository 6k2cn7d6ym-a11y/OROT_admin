import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SEOUL_GU, CLINICAL_ROLE_OPTIONS } from '../../lib/constants';

export default function AddAdminModal({ onClose, onSaved }) {
  const [step, setStep] = useState('search');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState(null);

  const [adminType, setAdminType] = useState('general');
  const [assignedGu, setAssignedGu] = useState('');
  const [clinicalRole, setClinicalRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setSearchError('');
    const { data, error } = await supabase.rpc('find_user_by_email', { email_input: email });
    if (error) {
      setSearchError(error.message);
    } else if (!data || data.length === 0) {
      setSearchError('이 이메일 결로 가입한 사용자 X');
    } else {
      const user = data[0];
      if (user.role === 'admin' || user.role === 'super_admin') {
        setSearchError('이미 admin 결인 사용자');
      } else {
        setFoundUser(user);
        setStep('configure');
      }
    }
    setSearching(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    const updates = {
      role: 'admin',
      admin_type: adminType,
      assigned_gu: adminType === 'district' ? assignedGu : null,
      clinical_role: clinicalRole || null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', foundUser.id);
    if (error) {
      setSaveError(error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  const canSave = adminType === 'general' || (adminType === 'district' && assignedGu);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#9B5E45' }}>
          admin 추가
        </h3>

        {step === 'search' && (
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm mb-1 text-stone-700">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
              />
              <p className="text-xs text-stone-500 mt-1">
                OROT_app 결로 가입한 사용자만 admin 결로 박을 수 있어
              </p>
            </div>

            {searchError && <p className="text-sm text-red-600">{searchError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#9B5E45' }}
              >
                {searching ? '검색 중...' : '검색'}
              </button>
            </div>
          </form>
        )}

        {step === 'configure' && foundUser && (
          <div className="space-y-4">
            <div className="bg-stone-50 rounded p-3 text-sm">
              <div className="font-medium text-stone-700">
                {foundUser.nickname || '(닉네임 X)'}
              </div>
              <div className="text-stone-500 text-xs mt-0.5">{foundUser.email}</div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-stone-700">admin_type</label>
              <div className="flex flex-col gap-2">
                {['general', 'district'].map(t => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="admin_type"
                      checked={adminType === t}
                      onChange={() => setAdminType(t)}
                    />
                    <span>
                      {t === 'general' ? 'general — 일반 운영자' : 'district — 자치구'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {adminType === 'district' && (
              <div>
                <label className="block text-sm mb-1 text-stone-700">자치구</label>
                <select
                  value={assignedGu}
                  onChange={(e) => setAssignedGu(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
                >
                  <option value="">선택해줘</option>
                  {SEOUL_GU.map(gu => <option key={gu} value={gu}>{gu}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm mb-1 text-stone-700">자격 (clinical_role)</label>
              <select
                value={clinicalRole}
                onChange={(e) => setClinicalRole(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:border-stone-500"
              >
                {CLINICAL_ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('search')}
                className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
              >
                뒤로
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !canSave}
                className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
                style={{ backgroundColor: '#9B5E45' }}
              >
                {saving ? '박는 중...' : 'admin 박기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

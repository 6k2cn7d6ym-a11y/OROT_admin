import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SEOUL_GU, CLINICAL_ROLE_OPTIONS } from '../../lib/constants';

export default function EditAdminModal({ admin, onClose, onSaved }) {
  const [adminType, setAdminType] = useState(admin.admin_type || 'general');
  const [assignedGu, setAssignedGu] = useState(admin.assigned_gu || '');
  const [clinicalRole, setClinicalRole] = useState(admin.clinical_role || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    const updates = {
      admin_type: adminType,
      assigned_gu: adminType === 'district' ? assignedGu : null,
      clinical_role: clinicalRole || null,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', admin.id);
    if (error) {
      setSaveError(error.message);
      setSaving(false);
    } else {
      onSaved();
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setSaveError('');
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'user',
        admin_type: null,
        assigned_gu: null,
        clinical_role: null,
      })
      .eq('id', admin.id);
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
        <h3 className="text-lg font-semibold" style={{ color: '#9B5E45' }}>admin 갈음</h3>
        <p className="text-xs text-stone-500 mb-4">{admin.email}</p>

        <div className="space-y-4">
          <div className="bg-stone-50 rounded p-3 text-sm">
            <div className="font-medium text-stone-700">{admin.nickname || '(닉네임 X)'}</div>
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
              onClick={onClose}
              className="px-4 py-2 text-sm text-stone-600 hover:text-stone-900"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: '#9B5E45' }}
            >
              {saving ? '박는 중...' : '저장'}
            </button>
          </div>

          <div className="border-t border-stone-200 pt-4 mt-4">
            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="text-sm text-red-600 hover:text-red-800"
              >
                admin 결 빼기
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2">
                <p className="text-sm text-red-800">
                  진짜 박을래? role 결 'user'로 갈음 박힘.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="px-3 py-1.5 text-sm text-stone-600"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={saving}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded disabled:opacity-50"
                  >
                    {saving ? '...' : '빼기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

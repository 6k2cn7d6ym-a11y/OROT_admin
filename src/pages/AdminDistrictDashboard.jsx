import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function DistrictStub() {
  return (
    <div className="bg-white rounded-lg p-6 border-l-4" style={{ borderLeftColor: '#7B9472' }}>
      <h2 className="text-lg font-medium mb-2" style={{ color: '#9B5E45' }}>
        AdminDistrictDashboard 결
      </h2>
      <p className="text-sm text-stone-600">
        Phase 5·6에서 박을 결 — 발급번호 발행, 연결자 모니터링, 양방향 채팅, 시간 결.
      </p>
    </div>
  );
}

export default function AdminDistrictDashboard({ profile }) {
  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF7F2' }}>
      <header className="border-b border-stone-200 bg-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="font-semibold" style={{ color: '#9B5E45' }}>
            오롯 — 자치구 운영자 ({profile.assigned_gu || '미지정'})
          </h1>
          <p className="text-xs text-stone-500">
            {profile.nickname}
            {profile.clinical_role && ` · ${profile.clinical_role}`}
          </p>
        </div>
        <button onClick={handleLogout} className="text-sm text-stone-600 hover:text-stone-900">
          로그아웃
        </button>
      </header>

      <main className="px-6 py-8 max-w-4xl mx-auto">
        <Routes>
          <Route index element={<DistrictStub />} />
          <Route path="*" element={<Navigate to="/admin_district" replace />} />
        </Routes>
      </main>
    </div>
  );
}

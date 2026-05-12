import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Registrations from './admin_district/Registrations';
import Chats from './admin_district/Chats';
import CrisisAlerts from '../components/CrisisAlerts';

const TABS = [
  { to: '/admin_district/registrations', label: '발급번호' },
  { to: '/admin_district/chats', label: '채팅' },
  { to: '/admin_district/crisis', label: '위기 알림' },
];

export default function AdminDistrictDashboard({ profile }) {
  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAF7F2' }}>
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-5 py-5 border-b border-stone-200">
          <h1 className="font-semibold" style={{ color: '#9B5E45' }}>IMHERE 자치구 운영자</h1>
          <p className="text-xs text-stone-500 mt-1">
            {profile.nickname} · {profile.assigned_gu || '자치구 미지정'}
          </p>
          {profile.clinical_role && (
            <p className="text-xs text-stone-400 mt-0.5">{profile.clinical_role}</p>
          )}
        </div>

        <nav className="flex-1 py-4">
          {TABS.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              className="block w-full text-left px-5 py-2.5 text-sm transition-colors"
              style={({ isActive }) => ({
                backgroundColor: isActive ? '#F0EBE3' : 'transparent',
                color: isActive ? '#9B5E45' : '#57534E',
                borderLeft: isActive ? '3px solid #7B9472' : '3px solid transparent',
                fontWeight: isActive ? 500 : 400,
              })}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="m-4 text-sm text-stone-600 hover:text-stone-900 py-2 border-t border-stone-200 pt-4"
        >
          로그아웃
        </button>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route index element={<Navigate to="registrations" replace />} />
          <Route path="registrations" element={<Registrations profile={profile} />} />
          <Route path="chats" element={<Chats profile={profile} />} />
          <Route path="crisis" element={<CrisisAlerts profile={profile} isSuperAdmin={false} />} />
          <Route path="*" element={<Navigate to="registrations" replace />} />
        </Routes>
      </main>
    </div>
  );
}

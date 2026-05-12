import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AdminManagement from './super_admin/AdminManagement';
import Users from './super_admin/Users';
import UserDetail from './super_admin/UserDetail';
import Registrations from './super_admin/Registrations';
import StatsStub from './super_admin/StatsStub';

const TABS = [
  { to: '/super_admin/admins', label: 'admin 관리' },
  { to: '/super_admin/registrations', label: '발급번호' },
  { to: '/super_admin/users', label: '사용자' },
  { to: '/super_admin/stats', label: '통계' },
];

export default function SuperAdminDashboard({ profile }) {
  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#FAF7F2' }}>
      <aside className="w-56 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-5 py-5 border-b border-stone-200">
          <h1 className="font-semibold" style={{ color: '#9B5E45' }}>오롯 운영자</h1>
          <p className="text-xs text-stone-500 mt-1">
            {profile.nickname} · super_admin
          </p>
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
          <Route index element={<Navigate to="admins" replace />} />
          <Route path="admins" element={<AdminManagement />} />
          <Route path="registrations" element={<Registrations />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:userId" element={<UserDetail />} />
          <Route path="stats" element={<StatsStub />} />
          <Route path="*" element={<Navigate to="admins" replace />} />
        </Routes>
      </main>
    </div>
  );
}

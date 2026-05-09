import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminGeneralDashboard from './pages/AdminGeneralDashboard';
import AdminDistrictDashboard from './pages/AdminDistrictDashboard';
import Forbidden from './pages/Forbidden';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase
      .from('profiles')
      .select('role, admin_type, nickname, assigned_gu, clinical_role')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('profile fetch error:', error);
          setProfile(null);
        } else {
          setProfile(data);
        }
        setLoading(false);
      });
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FAF7F2' }}>
        <p style={{ color: '#9B5E45' }}>로딩 결...</p>
      </div>
    );
  }

  const isSuperAdmin = profile?.role === 'super_admin';
  const isAdminGeneral = profile?.role === 'admin' && profile?.admin_type === 'general';
  const isAdminDistrict = profile?.role === 'admin' && profile?.admin_type === 'district';

  let defaultRoute = '/login';
  if (session) {
    if (isSuperAdmin) defaultRoute = '/super_admin/admins';
    else if (isAdminGeneral) defaultRoute = '/admin_general';
    else if (isAdminDistrict) defaultRoute = '/admin_district';
    else defaultRoute = '/forbidden';
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!session ? <Login /> : <Navigate to={defaultRoute} replace />}
        />
        <Route path="/forbidden" element={<Forbidden />} />
        <Route
          path="/super_admin/*"
          element={
            isSuperAdmin
              ? <SuperAdminDashboard profile={profile} />
              : <Navigate to={defaultRoute} replace />
          }
        />
        <Route
          path="/admin_general/*"
          element={
            isAdminGeneral
              ? <AdminGeneralDashboard profile={profile} />
              : <Navigate to={defaultRoute} replace />
          }
        />
        <Route
          path="/admin_district/*"
          element={
            isAdminDistrict
              ? <AdminDistrictDashboard profile={profile} />
              : <Navigate to={defaultRoute} replace />
          }
        />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

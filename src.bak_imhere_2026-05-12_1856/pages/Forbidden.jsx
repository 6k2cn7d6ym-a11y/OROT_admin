import { supabase } from '../lib/supabase';

export default function Forbidden() {
  const handleLogout = () => supabase.auth.signOut();

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF7F2' }}>
      <div className="w-full max-w-sm text-center bg-white p-6 rounded-lg border border-stone-200">
        <h1 className="text-lg font-semibold mb-2" style={{ color: '#9B5E45' }}>
          운영자 권한 없음
        </h1>
        <p className="text-sm text-stone-600 mb-6">
          이 페이지는 오롯 운영자만 접근할 수 있어요.
        </p>
        <button
          onClick={handleLogout}
          className="w-full py-2 rounded-md text-white font-medium"
          style={{ backgroundColor: '#9B5E45' }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}

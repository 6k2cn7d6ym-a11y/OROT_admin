import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function StatsStub() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingCrisis: 0,
    verifiedRate: 0,
  });
  const [guDistribution, setGuDistribution] = useState([]);

  const fetchStats = async () => {
    setLoading(true);

    try {
      // 1. 총 사용자 수
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 2. 활성 사용자 — 최근 7일 안에 메시지 보낸 사용자 (chat_messages role='user')
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: activeData } = await supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('role', 'user');

      const uniqueActiveUsers = new Set((activeData || []).map(m => m.user_id)).size;

      // 3. 미처리 위기 신호
      const { count: pendingCrisis } = await supabase
        .from('crisis_signals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 4. 발급번호 연결자 비율 — profiles.verified_at IS NOT NULL
      const { count: verifiedCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('verified_at', 'is', null);

      const verifiedRate = (totalUsers && totalUsers > 0)
        ? Math.round(((verifiedCount || 0) / totalUsers) * 100)
        : 0;

      setKpi({
        totalUsers: totalUsers || 0,
        activeUsers: uniqueActiveUsers,
        pendingCrisis: pendingCrisis || 0,
        verifiedRate,
      });

      // 5. 자치구별 사용자 분포
      const { data: profiles } = await supabase
        .from('profiles')
        .select('gu')
        .not('gu', 'is', null);

      const guCount = {};
      (profiles || []).forEach(p => {
        if (p.gu) guCount[p.gu] = (guCount[p.gu] || 0) + 1;
      });

      const guList = Object.entries(guCount)
        .map(([gu, count]) => ({ gu, count }))
        .sort((a, b) => b.count - a.count);

      setGuDistribution(guList);
    } catch (e) {
      console.error('통계 로드 실패:', e);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-stone-500">통계 로드 중...</p>
      </div>
    );
  }

  const maxCount = Math.max(...guDistribution.map(g => g.count), 1);

  return (
    <div className="p-8 max-w-5xl">
      <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>통계</h2>
      <p className="text-xs text-stone-500 mt-1">전체 자치구 · 실시간</p>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <KpiCard label="총 사용자" value={kpi.totalUsers} suffix="명" />
        <KpiCard
          label="활성 사용자"
          value={kpi.activeUsers}
          suffix="명"
          subtitle="최근 7일"
        />
        <KpiCard
          label="미처리 위기"
          value={kpi.pendingCrisis}
          suffix="건"
          color={kpi.pendingCrisis > 0 ? '#DC2626' : '#9B5E45'}
        />
        <KpiCard
          label="발급번호 연결자 비율"
          value={kpi.verifiedRate}
          suffix="%"
        />
      </div>

      {/* 자치구별 분포 */}
      <div className="mt-8 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          자치구별 사용자 분포
        </h3>

        {guDistribution.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">자치구 등록 사용자 없음.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {guDistribution.map(({ gu, count }) => (
              <div key={gu} className="flex items-center gap-3 text-sm">
                <span className="w-20 text-stone-700">{gu}</span>
                <div className="flex-1 bg-stone-100 rounded h-6 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${(count / maxCount) * 100}%`,
                      backgroundColor: '#9B5E45',
                    }}
                  />
                </div>
                <span className="w-12 text-right text-stone-600 tabular-nums">
                  {count}명
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        시계열 추이·발급번호 자치구별 상태는 다음 단계.
      </p>
    </div>
  );
}

function KpiCard({ label, value, suffix, subtitle, color = '#9B5E45' }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-5">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value.toLocaleString()}
        <span className="text-base ml-1 text-stone-500">{suffix}</span>
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-stone-400">{subtitle}</p>
      )}
    </div>
  );
}

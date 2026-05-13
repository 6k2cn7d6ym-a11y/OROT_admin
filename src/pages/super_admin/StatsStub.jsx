import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ResponsiveContainer, Cell, ZAxis,
} from 'recharts';

export default function StatsStub() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingCrisis: 0,
    verifiedRate: 0,
    totalSingleHouseholds: 0,
    overallCoverPer10k: 0,
  });
  const [guDistribution, setGuDistribution] = useState([]);
  const [guCompare, setGuCompare] = useState([]);
  const [scatterData, setScatterData] = useState([]);

  const fetchStats = async () => {
    setLoading(true);

    try {
      // === 기존 KPI 4개 ===
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: activeData } = await supabase
        .from('chat_messages')
        .select('user_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('role', 'user');

      const uniqueActiveUsers = new Set((activeData || []).map(m => m.user_id)).size;

      const { count: pendingCrisis } = await supabase
        .from('crisis_signals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: verifiedCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('verified_at', 'is', null);

      const verifiedRate = (totalUsers && totalUsers > 0)
        ? Math.round(((verifiedCount || 0) / totalUsers) * 100)
        : 0;

      // === 자치구별 1인가구 자료 ===
      const { data: shData } = await supabase
        .from('single_households')
        .select('gu, households')
        .eq('year', 2024)
        .eq('age_range', '합계')
        .eq('gender', '계');

      const guToHouseholds = {};
      let totalSH = 0;
      (shData || []).forEach(r => {
        guToHouseholds[r.gu] = r.households;
        totalSH += r.households;
      });

      // === IMHERE 가입자 자치구별 ===
      const { data: profiles } = await supabase
        .from('profiles')
        .select('gu, id')
        .not('gu', 'is', null);

      const guToUsers = {};
      const userIdToGu = {};
      (profiles || []).forEach(p => {
        if (p.gu) {
          guToUsers[p.gu] = (guToUsers[p.gu] || 0) + 1;
          userIdToGu[p.id] = p.gu;
        }
      });

      // === 자치구별 위기 신호 ===
      const { data: crisisData } = await supabase
        .from('crisis_signals')
        .select('user_id');

      const guToCrisis = {};
      (crisisData || []).forEach(c => {
        const gu = userIdToGu[c.user_id];
        if (gu) guToCrisis[gu] = (guToCrisis[gu] || 0) + 1;
      });

      // === 전체 cover율 (per 10,000 결로) ===
      const totalImhereUsers = Object.values(guToUsers).reduce((a, b) => a + b, 0);
      const overallCoverPer10k = totalSH > 0
        ? ((totalImhereUsers / totalSH) * 10000).toFixed(2)
        : 0;

      setKpi({
        totalUsers: totalUsers || 0,
        activeUsers: uniqueActiveUsers,
        pendingCrisis: pendingCrisis || 0,
        verifiedRate,
        totalSingleHouseholds: totalSH,
        overallCoverPer10k,
      });

      // 자치구별 사용자 분포 (기존)
      const guList = Object.entries(guToUsers)
        .map(([gu, count]) => ({ gu, count }))
        .sort((a, b) => b.count - a.count);
      setGuDistribution(guList);

      // 차트 2: 자치구별 1인가구 vs IMHERE 가입자
      const allGus = Object.keys(guToHouseholds).sort();
      const compareData = allGus.map(gu => ({
        gu,
        singleHouseholds: guToHouseholds[gu] || 0,
        imhereUsers: guToUsers[gu] || 0,
      }));
      setGuCompare(compareData);

      // 차트 5: 산점도 — 1인가구 vs cover율
      const scatter = allGus
        .map(gu => {
          const sh = guToHouseholds[gu] || 0;
          const users = guToUsers[gu] || 0;
          const crisis = guToCrisis[gu] || 0;
          return {
            gu,
            singleHouseholds: sh,
            users,
            crisis,
            coverPer10k: sh > 0 ? (users / sh) * 10000 : 0,
          };
        })
        .filter(r => r.users > 0);
      setScatterData(scatter);

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
    <div className="p-8 max-w-6xl">
      <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>통계</h2>
      <p className="text-xs text-stone-500 mt-1">전체 자치구 · 실시간</p>

      {/* IMHERE 운영 KPI */}
      <h3 className="mt-6 text-xs font-semibold text-stone-500 uppercase tracking-wider">
        IMHERE 운영 현황
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <KpiCard label="총 사용자" value={kpi.totalUsers} suffix="명" />
        <KpiCard label="활성 사용자" value={kpi.activeUsers} suffix="명" subtitle="최근 7일" />
        <KpiCard
          label="미처리 위기"
          value={kpi.pendingCrisis}
          suffix="건"
          color={kpi.pendingCrisis > 0 ? '#DC2626' : '#9B5E45'}
        />
        <KpiCard label="발급번호 연결자 비율" value={kpi.verifiedRate} suffix="%" />
      </div>

      {/* 서울 1인가구 자료 KPI */}
      <h3 className="mt-6 text-xs font-semibold text-stone-500 uppercase tracking-wider">
        서울 1인가구 자료 (KOSIS 2024)
      </h3>
      <div className="grid grid-cols-2 gap-4 mt-2">
        <KpiCard
          label="서울 전체 1인가구"
          value={kpi.totalSingleHouseholds}
          suffix="가구"
          subtitle="2024년 인구주택총조사"
        />
        <KpiCard
          label="IMHERE cover율"
          value={kpi.overallCoverPer10k}
          suffix="명 / 1만가구"
          subtitle="1만 1인가구당 IMHERE 가입자"
        />
      </div>

      {/* 차트 2: 자치구별 1인가구 vs IMHERE 가입자 */}
      <div className="mt-8 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          자치구별 1인가구 수 vs IMHERE 가입자
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          서울 25개 자치구. 1인가구는 좌측 축, IMHERE 가입자는 우측 축.
        </p>
        <div className="mt-4" style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={guCompare} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis
                dataKey="gu"
                angle={-45}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 10, fill: '#57534E' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: '#9B5E45' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: '#7B9472' }}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E7E5E4' }}
                formatter={(value, name) => {
                  if (name === '1인가구') return [value.toLocaleString() + ' 가구', name];
                  return [value + ' 명', name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="singleHouseholds" name="1인가구" fill="#9B5E45" />
              <Bar yAxisId="right" dataKey="imhereUsers" name="IMHERE 가입자" fill="#7B9472" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 차트 5: 산점도 */}
      <div className="mt-6 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          1인가구 밀도 vs IMHERE cover율 (자치구별)
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          X축: 자치구 1인가구 수. Y축: 1만 1인가구당 IMHERE 가입자.
          점 크기는 누적 위기 신호 건수. 가입자 있는 자치구만 표시.
        </p>
        {scatterData.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">자료 없음.</p>
        ) : (
          <div className="mt-4" style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 30, left: 30, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                <XAxis
                  type="number"
                  dataKey="singleHouseholds"
                  name="1인가구"
                  tick={{ fontSize: 10, fill: '#57534E' }}
                />
                <YAxis
                  type="number"
                  dataKey="coverPer10k"
                  name="cover율"
                  tick={{ fontSize: 10, fill: '#57534E' }}
                />
                <ZAxis type="number" dataKey="crisis" range={[60, 400]} name="위기" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white p-2 border border-stone-200 rounded text-xs shadow-sm">
                        <div className="font-semibold mb-1" style={{ color: '#9B5E45' }}>{d.gu}</div>
                        <div>1인가구: {d.singleHouseholds.toLocaleString()} 가구</div>
                        <div>IMHERE: {d.users} 명</div>
                        <div>cover율: {d.coverPer10k.toFixed(2)} 명/1만가구</div>
                        <div>위기 신호: {d.crisis} 건</div>
                      </div>
                    );
                  }}
                />
                <Scatter name="자치구" data={scatterData} fill="#9B5E45">
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={entry.crisis > 0 ? '#DC2626' : '#9B5E45'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 text-xs text-stone-500">
          <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#9B5E45' }} />
          위기 신호 없음
          <span className="inline-block w-2 h-2 rounded-full ml-4 mr-1" style={{ backgroundColor: '#DC2626' }} />
          위기 신호 발생 (점 크기 = 건수)
        </div>
        <div className="mt-2 text-xs text-stone-400">
          <strong>해석:</strong> 우측 하단 (1인가구 많고 cover율 낮음) 자치구가 정책 타겟.
        </div>
      </div>

      {/* 자치구별 가입자 분포 (기존) */}
      <div className="mt-6 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          자치구별 IMHERE 가입자 분포
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
        자료 출처: KOSIS 인구주택총조사 (2024) · IMHERE 자체 자료
      </p>
    </div>
  );
}

function KpiCard({ label, value, suffix, subtitle, color = '#9B5E45' }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 p-5">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        <span className="text-base ml-1 text-stone-500">{suffix}</span>
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-stone-400">{subtitle}</p>
      )}
    </div>
  );
}

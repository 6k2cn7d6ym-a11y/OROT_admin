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
  const [isolationChartData, setIsolationChartData] = useState([]);

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

      const verifiedRate = totalUsers > 0
        ? Math.round(((verifiedCount || 0) / totalUsers) * 100)
        : 0;

      // === 1인가구 자료 (KOSIS) ===
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

      // === 고립 지수 (SKT 결합 자료) ===
      const { data: isolationData } = await supabase
        .from('gu_isolation')
        .select('gu, isolation_score, sh_estimated')
        .eq('period', '2025-12');

      const guToIsolation = {};
      (isolationData || []).forEach(r => {
        guToIsolation[r.gu] = {
          score: r.isolation_score,
          sh_skt: r.sh_estimated,
        };
      });

      // 고립 지수 막대 차트 자료 (내림차순)
      const isoChart = (isolationData || [])
        .map(r => ({ gu: r.gu, score: parseFloat(r.isolation_score) }))
        .sort((a, b) => b.score - a.score);
      setIsolationChartData(isoChart);

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

      // === 전체 KPI ===
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

      // 자치구별 사용자 분포
      const guList = Object.entries(guToUsers)
        .map(([gu, count]) => ({ gu, count }))
        .sort((a, b) => b.count - a.count);
      setGuDistribution(guList);

      // 차트 2: 자치구별 1인가구 vs IMHERE 가입자
      const allGus = Object.keys(guToHouseholds).sort();
      setGuCompare(allGus.map(gu => ({
        gu,
        singleHouseholds: guToHouseholds[gu] || 0,
        imhereUsers: guToUsers[gu] || 0,
      })));

      // 차트 5: 산점도 — 고립 지수 × cover율 (25개 자치구 모두)
      const scatter = allGus.map(gu => {
        const sh = guToHouseholds[gu] || 0;
        const users = guToUsers[gu] || 0;
        const crisis = guToCrisis[gu] || 0;
        const isolation = guToIsolation[gu]?.score || 0;
        const coverPer10k = sh > 0 ? (users / sh) * 10000 : 0;

        return {
          gu,
          isolationScore: isolation,
          coverPer10k: parseFloat(coverPer10k.toFixed(2)),
          singleHouseholds: sh,
          users,
          crisis,
          // 위험 분류: 고립 높고 cover 낮음 = 우선 타겟
          isPriority: isolation > 50 && coverPer10k < 1,
        };
      });
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
  const priorityGus = scatterData.filter(d => d.isPriority).sort((a, b) => b.isolationScore - a.isolationScore);

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

      {/* 1인가구 자료 KPI */}
      <h3 className="mt-6 text-xs font-semibold text-stone-500 uppercase tracking-wider">
        서울 1인가구 자료 (KOSIS 2024 + SKT 2025.12)
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
          갈색: 1인가구 수 (좌축). 초록: IMHERE 가입자 (우축).
        </p>
        <div className="mt-4" style={{ width: '100%', minWidth: 0, height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={guCompare} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="gu" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#57534E' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9B5E45' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#7B9472' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E7E5E4' }}
                formatter={(v, name) => name === '1인가구' ? [v.toLocaleString() + ' 가구', name] : [v + ' 명', name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="singleHouseholds" name="1인가구" fill="#9B5E45" />
              <Bar yAxisId="right" dataKey="imhereUsers" name="IMHERE 가입자" fill="#7B9472" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 고립 지수 막대 차트 */}
      <div className="mt-6 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          자치구별 사회적 고립 지수 (SKT 결합, 2025.12)
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          통화량·외출·이동횟수·요금연체·카카오톡 비사용 5개 지표 종합. 0~100 (높을수록 위험).
        </p>
        <div className="mt-4" style={{ width: '100%', minWidth: 0, height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={isolationChartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis dataKey="gu" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: '#57534E' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#57534E' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E7E5E4' }}
                formatter={(v) => [`${v} / 100`, '고립 지수']}
              />
              <Bar dataKey="score" name="고립 지수" radius={[3, 3, 0, 0]}>
                {isolationChartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.score >= 60 ? '#DC2626' : entry.score >= 40 ? '#9B5E45' : '#7B9472'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-stone-500">
          <span><span className="inline-block w-2 h-2 rounded-full mr-1 bg-red-500" />고위험 (60 이상)</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#9B5E45' }} />중위험 (40~59)</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#7B9472' }} />저위험 (40 미만)</span>
        </div>
      </div>

      {/* 차트 5: 고립 지수 × cover율 산점도 */}
      <div className="mt-6 bg-white rounded-lg border border-stone-200 p-6">
        <h3 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
          사회적 고립 위험 vs IMHERE cover율 (자치구별)
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          X축: 고립 지수 (SKT 통신 자료 기반 — 통화량·외출·연체·이동 종합). Y축: 1만 1인가구당 IMHERE 가입자.
          점 크기: 1인가구수. <span className="text-red-500 font-medium">빨간 점 = 정책 우선 타겟</span>.
        </p>
        <div className="mt-4" style={{ width: '100%', minWidth: 0, height: 420 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 40, left: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
              <XAxis
                type="number"
                dataKey="isolationScore"
                name="고립 지수"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#57534E' }}
                label={{ value: '← 안전          고립 지수          위험 →', position: 'bottom', offset: 20, style: { fontSize: 11, fill: '#57534E' } }}
              />
              <YAxis
                type="number"
                dataKey="coverPer10k"
                name="cover율"
                tick={{ fontSize: 10, fill: '#57534E' }}
                label={{ value: 'cover율 (명/1만가구)', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 11, fill: '#57534E' } }}
              />
              <ZAxis type="number" dataKey="singleHouseholds" range={[40, 500]} name="1인가구" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-stone-200 rounded text-xs shadow-sm">
                      <div className="font-semibold mb-1" style={{ color: d.isPriority ? '#DC2626' : '#9B5E45' }}>
                        {d.gu} {d.isPriority ? '⚠️ 정책 타겟' : ''}
                      </div>
                      <div>고립 지수: <strong>{d.isolationScore}</strong> / 100</div>
                      <div>cover율: <strong>{d.coverPer10k}</strong> 명/1만가구</div>
                      <div>1인가구: {d.singleHouseholds.toLocaleString()} 가구</div>
                      <div>IMHERE: {d.users} 명</div>
                      {d.crisis > 0 && <div className="text-red-500">위기 신호: {d.crisis} 건</div>}
                    </div>
                  );
                }}
              />
              <Scatter name="자치구" data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isPriority ? '#DC2626' : d.users > 0 ? '#7B9472' : '#D6CAB7'}
                    fillOpacity={d.users > 0 ? 0.85 : 0.45}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
          <span><span className="inline-block w-2 h-2 rounded-full mr-1 bg-red-500" />정책 우선 타겟 (고립 위험 + cover 부족)</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#7B9472' }} />IMHERE 가입자 있는 자치구</span>
          <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: '#D6CAB7' }} />아직 가입자 없는 자치구</span>
        </div>

        <div className="mt-2 p-3 bg-stone-50 rounded text-xs text-stone-600 leading-relaxed">
          <strong>해석:</strong> 우측 하단(고립 지수 높음 + cover율 낮음)이 진짜 정책 타겟.
          1인가구가 실제로 고립되어 있는데 IMHERE의 손길이 닿지 않는 자치구.
        </div>

        {/* 정책 타겟 자치구 목록 */}
        {priorityGus.length > 0 && (
          <div className="mt-4 border border-red-100 rounded p-3">
            <div className="text-xs font-semibold text-red-600 mb-2">⚠️ 우선 정책 타겟 자치구</div>
            <div className="flex flex-wrap gap-2">
              {priorityGus.map(d => (
                <span key={d.gu} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100">
                  {d.gu} (고립 {d.isolationScore})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 자치구별 가입자 분포 */}
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
                    className="h-full"
                    style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: '#9B5E45' }}
                  />
                </div>
                <span className="w-12 text-right text-stone-600 tabular-nums">{count}명</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-stone-400">
        자료 출처: KOSIS 인구주택총조사 (2024) · 서울 시민생활 데이터 SKT 결합 (2025.12) · IMHERE 자체 자료
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
      {subtitle && <p className="mt-1 text-xs text-stone-400">{subtitle}</p>}
    </div>
  );
}

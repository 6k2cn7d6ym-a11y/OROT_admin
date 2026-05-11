import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const dateKey = (d) => d.toISOString().slice(0, 10);

const buildLast30Days = () => {
  const days = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
};

const pad = (n) => String(n).padStart(2, '0');

const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

const formatDayWithWeekday = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
};

const formatWeekRange = (weekStartIso) => {
  if (!weekStartIso) return '—';
  const start = new Date(weekStartIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDate(start)} ~ ${formatDate(end)}`;
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [moodMap, setMoodMap] = useState({});
  const [dailySummaries, setDailySummaries] = useState([]);
  const [weeklySummaries, setWeeklySummaries] = useState([]);
  const [crises, setCrises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');

      const thirtyDaysAgoDate = dateKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const [profileRes, moodRes, dailyRes, weeklyRes, crisisRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, nickname, gu, created_at, last_active_at')
          .eq('id', userId)
          .single(),
        supabase
          .from('mood_logs')
          .select('date, mood_label')
          .eq('user_id', userId)
          .gte('date', thirtyDaysAgoDate)
          .order('date', { ascending: false }),
        supabase
          .from('daily_summaries')
          .select('id, date, summary, created_at')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(30),
        supabase
          .from('weekly_summaries')
          .select('id, week_start, summary, created_at')
          .eq('user_id', userId)
          .order('week_start', { ascending: false })
          .limit(8),
        supabase
          .from('crisis_signals')
          .select('id, detected_at, keywords, context, action_taken')
          .eq('user_id', userId)
          .order('detected_at', { ascending: false }),
      ]);

      if (profileRes.error) {
        setError(profileRes.error.message);
        setLoading(false);
        return;
      }

      setProfile(profileRes.data);

      const map = {};
      (moodRes.data || []).forEach((m) => { map[m.date] = m.mood_label; });
      setMoodMap(map);

      setDailySummaries(dailyRes.data || []);
      setWeeklySummaries(weeklyRes.data || []);
      setCrises(crisisRes.data || []);
      setLoading(false);
    };

    fetchAll();
  }, [userId]);

  if (loading) {
    return <div className="px-8 py-6 text-sm text-stone-500">로딩 중...</div>;
  }

  if (error || !profile) {
    return (
      <div className="px-8 py-6">
        <button onClick={() => navigate('/super_admin/users')} className="text-sm text-stone-600 hover:text-stone-900 mb-4">
          ← 사용자 목록
        </button>
        <p className="text-sm text-red-600">{error || '사용자를 찾을 수 없어요'}</p>
      </div>
    );
  }

  const days = buildLast30Days();

  return (
    <div className="px-8 py-6 max-w-4xl">
      <button
        onClick={() => navigate('/super_admin/users')}
        className="text-sm text-stone-600 hover:text-stone-900 mb-4"
      >
        ← 사용자 목록
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#9B5E45' }}>
          {profile.nickname || '(닉네임 X)'}
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          {profile.gu || '자치구 X'} · 가입 {formatDate(profile.created_at)}
          {profile.last_active_at && ` · 최근 활동 ${formatDate(profile.last_active_at)}`}
        </p>
      </div>

      <Section title="기분 캘린더 (30일)">
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const mood = moodMap[day];
            const dayNum = day.slice(8, 10);
            return (
              <div
                key={day}
                className="aspect-square rounded text-xs flex flex-col items-center justify-center p-1"
                style={{
                  backgroundColor: mood ? '#F0EBE3' : '#FAFAF9',
                  border: mood ? '1px solid #D6CFC2' : '1px solid #F0F0EE',
                  color: mood ? '#9B5E45' : '#A8A29E',
                }}
                title={`${day}${mood ? ` · ${mood}` : ''}`}
              >
                <div className="text-[10px] opacity-70">{dayNum}</div>
                {mood && <div className="text-[10px] mt-0.5 truncate w-full text-center">{mood}</div>}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-stone-500 mt-2">
          박힌 날 {Object.keys(moodMap).length}일 / 30일
        </p>
      </Section>

      <Section title={`매일 요약 (${dailySummaries.length}건)`}>
        {dailySummaries.length === 0 ? (
          <p className="text-sm text-stone-500">기록 없음</p>
        ) : (
          <div className="space-y-3">
            {dailySummaries.map((s) => (
              <div key={s.id} className="bg-stone-50 rounded p-3 text-sm">
                <div className="text-xs text-stone-500 mb-1">{formatDayWithWeekday(s.date)}</div>
                <div className="text-stone-700 whitespace-pre-wrap">{s.summary}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`주간 요약 (${weeklySummaries.length}건)`}>
        {weeklySummaries.length === 0 ? (
          <p className="text-sm text-stone-500">기록 없음</p>
        ) : (
          <div className="space-y-3">
            {weeklySummaries.map((s) => (
              <div key={s.id} className="bg-stone-50 rounded p-3 text-sm">
                <div className="text-xs text-stone-500 mb-1">{formatWeekRange(s.week_start)}</div>
                <div className="text-stone-700 whitespace-pre-wrap">{s.summary}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`위기 이력 (${crises.length}건)`}>
        {crises.length === 0 ? (
          <p className="text-sm text-stone-500">기록 없음</p>
        ) : (
          <div className="space-y-3">
            {crises.map((c) => (
              <div key={c.id} className="bg-red-50 border border-red-100 rounded p-3 text-sm">
                <div className="text-xs text-red-700 mb-1">{formatDateTime(c.detected_at)}</div>
                {c.keywords && c.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.keywords.map((k, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                {c.context && <div className="text-stone-700 text-xs">{c.context}</div>}
                {c.action_taken && (
                  <div className="text-stone-500 text-xs mt-1">대응: {c.action_taken}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="자원 카드 추천">
        <div className="border-2 border-dashed border-stone-300 rounded p-4 text-sm text-stone-500">
          Phase 4-A 끝에 박을 거 — 자원 카드 매칭·추천.
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6 bg-white rounded-lg p-5 border border-stone-200">
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#9B5E45' }}>{title}</h3>
      {children}
    </section>
  );
}

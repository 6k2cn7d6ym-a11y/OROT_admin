import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

export default function Chats({ profile }) {
  const myId = profile.id;

  const [connectors, setConnectors] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConnectors, setLoadingConnectors] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selectedUserId;
  }, [selectedUserId]);

  // 초기 로드 + realtime 구독
  useEffect(() => {
    if (!myId) return;

    let cancelled = false;
    let channel = null;

    (async () => {
      setLoadingConnectors(true);
      setError('');

      if (!profile?.assigned_gu) {
        setError('자치구가 지정되지 않았어요');
        setLoadingConnectors(false);
        return;
      }

      // 1. 자치구의 linked registrations 조회 (누가 발행했든 무관)
      const { data: regs, error: regErr } = await supabase
        .from('district_registrations')
        .select('id, gov_assigned_id, linked_user_id, linked_at')
        .eq('gu', profile.assigned_gu)
        .eq('status', 'linked');

      if (cancelled) return;
      if (regErr) {
        setError(regErr.message);
        setLoadingConnectors(false);
        return;
      }

      const userIds = (regs || []).filter(r => r.linked_user_id).map(r => r.linked_user_id);

      // 2. 닉네임 조회
      const profileMap = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nickname')
          .in('id', userIds);
        (profilesData || []).forEach(p => { profileMap[p.id] = p.nickname; });
      }

      if (cancelled) return;

      const list = (regs || [])
        .filter(r => r.linked_user_id)
        .map(r => ({
          registration_id: r.id,
          gov_assigned_id: r.gov_assigned_id,
          user_id: r.linked_user_id,
          nickname: profileMap[r.linked_user_id] || '(닉네임 없음)',
          linked_at: r.linked_at,
        }));

      setConnectors(list);

      // 3. 안 읽음 개수 조회
      if (userIds.length > 0) {
        const { data: unreadRows } = await supabase
          .from('district_chats')
          .select('sender_id')
          .eq('receiver_id', myId)
          .eq('is_invitation', false)
          .is('read_at', null)
          .in('sender_id', userIds);

        if (cancelled) return;

        const counts = {};
        (unreadRows || []).forEach(r => {
          counts[r.sender_id] = (counts[r.sender_id] || 0) + 1;
        });
        setUnreadMap(counts);
      }

      setLoadingConnectors(false);

      // 4. realtime 구독 — 나에게 오는 메시지
      channel = supabase
        .channel(`admin_chats:${myId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'district_chats',
          filter: `receiver_id=eq.${myId}`,
        }, async (payload) => {
          const msg = payload.new;
          if (!msg || msg.is_invitation) return;

          if (selectedRef.current === msg.sender_id) {
            // 현재 보고 있는 사용자의 메시지 → 즉시 표시 + read 처리
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            const now = new Date().toISOString();
            try {
              await supabase
                .from('district_chats')
                .update({ read_at: now })
                .eq('id', msg.id);
            } catch (e) {
              console.error('read 갱신 실패:', e);
            }
          } else {
            // 다른 사용자 메시지 → unread 카운트 증가
            setUnreadMap(prev => ({
              ...prev,
              [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
            }));
          }
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [myId]);

  // 사용자 선택 시 메시지 fetch + 안 읽음 read 처리
  useEffect(() => {
    if (!selectedUserId || !myId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingMessages(true);

      const { data, error: msgErr } = await supabase
        .from('district_chats')
        .select('*')
        .eq('is_invitation', false)
        .or(
          `and(sender_id.eq.${myId},receiver_id.eq.${selectedUserId}),` +
          `and(sender_id.eq.${selectedUserId},receiver_id.eq.${myId})`
        )
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (msgErr) {
        setError(msgErr.message);
        setLoadingMessages(false);
        return;
      }

      setMessages(data || []);
      setLoadingMessages(false);

      // 이 사용자에게서 온 안 읽음 메시지 일괄 read
      const hasUnread = (data || []).some(m => m.sender_id === selectedUserId && !m.read_at);
      if (hasUnread) {
        const now = new Date().toISOString();
        try {
          await supabase
            .from('district_chats')
            .update({ read_at: now })
            .eq('sender_id', selectedUserId)
            .eq('receiver_id', myId)
            .is('read_at', null);
          if (!cancelled) {
            setUnreadMap(prev => ({ ...prev, [selectedUserId]: 0 }));
          }
        } catch (e) {
          console.error('일괄 read 실패:', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedUserId, myId]);

  // 새 메시지 도착 시 bottom 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const content = inputText.trim();
    if (!content || !selectedUserId || sending) return;

    setSending(true);
    setError('');

    const { data, error: sendErr } = await supabase
      .from('district_chats')
      .insert({
        sender_id: myId,
        receiver_id: selectedUserId,
        content,
        is_invitation: false,
      })
      .select()
      .single();

    if (sendErr) {
      setError(sendErr.message);
      setSending(false);
      return;
    }

    setMessages(prev => {
      if (prev.some(m => m.id === data.id)) return prev;
      return [...prev, data];
    });
    setInputText('');
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const selectedConnector = useMemo(
    () => connectors.find(c => c.user_id === selectedUserId),
    [connectors, selectedUserId]
  );

  return (
    <div className="flex h-screen">
      {/* 좌측: 연결자 목록 */}
      <aside className="w-72 bg-white border-r border-stone-200 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-stone-200">
          <h2 className="text-sm font-semibold" style={{ color: '#9B5E45' }}>
            연결자 ({connectors.length}명)
          </h2>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingConnectors ? (
            <p className="text-sm text-stone-500 p-4">로딩 중...</p>
          ) : connectors.length === 0 ? (
            <p className="text-sm text-stone-500 p-4">연결된 사용자가 없어요</p>
          ) : (
            connectors.map(c => {
              const unread = unreadMap[c.user_id] || 0;
              const isActive = c.user_id === selectedUserId;
              return (
                <button
                  key={c.user_id}
                  onClick={() => setSelectedUserId(c.user_id)}
                  className="w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50 flex items-center justify-between"
                  style={{
                    backgroundColor: isActive ? '#F0EBE3' : 'transparent',
                    borderLeftWidth: '3px',
                    borderLeftStyle: 'solid',
                    borderLeftColor: isActive ? '#7B9472' : 'transparent',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-800 truncate">{c.nickname}</div>
                    <div className="text-xs text-stone-500 font-mono truncate">{c.gov_assigned_id}</div>
                  </div>
                  {unread > 0 && (
                    <span
                      className="ml-2 flex-shrink-0 text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#DC2626' }}
                    >
                      {unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* 우측: 채팅 패널 */}
      <section className="flex-1 flex flex-col bg-stone-50 overflow-hidden">
        {!selectedUserId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-stone-500">
            왼쪽에서 연결자를 선택해주세요
          </div>
        ) : (
          <>
            <header className="bg-white border-b border-stone-200 px-6 py-4">
              <h3 className="font-semibold text-stone-800">
                {selectedConnector?.nickname || ''}
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                {selectedConnector?.gov_assigned_id || ''}
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingMessages ? (
                <p className="text-sm text-stone-500 text-center">로딩 중...</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-stone-500 text-center mt-8">
                  대화가 없어요. 먼저 메시지를 보내보세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {messages.map(m => {
                    const isMine = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-md">
                          <div
                            className="px-4 py-2 rounded-lg text-sm whitespace-pre-wrap break-words"
                            style={{
                              backgroundColor: isMine ? '#9B5E45' : 'white',
                              color: isMine ? 'white' : '#3F3F3E',
                              border: isMine ? 'none' : '1px solid #E7E5E4',
                            }}
                          >
                            {m.content}
                          </div>
                          <div className={`text-xs text-stone-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="bg-white border-t border-stone-200 p-4">
              <div className="flex gap-2 items-end">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력해주세요 (Enter 전송, Shift+Enter 줄바꿈)"
                  rows={2}
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-md text-sm resize-none focus:outline-none focus:border-stone-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="px-4 py-2 rounded-md text-white text-sm font-medium disabled:opacity-50"
                  style={{ backgroundColor: '#9B5E45' }}
                >
                  {sending ? '전송 중...' : '보내기'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

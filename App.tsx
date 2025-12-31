
import React, { useState, useEffect, useCallback } from 'react';
import { Event, AppMode, Participant } from './types';
import { storageService } from './services/storage';
import EventCard from './components/EventCard';
import EventForm from './components/EventForm';

const ADMIN_STORAGE_KEY = 'dino_admin_auth';

const App: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GUEST);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // 管理員驗證狀態
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [pwd, setPwd] = useState('');

  useEffect(() => {
    const loadedEvents = storageService.getEvents();
    setEvents(loadedEvents);

    // 檢查本地儲存的登入狀態
    const isAuth = localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
    if (isAuth) {
      setCurrentMode(AppMode.ADMIN);
    }
  }, []);

  const refreshEvents = () => {
    setEvents(storageService.getEvents());
  };

  const formatTWDate = useCallback((dateStr: string) => {
    if (!dateStr) return '時間未定';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const m = date.getMonth() + 1;
    const d = date.getDate();
    const dayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const w = dayNames[date.getDay()];
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${m}/${d} (${w}) ${h}:${min}`;
  }, []);

  // 產生 Google Calendar 連結
  const generateGoogleCalendarLink = (event: Event) => {
    const startDate = new Date(event.dateTime);
    // 預設活動長度為 2 小時
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const format = (date: Date) => date.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const dates = `${format(startDate)}/${format(endDate)}`;
    
    const details = `${event.content}${event.note ? `\n\n💡 首領叮嚀：${event.note}` : ''}\n\n---\n報名名單：\n${event.participants.map(p => `- ${p.name}`).join('\n')}`;
    const location = `${event.locationName} (${event.locationAddress})`;
    
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('🦖 ' + event.title)}&dates=${dates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
  };

  const handleCreateEvent = (data: any) => {
    if (currentMode !== AppMode.ADMIN) return;
    const newEvent: Event = {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      participants: []
    };
    storageService.addEvent(newEvent);
    setIsCreating(false);
    refreshEvents();
  };

  const handleDeleteEvent = (id: string) => {
    if (currentMode !== AppMode.ADMIN) return;
    if (confirm('確定要取消這次恐龍聚首嗎？')) {
      storageService.deleteEvent(id);
      refreshEvents();
    }
  };

  const handleJoinEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !joinName.trim()) return;

    const event = events.find(ev => ev.id === selectedEventId);
    if (!event) return;

    const newParticipant: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      name: joinName,
      note: joinNote
    };

    const updatedEvent = {
      ...event,
      participants: [...event.participants, newParticipant]
    };

    storageService.updateEvent(updatedEvent);
    setJoinName('');
    setJoinNote('');
    refreshEvents();
  };

  const handleRemoveParticipant = (eventId: string, pId: string) => {
    if (currentMode !== AppMode.ADMIN) return;
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    const updatedEvent = {
      ...event,
      participants: event.participants.filter(p => p.id !== pId)
    };

    storageService.updateEvent(updatedEvent);
    refreshEvents();
  };

  const handleToggleLeaderMode = () => {
    if (currentMode === AppMode.ADMIN) {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      setCurrentMode(AppMode.GUEST);
      setIsCreating(false);
    } else {
      setShowPwdInput(true);
    }
  };

  const handleVerifyPwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === '0814') {
      localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      setCurrentMode(AppMode.ADMIN);
      setShowPwdInput(false);
      setPwd('');
    } else {
      alert('密碼錯誤！你不是首領龍！🦕');
      setPwd('');
    }
  };

  const generateChainText = (event: Event) => {
    const formattedTime = formatTWDate(event.dateTime);
    const participantList = event.participants.map((p, i) => `${i + 1}.${p.name}${p.note ? `(${p.note})` : ''}`).join('\n');
    
    const emptySlots = [];
    if (event.maxParticipants && event.participants.length < event.maxParticipants) {
      for (let i = event.participants.length + 1; i <= event.maxParticipants; i++) {
        emptySlots.push(`${i}.`);
      }
    }

    const finalLink = event.locationLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.locationAddress || event.locationName)}`;

    return `🦖 恐龍揪團：${event.title}

⏰ 時間：${formattedTime}
📍 巢穴：
${event.locationName}
${event.locationAddress}
${finalLink}

📜 冒險詳情：${event.content}

-- 恐龍接龍 --
${participantList}
${emptySlots.join('\n')}
----
🦴 備註：${event.note}`;
  };

  const copyToClipboard = (event: Event) => {
    const text = generateChainText(event);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b-4 border-emerald-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setSelectedEventId(null); setIsCreating(false); setShowPwdInput(false); }}>
            <div className="bg-emerald-500 p-2 rounded-2xl rotate-[-5deg] group-hover:rotate-0 transition-all duration-300 shadow-[0_4px_0_0_#065f46]">
              <span className="text-2xl">🦖</span>
            </div>
            <h1 className="text-2xl font-black text-emerald-900 tracking-tight">DinoEvent</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {showPwdInput ? (
              <form onSubmit={handleVerifyPwd} className="flex gap-2 animate-in fade-in slide-in-from-right-4">
                <input 
                  autoFocus
                  type="password"
                  placeholder="密碼..."
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  className="px-3 py-1 rounded-full border-2 border-emerald-200 text-sm font-bold w-24 outline-none focus:border-emerald-500 text-gray-900"
                />
                <button type="submit" className="text-xs font-black bg-emerald-500 text-white px-3 py-1 rounded-full shadow-sm hover:bg-emerald-600 transition-colors">解鎖</button>
                <button type="button" onClick={() => setShowPwdInput(false)} className="text-xs font-bold text-gray-400">取消</button>
              </form>
            ) : (
              <button
                onClick={handleToggleLeaderMode}
                className={`text-xs font-black px-4 py-2 rounded-full border-2 transition-all shadow-sm active:scale-95 ${
                  currentMode === AppMode.ADMIN 
                  ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200' 
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                }`}
              >
                {currentMode === AppMode.ADMIN ? '🚪 退出首領' : '🥚 切換首領'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-8">
        {selectedEventId && selectedEvent ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <button 
              onClick={() => setSelectedEventId(null)}
              className="flex items-center text-sm font-bold text-emerald-700 hover:text-emerald-900 mb-2 transition-colors group"
            >
              <span className="mr-1 group-hover:-translate-x-1 transition-transform">🔙</span>
              返回叢林
            </button>

            <div className="bg-white rounded-[2.5rem] border-4 border-emerald-50 p-8 md:p-10 shadow-xl relative overflow-hidden">
              <div className="absolute top-[-20px] right-[-20px] text-8xl opacity-10 rotate-[15deg] pointer-events-none">🦕</div>
              
              <h2 className="text-4xl font-black text-emerald-900 mb-8 leading-tight">{selectedEvent.title}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="flex gap-4 items-center bg-emerald-50/50 p-5 rounded-[2rem]">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-2xl">⏰</div>
                  <div>
                    <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">出發時間</div>
                    <div className="text-lg text-emerald-900 font-bold">{formatTWDate(selectedEvent.dateTime)}</div>
                  </div>
                </div>

                <div className="flex gap-4 items-center bg-orange-50/50 p-5 rounded-[2rem]">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-2xl">📍</div>
                  <div className="flex-1">
                    <div className="text-xs font-black text-orange-600 uppercase tracking-widest">集合巢穴</div>
                    <div className="text-lg text-emerald-900 font-bold truncate">{selectedEvent.locationName}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/80 rounded-[2rem] p-6 mb-10 border-2 border-dashed border-gray-200">
                <div className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-lg">📜</span> 探險計畫內容
                </div>
                <p className="text-emerald-900 font-medium whitespace-pre-wrap leading-relaxed">{selectedEvent.content}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    {/* 導航按鈕 */}
                    <a 
                      href={selectedEvent.locationLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.locationAddress || selectedEvent.locationName)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 bg-emerald-500 text-white py-4 px-6 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-[0_4px_0_0_#065f46] active:translate-y-[4px] active:shadow-none"
                    >
                      🧭 點擊導航前往
                    </a>

                    {/* 加入行事曆按鈕 */}
                    <a 
                      href={generateGoogleCalendarLink(selectedEvent)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 bg-white text-emerald-700 border-4 border-emerald-100 py-4 px-6 rounded-2xl font-black text-lg hover:bg-emerald-50 transition-all active:scale-95"
                    >
                      📅 加入行程
                    </a>
                </div>
              </div>

              <div className="mb-10">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                  <h3 className="text-2xl font-black text-emerald-900 flex items-center gap-2">
                    🦖 探險隊名單
                    <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">{selectedEvent.participants.length}/{selectedEvent.maxParticipants || '∞'}</span>
                  </h3>
                  <button
                    onClick={() => copyToClipboard(selectedEvent)}
                    className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-2xl text-sm font-black hover:bg-orange-600 transition-all shadow-[0_4px_0_0_#9a3412] active:translate-y-[4px] active:shadow-none"
                  >
                    {copySuccess ? '✅ 已存入骨頭' : '📋 複製探險接龍'}
                  </button>
                </div>

                <div className="space-y-3 mb-8">
                  {selectedEvent.participants.length > 0 ? (
                    selectedEvent.participants.map((p, index) => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl hover:border-emerald-200 transition-colors">
                        <div className="flex items-center">
                          <span className="w-8 text-emerald-400 font-black">{index + 1}.</span>
                          <span className="font-bold text-emerald-900 text-lg">{p.name}</span>
                          {p.note && <span className="text-sm text-emerald-600/70 ml-3 bg-white px-2 py-0.5 rounded-lg border border-emerald-100">🦴 {p.note}</span>}
                        </div>
                        {currentMode === AppMode.ADMIN && (
                          <button 
                            onClick={() => handleRemoveParticipant(selectedEvent.id, p.id)}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-emerald-300 font-bold border-4 border-dashed border-emerald-50 rounded-[2rem]">
                      這片荒野目前還沒有恐龍...
                    </div>
                  )}
                </div>

                <div className="bg-emerald-600 rounded-[2rem] p-8 shadow-xl relative overflow-hidden">
                  <div className="absolute bottom-[-10px] right-[-10px] text-6xl opacity-20 pointer-events-none">🦴</div>
                  <h4 className="font-black text-white text-xl mb-6 flex items-center gap-2">
                    🐾 加入這場探險
                  </h4>
                  <form onSubmit={handleJoinEvent} className="flex flex-col gap-4">
                    <input
                      required
                      placeholder="恐龍暱稱"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      className="px-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-emerald-400 outline-none shadow-inner font-bold text-lg text-gray-900 placeholder:text-emerald-300"
                    />
                    <input
                      placeholder="想說的話 (選填)"
                      value={joinNote}
                      onChange={(e) => setJoinNote(e.target.value)}
                      className="px-6 py-4 rounded-2xl border-none focus:ring-4 focus:ring-emerald-400 outline-none shadow-inner font-bold text-gray-900 placeholder:text-emerald-300"
                    />
                    <button
                      type="submit"
                      disabled={selectedEvent.maxParticipants ? selectedEvent.participants.length >= selectedEvent.maxParticipants : false}
                      className="bg-white text-emerald-700 py-4 rounded-2xl font-black text-xl hover:bg-emerald-50 disabled:bg-emerald-400 disabled:text-emerald-200 transition-all shadow-[0_6px_0_0_#064e3b] active:translate-y-[6px] active:shadow-none active:scale-[0.98]"
                    >
                      立刻報名探險！
                    </button>
                  </form>
                </div>
              </div>

              {selectedEvent.note && (
                <div className="text-sm font-bold text-emerald-500 bg-emerald-50/50 px-6 py-4 rounded-2xl flex items-center gap-3">
                  <span className="text-xl">💡</span>
                  首領叮嚀：{selectedEvent.note}
                </div>
              )}
            </div>
          </div>
        ) : isCreating ? (
          <EventForm 
            onSubmit={handleCreateEvent} 
            onCancel={() => setIsCreating(false)} 
          />
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex justify-between items-end mb-4 flex-wrap gap-6">
              <div>
                <h2 className="text-3xl font-black text-emerald-900 mb-1">正在進行的探險</h2>
                <p className="text-emerald-600 font-bold">快找找感興趣的足跡吧！</p>
              </div>
              {currentMode === AppMode.ADMIN && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="bg-emerald-500 text-white py-4 px-8 rounded-3xl font-black text-lg hover:bg-emerald-600 transition-all shadow-[0_6px_0_0_#065f46] active:translate-y-[6px] active:shadow-none flex items-center gap-2"
                >
                  <span className="text-2xl">🥚</span> 發起聚首
                </button>
              )}
            </div>

            {events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10">
                {events.map(event => (
                  <EventCard 
                    key={event.id}
                    event={{
                      ...event,
                      dateTime: formatTWDate(event.dateTime)
                    }}
                    mode={currentMode}
                    onView={setSelectedEventId}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-emerald-100 shadow-sm">
                <div className="text-6xl mb-6 grayscale opacity-30">🦕</div>
                <div className="text-emerald-400 font-black text-xl mb-4">這片領地目前靜悄悄的...</div>
                {currentMode === AppMode.ADMIN && (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="text-emerald-600 font-black text-lg hover:scale-110 transition-transform flex items-center justify-center gap-2 mx-auto"
                  >
                    🐾 留下第一個足跡
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t-2 border-emerald-50 py-4 text-center z-10">
        <p className="text-xs font-black text-emerald-300 tracking-widest uppercase">DinoEvent 2024 - Let's ROAR Together!</p>
      </footer>
    </div>
  );
};

export default App;

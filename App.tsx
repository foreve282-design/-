
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';

// --- Firebase Init ---
const firebaseConfig = {
  apiKey: "AIzaSyC7vvBxvcTWFE5IcCeqmWk3JXSWvAd0dkM",
  authDomain: "wason-b212c.firebaseapp.com",
  projectId: "wason-b212c",
  storageBucket: "wason-b212c.firebasestorage.app",
  messagingSenderId: "437870051664",
  appId: "1:437870051664:web:75da9c69f07bf773e4ec55",
  measurementId: "G-PPNN8GVBX5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EVENTS_COLLECTION = 'dino_events';

// --- Types ---

enum AppMode {
  GUEST = 'guest',
  ADMIN = 'admin'
}

interface Participant {
  id: string;
  name: string;
  note?: string;
  donationAmount?: number;
}

interface CancellationLog {
  participantName: string;
  reason: string;
  timestamp: number;
}

interface Event {
  id: string;
  title: string;
  dateTime: string;
  locationName: string;
  locationAddress: string;
  locationLink?: string;
  content: string;
  note?: string;
  participants: Participant[];
  maxParticipants?: number;
  cost?: number;
  enableDonation?: boolean;
  fundraisingGoal?: number;
  cancellations?: CancellationLog[];
  wishers?: string[];
  createdAt: number;
  authorId?: string;
}

// --- Components ---

const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border-4 border-emerald-100 transform transition-all scale-100 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-black text-emerald-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-white font-bold shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300 ${bgColors[type]} whitespace-nowrap`}>
      {message}
    </div>
  );
};

const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 0 }).format(amount);
};

const DonationProgressBar: React.FC<{ current: number; goal?: number }> = ({ current, goal }) => {
    if (!goal || goal <= 0) {
        return (
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 flex items-center gap-2 text-orange-800 text-sm font-bold">
                <span>❤️ 目前募得:</span>
                <span className="text-lg">{formatCurrency(current)}</span>
            </div>
        );
    }
    const percentage = Math.min(100, Math.max(0, (current / goal) * 100));
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs font-black text-orange-700 uppercase tracking-wide">
                <span>募款進度</span>
                <span>{formatCurrency(current)} / {formatCurrency(goal)}</span>
            </div>
            <div className="h-4 bg-orange-100 rounded-full overflow-hidden border border-orange-200">
                <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-1000 ease-out shadow-[0_2px_0_inset_rgba(255,255,255,0.3)] relative"
                    style={{ width: `${percentage}%` }}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-50"></div>
                </div>
            </div>
            <div className="text-right text-xs font-bold text-orange-400">{percentage.toFixed(0)}%</div>
        </div>
    );
};

const EventCard: React.FC<{
  event: Event & { dateTimeFormatted: string };
  mode: AppMode;
  currentUserId?: string;
  isHistory?: boolean;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onWish: (e: React.MouseEvent) => void;
}> = ({ event, mode, currentUserId, isHistory, onView, onDelete, onWish }) => {
  const [isWashing, setIsWashing] = useState(false);
  const participantCount = event.participants?.length || 0;
  const isFull = event.maxParticipants && participantCount >= event.maxParticipants;
  const totalDonationRevenue = event.participants?.reduce((sum, p) => sum + (p.donationAmount || 0), 0) || 0;
  const hasWished = currentUserId && event.wishers?.includes(currentUserId);
  const wishCount = event.wishers?.length || 0;

  const handleWishClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsWashing(true);
    setTimeout(() => setIsWashing(false), 350); 
    onWish(e);
  };

  return (
    <div className={`bg-white rounded-[2rem] border-4 p-6 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden flex flex-col h-full ${isHistory ? 'border-gray-200 opacity-90 grayscale-[0.2]' : 'border-emerald-50'}`} onClick={() => onView(event.id)}>
      <div className={`absolute top-[-10px] right-[-10px] text-6xl opacity-5 rotate-[15deg] group-hover:opacity-10 transition-opacity ${isHistory ? 'grayscale' : ''}`}>🦖</div>
      
      <div className="absolute top-4 right-4 flex flex-col items-end gap-1">
        {isHistory ? (
           <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-1 rounded-md shadow-sm border border-gray-200">🏁 已結束</span>
        ) : isFull ? (
           <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-md shadow-sm border border-red-200 animate-pulse">🔥 已客滿</span>
        ) : (
           <>
            {event.cost ? (
               <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-md shadow-sm">💰 費用 {formatCurrency(event.cost)}</span>
            ) : (
               <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-md shadow-sm">🆓 免費活動</span>
            )}
           </>
        )}
      </div>

      <div className="mb-4 pr-16">
        <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isHistory ? 'text-gray-400' : 'text-emerald-400'}`}>{event.dateTimeFormatted}</div>
        <h3 className={`text-2xl font-black leading-tight line-clamp-2 ${isHistory ? 'text-gray-700' : 'text-emerald-900'}`}>{event.title}</h3>
      </div>

      <div className="space-y-4 mb-6 flex-grow">
        <div className="space-y-2">
            <div className="flex items-start gap-2 text-gray-600">
            <span className="text-lg">📍</span>
            <span className="font-bold text-sm line-clamp-1">{event.locationName}</span>
            </div>
            <div className="flex items-start gap-2 text-gray-600">
            <span className="text-lg">👥</span>
            <span className="font-bold text-sm">{participantCount} {event.maxParticipants ? ` / ${event.maxParticipants}` : ' 人已報名'}</span>
            </div>
        </div>
        
        {event.enableDonation && (
          <div className="space-y-2">
            <DonationProgressBar current={totalDonationRevenue} goal={event.fundraisingGoal} />
            {isHistory && (
              <div className="flex justify-between items-center px-3 py-2 bg-orange-50 rounded-xl border border-orange-100 animate-in fade-in slide-in-from-top-1">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1">✨ 最終募款總額</span>
                <span className="text-sm font-black text-orange-700">{formatCurrency(totalDonationRevenue)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-auto pt-2">
        <div className="flex gap-2">
            <button
                onClick={handleWishClick}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-sm transition-all active:scale-90 ${
                    hasWished ? 'bg-yellow-100 text-yellow-700 shadow-inner' : 'bg-gray-50 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600'
                } ${isWashing ? 'wish-pop' : ''}`}
            >
                <span className={`transition-transform duration-300 ${isWashing ? 'scale-125' : ''}`}>🥣</span>
                <span>{wishCount > 0 ? wishCount : '敲碗'}</span>
            </button>
            <span className={`text-sm font-black group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 self-center ml-1 ${isHistory ? 'text-gray-400' : 'text-emerald-500'}`}>詳情 ➔</span>
        </div>
        {mode === AppMode.ADMIN && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(event.id); }} className="text-red-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors z-10">🗑️</button>
        )}
      </div>
    </div>
  );
};

const EventForm: React.FC<{
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}> = ({ onSubmit, onCancel, isSubmitting }) => {
  const getDefaultDateTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    title: '',
    dateTime: getDefaultDateTime(),
    locationName: '',
    locationAddress: '',
    locationLink: '',
    content: '',
    note: '',
    maxParticipants: '',
    cost: '',
    enableDonation: false,
    fundraisingGoal: ''
  });
  
  const [isDetecting, setIsDetecting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
       setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
       return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const applyPreset = (type: 'tomorrow' | 'friday' | 'weekend' | 'evening' | 'afternoon') => {
    const now = new Date();
    const target = new Date(formData.dateTime || now);
    switch (type) {
      case 'tomorrow':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        target.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        break;
      case 'friday':
        const friday = new Date();
        friday.setDate(friday.getDate() + ((5 + 7 - friday.getDay()) % 7 || 7));
        target.setFullYear(friday.getFullYear(), friday.getMonth(), friday.getDate());
        break;
      case 'evening': target.setHours(19, 0, 0, 0); break;
      case 'afternoon': target.setHours(14, 0, 0, 0); break;
    }
    setFormData(prev => ({ ...prev, dateTime: target.toISOString().slice(0, 16) }));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, locationAddress: `${latitude}, ${longitude}`, locationLink: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` }));
        setIsDetecting(false);
      },
      () => setIsDetecting(false)
    );
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-[2.5rem] border-4 border-emerald-50 p-8 md:p-10 shadow-xl relative overflow-hidden">
        <h2 className="text-3xl font-black text-emerald-900 mb-8 flex items-center gap-3">🥚 發起新的聚首</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...formData, cost: parseInt(formData.cost) || 0, maxParticipants: parseInt(formData.maxParticipants) || null, fundraisingGoal: parseInt(formData.fundraisingGoal) || null }); }} className="space-y-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-emerald-700 uppercase ml-2">活動標題</label>
            <input required name="title" value={formData.title} onChange={handleChange} placeholder="例如：肉食系燒肉團" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 outline-none font-bold text-emerald-900 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-emerald-700 uppercase ml-2">探險時間</label>
            <input required type="datetime-local" name="dateTime" value={formData.dateTime} onChange={handleChange} className="w-full px-6 py-5 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 outline-none font-black text-emerald-900 transition-all text-xl" />
            <div className="flex flex-wrap gap-2 mt-2">
               <button type="button" onClick={() => applyPreset('tomorrow')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600">☀️ 明天</button>
               <button type="button" onClick={() => applyPreset('friday')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600">🍻 這週五</button>
               <button type="button" onClick={() => applyPreset('evening')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600">🌃 晚上 19:00</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase ml-2">人數上限</label>
              <input type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} placeholder="無限制" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 outline-none font-bold text-emerald-900" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase ml-2">地點名稱</label>
              <input required name="locationName" value={formData.locationName} onChange={handleChange} placeholder="地點名稱" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 outline-none font-bold text-emerald-900" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-emerald-700 uppercase ml-2 flex justify-between">
              <span>地址 / 座標詳情</span>
              <button type="button" onClick={handleDetectLocation} className="text-emerald-500 hover:text-emerald-700 text-[10px] font-black">{isDetecting ? '📍 偵測中...' : '📍 偵測目前座標'}</button>
            </label>
            <input required name="locationAddress" value={formData.locationAddress} onChange={handleChange} placeholder="詳細地址或點擊上方自動偵測" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 outline-none font-bold text-emerald-900" />
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-2xl font-black text-lg border-2 border-gray-200 text-gray-500">取消</button>
            <button type="submit" disabled={isSubmitting} className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-[0_6px_0_0_#065f46] active:translate-y-[6px] active:shadow-none disabled:opacity-50">發布 🦖</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Main App ---
const ADMIN_STORAGE_KEY = 'dino_admin_auth';

const App: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [historyEvents, setHistoryEvents] = useState<Event[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GUEST);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [joinDonation, setJoinDonation] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pwd, setPwd] = useState('');
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Participant | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, EVENTS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
      const now = Date.now();
      const upcoming = all.filter(e => new Date(e.dateTime).getTime() >= now).sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      const past = all.filter(e => new Date(e.dateTime).getTime() < now).sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      setEvents(upcoming);
      setHistoryEvents(past);
    });
    if (localStorage.getItem(ADMIN_STORAGE_KEY) === 'true') setCurrentMode(AppMode.ADMIN);
    return () => unsubscribe();
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => setToast({ message, type });

  const formatTWDate = useCallback((dateStr: string) => {
    if (!dateStr) return '時間未定';
    const date = new Date(dateStr);
    const m = date.getMonth() + 1, d = date.getDate(), w = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    const h = String(date.getHours()).padStart(2, '0'), min = String(date.getMinutes()).padStart(2, '0');
    return `${m}/${d} (${w}) ${h}:${min}`;
  }, []);

  const generateChainText = (event: Event) => {
    const list = event.participants?.map((p, i) => `${i + 1}. ${p.name}${p.note ? `(${p.note})` : ''}`).join('\n') || '尚無報名';
    return `🦖 恐龍揪團：${event.title}\n⏰ 時間：${formatTWDate(event.dateTime)}\n📍 巢穴：${event.locationName}\n📜 詳情：${event.content}\n\n-- 接龍名單 --\n${list}\n----`;
  };

  const handleShare = async (event: Event) => {
    const shareData = {
      title: `🦖 恐龍揪團：${event.title}`,
      text: `⏰ 時間：${formatTWDate(event.dateTime)}\n📍 地點：${event.locationName}\n快點來報名吧！`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showToast('分享成功！🦖', 'success');
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n🔗 報名連結：${shareData.url}`);
        showToast('已複製分享資訊到剪貼簿！📋', 'success');
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateEvent = async (data: any) => {
    if (currentMode !== AppMode.ADMIN || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, EVENTS_COLLECTION), { ...data, createdAt: Date.now(), participants: [], wishers: [], authorId: user.uid });
      setIsCreating(false);
      showToast('探險召集令已發布！🥚', 'success');
    } catch (e) { showToast('發布失敗', 'error'); } 
    finally { setIsSubmitting(false); }
  };

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !joinName.trim() || !user) return;
    setIsSubmitting(true);
    const p: Participant = { id: Math.random().toString(36).substr(2, 9), name: joinName, note: joinNote, donationAmount: parseInt(joinDonation) || 0 };
    try {
      await updateDoc(doc(db, EVENTS_COLLECTION, selectedEventId), { participants: arrayUnion(p) });
      setJoinName(''); setJoinNote(''); setJoinDonation('');
      showToast(`報名成功, ${p.name}! 🦕`, 'success');
    } catch (err) { showToast('報名失敗', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleCancelRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !cancelTarget || !cancelReason.trim()) return;
    setIsSubmitting(true);
    try {
      const eventRef = doc(db, EVENTS_COLLECTION, selectedEventId);
      const batch = writeBatch(db);
      batch.update(eventRef, { participants: arrayRemove(cancelTarget) });
      batch.update(eventRef, { cancellations: arrayUnion({ participantName: cancelTarget.name, reason: cancelReason, timestamp: Date.now() }) });
      await batch.commit();
      setCancelTarget(null); setCancelReason('');
      showToast('已取消報名 👋', 'info');
    } catch (error) { showToast('取消失敗', 'error'); } 
    finally { setIsSubmitting(false); }
  };

  const handleToggleWish = async (eventId: string, wishers: string[] = []) => {
    if (!user) return;
    const ref = doc(db, EVENTS_COLLECTION, eventId);
    if (wishers.includes(user.uid)) {
      await updateDoc(ref, { wishers: arrayRemove(user.uid) });
      showToast('已收回碗 🥣', 'info');
    } else {
      await updateDoc(ref, { wishers: arrayUnion(user.uid) });
      showToast('敲碗成功！🥣 +1', 'success');
    }
  };

  const displayEvents = showHistory ? historyEvents : events;
  const selectedEvent = [...events, ...historyEvents].find(e => e.id === selectedEventId);
  const isSelectedFull = selectedEvent?.maxParticipants && selectedEvent.participants.length >= selectedEvent.maxParticipants;

  return (
    <div className="min-h-screen pb-20 bg-[#F9FBFA] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <header className="bg-white border-b-4 border-emerald-100 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedEventId(null); setIsCreating(false); }}>
            <div className="bg-emerald-500 p-2 rounded-2xl rotate-[-5deg] shadow-[0_4px_0_0_#065f46] active:shadow-none active:translate-y-1 transition-all">
              <span className="text-2xl">🦖</span>
            </div>
            <h1 className="text-2xl font-black text-emerald-900 tracking-tight">DinoEvent</h1>
          </div>
          <div className="flex items-center gap-2">
            {showPwdInput ? (
              <form onSubmit={(e) => { e.preventDefault(); if(pwd==='0814'){ localStorage.setItem(ADMIN_STORAGE_KEY,'true'); setCurrentMode(AppMode.ADMIN); setShowPwdInput(false); setPwd(''); showToast('管理模式啟動 👑','success'); } else { showToast('密碼錯誤','error'); setPwd(''); } }} className="flex gap-1">
                <input autoFocus type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="px-3 py-1 rounded-full border-2 border-emerald-200 text-sm w-20 outline-none" />
                <button type="submit" className="text-[10px] font-black bg-emerald-500 text-white px-2 py-1 rounded-full">OK</button>
              </form>
            ) : (
              <button onClick={() => currentMode === AppMode.ADMIN ? (localStorage.removeItem(ADMIN_STORAGE_KEY), setCurrentMode(AppMode.GUEST), showToast('已退出模式','info')) : setShowPwdInput(true)} className={`text-[10px] font-black px-3 py-1.5 rounded-full border-2 transition-all ${currentMode === AppMode.ADMIN ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {currentMode === AppMode.ADMIN ? '🚪 退出管理' : '🔒 管理登入'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-8">
        {!user ? (
          <div className="text-center py-20 animate-pulse text-emerald-600 font-bold">連線中...</div>
        ) : selectedEventId && selectedEvent ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <button onClick={() => setSelectedEventId(null)} className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1 group transition-colors">
              <span className="group-hover:-translate-x-1 transition-transform">🔙</span> 返回列表
            </button>
            <div className={`bg-white rounded-[2.5rem] border-4 p-6 md:p-10 shadow-xl ${showHistory ? 'border-gray-200' : 'border-emerald-50'}`}>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-black text-emerald-900 leading-tight flex-1">{selectedEvent.title}</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleShare(selectedEvent)} className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl active:scale-95 transition-all">📤 分享</button>
                  <button onClick={() => handleToggleWish(selectedEvent.id, selectedEvent.wishers)} className={`flex flex-col items-center px-4 py-2 rounded-2xl border-2 transition-all active:scale-90 ${selectedEvent.wishers?.includes(user.uid) ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'border-gray-100 text-gray-400'}`}>
                    <span className="text-xl">🥣</span>
                    <span className="text-[10px] font-black">{selectedEvent.wishers?.length || 0}</span>
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50/20 rounded-[2rem] p-6 mb-8 border-2 border-dashed border-emerald-100">
                <p className="text-emerald-900 font-medium whitespace-pre-wrap leading-relaxed">{selectedEvent.content}</p>
                <div className="mt-6 space-y-2 text-sm text-gray-500 font-bold">
                    <div className="flex items-center gap-2">📍 {selectedEvent.locationName} ({selectedEvent.locationAddress})</div>
                    <div>⏰ {formatTWDate(selectedEvent.dateTime)}</div>
                </div>
                {selectedEvent.enableDonation && (
                    <div className="mt-6 pt-6 border-t border-emerald-100/50">
                        <DonationProgressBar current={selectedEvent.participants.reduce((s,p)=>s+(p.donationAmount||0),0)} goal={selectedEvent.fundraisingGoal} />
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
                    <a href={selectedEvent.locationLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.locationAddress)}`} target="_blank" className="flex items-center justify-center gap-2 bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-[0_4px_0_0_#065f46] active:translate-y-1 active:shadow-none transition-all">🧭 點我導航</a>
                    <button onClick={() => { navigator.clipboard.writeText(generateChainText(selectedEvent)); showToast('已複製接龍文字！','success'); }} className="bg-white text-orange-700 border-4 border-orange-100 py-4 rounded-2xl font-black active:scale-95 transition-all">📋 複製接龍</button>
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-xl font-black text-emerald-900 mb-4">🐾 報名名單 ({selectedEvent.participants?.length || 0}/{selectedEvent.maxParticipants || '∞'})</h3>
                <div className="space-y-2">
                  {selectedEvent.participants?.map((p, i) => (
                    <div key={p.id} className="p-4 bg-gray-50/50 rounded-2xl font-bold text-emerald-900 flex justify-between items-center group/item transition-all hover:bg-white border-2 border-transparent hover:border-emerald-100">
                      <span>{i + 1}. {p.name} {p.note && <span className="text-xs font-normal opacity-60 ml-1">- {p.note}</span>}</span>
                      <button onClick={() => setCancelTarget(p)} className="text-[10px] text-gray-300 hover:text-red-500 font-black px-2 opacity-0 group-hover/item:opacity-100">取消報名</button>
                    </div>
                  ))}
                </div>
                {!showHistory && (
                  isSelectedFull ? (
                    <div className="mt-8 bg-red-50 text-red-700 p-6 rounded-[2rem] text-center font-black border-4 border-red-100">🚫 此場探險已客滿，下次請早！</div>
                  ) : (
                    <form onSubmit={handleJoinEvent} className="mt-8 bg-emerald-600 p-8 rounded-[2rem] space-y-4 shadow-lg border-b-8 border-emerald-800">
                      <h4 className="text-white font-black text-xl mb-2">🦕 報名參加</h4>
                      <input required placeholder="暱稱" value={joinName} onChange={(e) => setJoinName(e.target.value)} className="w-full px-6 py-4 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-emerald-400" />
                      <input placeholder="備註 (選填)" value={joinNote} onChange={(e) => setJoinNote(e.target.value)} className="w-full px-6 py-4 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-emerald-400" />
                      {selectedEvent.enableDonation && (
                        <input type="number" placeholder="樂捐金額 ❤️" value={joinDonation} onChange={(e) => setJoinDonation(e.target.value)} className="w-full px-6 py-4 rounded-2xl font-bold bg-orange-50 text-orange-900 outline-none focus:ring-4 focus:ring-orange-200" />
                      )}
                      <button type="submit" disabled={isSubmitting} className="w-full bg-white text-emerald-700 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all shadow-[0_4px_0_0_#CBD5E1]">確認報名</button>
                    </form>
                  )
                )}
              </div>
            </div>
          </div>
        ) : isCreating ? (
          <EventForm onSubmit={handleCreateEvent} onCancel={() => setIsCreating(false)} isSubmitting={isSubmitting} />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end flex-wrap gap-4">
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-emerald-900 tracking-tight">{showHistory ? '📜 歷史足跡' : '🦕 進行中的揪團'}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setShowHistory(false)} className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${!showHistory ? 'bg-emerald-500 text-white' : 'text-gray-400 bg-gray-100'}`}>現正探險</button>
                  <button onClick={() => setShowHistory(true)} className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${showHistory ? 'bg-emerald-500 text-white' : 'text-gray-400 bg-gray-100'}`}>過往足跡</button>
                </div>
              </div>
              {currentMode === AppMode.ADMIN && (
                <button onClick={() => setIsCreating(true)} className="bg-emerald-500 text-white py-3 px-6 rounded-2xl font-black shadow-[0_4px_0_0_#065f46] active:translate-y-1 active:shadow-none transition-all">🥚 新揪團</button>
              )}
            </div>
            {displayEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                  {displayEvents.map(e => (
                    <EventCard key={e.id} event={{ ...e, dateTimeFormatted: formatTWDate(e.dateTime) }} mode={currentMode} currentUserId={user.uid} isHistory={showHistory} onView={setSelectedEventId} onDelete={(id)=>setDeleteConfirmationId(id)} onWish={() => handleToggleWish(e.id, e.wishers)} />
                  ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-100">
                  <div className="text-6xl mb-4 opacity-20">🥚</div>
                  <p className="font-bold text-gray-300">目前還沒有活動足跡...</p>
                </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm py-3 text-center border-t border-emerald-50 text-[10px] font-black text-emerald-200 tracking-[0.2em] uppercase">DinoEvent v1.0 • Release</footer>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="確定不來了嗎？🌪️">
         <div className="space-y-4">
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="告訴首領原因吧..." className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-red-400" rows={3} />
            <button onClick={handleCancelRegistration} disabled={!cancelReason.trim()} className="w-full bg-red-500 text-white font-black py-4 rounded-xl active:scale-95 disabled:opacity-50">確認取消 🦖</button>
         </div>
      </Modal>

      <Modal isOpen={!!deleteConfirmationId} onClose={() => setDeleteConfirmationId(null)} title="撤銷這場探險？🗑️">
        <div className="space-y-6">
            <p className="font-bold text-gray-500">刪除後所有恐龍的報名資料都會消失喔！</p>
            <button onClick={async () => { await deleteDoc(doc(db,EVENTS_COLLECTION,deleteConfirmationId!)); setDeleteConfirmationId(null); setSelectedEventId(null); showToast('已撤銷聚首','info'); }} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black">確定刪除</button>
        </div>
      </Modal>
    </div>
  );
};

export default App;


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
  const totalCostRevenue = (event.cost || 0) * participantCount;
  const totalDonationRevenue = event.participants?.reduce((sum, p) => sum + (p.donationAmount || 0), 0) || 0;
  const totalRevenue = totalCostRevenue + totalDonationRevenue;
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
           <span className="bg-gray-100 text-gray-600 text-xs font-black px-2 py-1 rounded-md shadow-sm border border-gray-200">🏁 已結束</span>
        ) : (
           <>
            {event.cost ? (
               <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-1 rounded-md shadow-sm">💰 費用 {formatCurrency(event.cost)}</span>
            ) : (
               <span className="bg-blue-100 text-blue-700 text-xs font-black px-2 py-1 rounded-md shadow-sm">🆓 免費活動</span>
            )}
            {event.enableDonation && (
               <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-1 rounded-md shadow-sm">❤️ 開放募款</span>
            )}
           </>
        )}
      </div>

      <div className="mb-4 pr-16">
        <div className={`text-xs font-black uppercase tracking-widest mb-1 ${isHistory ? 'text-gray-400' : 'text-emerald-400'}`}>{event.dateTimeFormatted}</div>
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

        {mode === AppMode.ADMIN && (
          <div className="flex items-start gap-2 text-emerald-600 mt-2 pt-2 border-t border-gray-100">
            <span className="text-lg">📊</span>
            <span className="font-bold text-sm">預估總收: {formatCurrency(totalRevenue)}</span>
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
  // 初始化為明天的 19:00
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
      case 'evening':
        target.setHours(19, 0, 0, 0);
        break;
      case 'afternoon':
        target.setHours(14, 0, 0, 0);
        break;
    }
    setFormData(prev => ({ ...prev, dateTime: target.toISOString().slice(0, 16) }));
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("你的瀏覽器不支援偵測位置喔！🦕");
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const geoLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
        setFormData(prev => ({
          ...prev,
          locationAddress: `${latitude}, ${longitude}`,
          locationLink: geoLink
        }));
        setIsDetecting(false);
      },
      (error) => {
        console.error(error);
        alert("偵測失敗，請檢查權限設定。");
        setIsDetecting(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      ...formData,
      cost: formData.cost ? parseInt(formData.cost) : 0,
      maxParticipants: formData.maxParticipants ? parseInt(formData.maxParticipants) : null,
      fundraisingGoal: formData.fundraisingGoal ? parseInt(formData.fundraisingGoal) : null,
    };
    onSubmit(payload);
  };

  return (
    <div className="animate-in slide-in-from-bottom-8 duration-500">
      <div className="bg-white rounded-[2.5rem] border-4 border-emerald-50 p-8 md:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400"></div>
        
        <h2 className="text-3xl font-black text-emerald-900 mb-8 flex items-center gap-3">
          <span className="bg-emerald-100 p-2 rounded-2xl">🥚</span>
          發起新的恐龍聚首
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* 基本資訊 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex items-center gap-1">
                <span className="text-lg">🏷️</span> 活動標題
              </label>
              <input required name="title" value={formData.title} onChange={handleChange} placeholder="例如：肉食系燒肉團" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-bold text-lg text-emerald-900 transition-all" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex items-center gap-1">
                <span className="text-lg">⏰</span> 探險時間
              </label>
              <div className="space-y-3">
                <div className="relative group">
                   <input required type="datetime-local" name="dateTime" value={formData.dateTime} onChange={handleChange} className="w-full px-6 py-5 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-black text-emerald-900 transition-all text-xl" />
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-200 group-focus-within:text-emerald-400 transition-colors">📅</div>
                </div>
                
                {/* 快速選擇按鈕 */}
                <div className="flex flex-wrap gap-2">
                   <button type="button" onClick={() => applyPreset('tomorrow')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all">☀️ 明天</button>
                   <button type="button" onClick={() => applyPreset('friday')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all">🍻 這週五</button>
                   <button type="button" onClick={() => applyPreset('afternoon')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all">☕ 下午 14:00</button>
                   <button type="button" onClick={() => applyPreset('evening')} className="px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-100 text-xs font-bold text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50 transition-all">🌃 晚上 19:00</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex items-center gap-1">
                <span className="text-lg">👥</span> 人數上限
              </label>
              <input type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleChange} placeholder="無限制" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-bold text-emerald-900 transition-all" />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex items-center gap-1">
                <span className="text-lg">📍</span> 地點名稱
              </label>
              <input required name="locationName" value={formData.locationName} onChange={handleChange} placeholder="例如：華生秘密基地" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-bold text-emerald-900 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex justify-between items-center">
              <span className="flex items-center gap-1"><span className="text-lg">🗺️</span> 地址 / 座標詳情</span>
              <button type="button" onClick={handleDetectLocation} className="text-emerald-500 hover:text-emerald-700 text-[10px] font-black bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 active:scale-95 transition-all">
                {isDetecting ? '📍 偵測中...' : '📍 自動偵測目前座標'}
              </button>
            </label>
            <input required name="locationAddress" value={formData.locationAddress} onChange={handleChange} placeholder="詳細地址或點擊上方自動偵測" className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-bold text-emerald-900 transition-all" />
          </div>

          <div className="bg-orange-50/50 p-6 rounded-[2rem] space-y-4 border-2 border-orange-100 shadow-inner">
            <div className="text-[10px] font-black text-orange-600 uppercase tracking-[0.2em] flex items-center gap-2">
                <span className="bg-orange-200 p-1 rounded-lg">💰</span> 財務管理與募款 (選填)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-300 font-bold">$</span>
                <input type="number" name="cost" value={formData.cost} onChange={handleChange} placeholder="參加費用" className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-orange-100 focus:border-orange-400 outline-none font-bold text-gray-900 transition-all" />
              </div>
              <div className="flex items-center gap-3 px-2">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="enableDonation" checked={formData.enableDonation} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    <span className="ml-3 text-sm font-bold text-orange-700">開啟自由募款 ❤️</span>
                </label>
              </div>
            </div>
            {formData.enableDonation && (
              <div className="animate-in zoom-in-95 duration-200">
                <input type="number" name="fundraisingGoal" value={formData.fundraisingGoal} onChange={handleChange} placeholder="設定募款目標 (例如：$500 買披薩)" className="w-full px-4 py-3 rounded-xl border-2 border-orange-200 focus:border-orange-400 outline-none font-bold text-orange-900 transition-all" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-emerald-700 uppercase tracking-widest ml-2 flex items-center gap-1">
              <span className="text-lg">📝</span> 探險簡報
            </label>
            <textarea required name="content" value={formData.content} onChange={handleChange} rows={3} placeholder="介紹一下這次聚首的亮點..." className="w-full px-6 py-4 rounded-2xl bg-emerald-50/30 border-2 border-emerald-100 focus:border-emerald-400 focus:bg-white outline-none font-bold text-emerald-900 resize-none transition-all" />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 py-4 rounded-2xl font-black text-lg border-2 border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all">取消</button>
            <button type="submit" disabled={isSubmitting} className="flex-[2] bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-[0_6px_0_0_#065f46] active:translate-y-[6px] active:shadow-none disabled:opacity-50 disabled:grayscale">
                {isSubmitting ? '正在發布...' : '發布探險召集令 🦖'}
            </button>
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
  const [cancelTarget, setCancelTarget] = useState<Participant | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [pwd, setPwd] = useState('');

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
    if (isNaN(date.getTime())) return dateStr;
    const m = date.getMonth() + 1, d = date.getDate(), w = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    const h = String(date.getHours()).padStart(2, '0'), min = String(date.getMinutes()).padStart(2, '0');
    return `${m}/${d} (${w}) ${h}:${min}`;
  }, []);

  const generateGoogleCalendarLink = (event: Event) => {
    const start = new Date(event.dateTime), end = new Date(start.getTime() + 2 * 3600000);
    const f = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const details = `${event.content}${event.note ? `\n\n💡 首領叮嚀：${event.note}` : ''}`;
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('🦖 ' + event.title)}&dates=${f(start)}/${f(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(event.locationAddress)}`;
  };

  const generateMapLink = (event: Event) => event.locationLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.locationAddress || event.locationName)}`;

  const generateChainText = (event: Event) => {
    const list = event.participants?.map((p, i) => `${i + 1}. ${p.name}${p.note ? `(${p.note})` : ''}`).join('\n') || '尚無報名';
    return `🦖 恐龍揪團：${event.title}\n⏰ 時間：${formatTWDate(event.dateTime)}\n📍 巢穴：${event.locationName}\n📜 詳情：${event.content}\n\n-- 接龍名單 --\n${list}\n----`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('已複製接龍文字到剪貼簿！📋', 'success'));
  };

  const handleCreateEvent = async (data: any) => {
    if (currentMode !== AppMode.ADMIN || !user) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, EVENTS_COLLECTION), { ...data, createdAt: Date.now(), participants: [], wishers: [], authorId: user.uid });
      setIsCreating(false);
      showToast('新探險已發布！☁️', 'success');
    } catch (e) { showToast('發布失敗', 'error'); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmationId) return;
    await deleteDoc(doc(db, EVENTS_COLLECTION, deleteConfirmationId));
    setDeleteConfirmationId(null);
    setSelectedEventId(null);
    showToast('探險已取消 🌪️', 'info');
  };

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !joinName.trim() || !user) return;
    setIsSubmitting(true);
    const p: Participant = { id: Math.random().toString(36).substr(2, 9), name: joinName, note: joinNote, donationAmount: joinDonation ? parseInt(joinDonation) : 0 };
    try {
      await updateDoc(doc(db, EVENTS_COLLECTION, selectedEventId), { participants: arrayUnion(p) });
      setJoinName(''); setJoinNote(''); setJoinDonation('');
      showToast(`歡迎加入, ${p.name}! 🦕`, 'success');
    } catch (err) { showToast('加入失敗', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const handleCancelRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !cancelTarget || !cancelReason.trim()) return;
    setIsSubmitting(true);
    const log: CancellationLog = { participantName: cancelTarget.name, reason: cancelReason, timestamp: Date.now() };
    try {
      const eventRef = doc(db, EVENTS_COLLECTION, selectedEventId);
      const batch = writeBatch(db);
      batch.update(eventRef, { participants: arrayRemove(cancelTarget) });
      batch.update(eventRef, { cancellations: arrayUnion(log) });
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
      showToast('已取消敲碗 👌', 'info');
    } else {
      await updateDoc(ref, { wishers: arrayUnion(user.uid) });
      showToast('敲碗成功！🥣 +1', 'success');
    }
  };

  const handleVerifyPwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === '0814') {
      localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      setCurrentMode(AppMode.ADMIN);
      setShowPwdInput(false);
      setPwd('');
      showToast('首領模式已啟動！👑', 'success');
    } else { showToast('密碼錯誤！🦕', 'error'); setPwd(''); }
  };

  const displayEvents = showHistory ? historyEvents : events;
  const selectedEvent = [...events, ...historyEvents].find(e => e.id === selectedEventId);
  const currentTotalDonation = selectedEvent?.participants?.reduce((sum, p) => sum + (p.donationAmount || 0), 0) || 0;

  return (
    <div className="min-h-screen pb-20 bg-stone-50 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <header className="bg-white border-b-4 border-emerald-100 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedEventId(null); setIsCreating(false); }}>
            <div className="bg-emerald-500 p-2 rounded-2xl rotate-[-5deg] shadow-[0_4px_0_0_#065f46]"><span className="text-2xl">🦖</span></div>
            <h1 className="text-2xl font-black text-emerald-900 tracking-tight hidden sm:block">DinoEvent</h1>
          </div>
          <div className="flex items-center gap-4">
            {showPwdInput ? (
              <form onSubmit={handleVerifyPwd} className="flex gap-2">
                <input autoFocus type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="px-3 py-1 rounded-full border-2 border-emerald-200 text-sm font-bold w-24 outline-none text-gray-900 bg-white" />
                <button type="submit" className="text-xs font-black bg-emerald-500 text-white px-3 py-1 rounded-full">解鎖</button>
                <button onClick={() => setShowPwdInput(false)} className="text-xs font-bold text-gray-400">取消</button>
              </form>
            ) : (
              <button onClick={() => currentMode === AppMode.ADMIN ? (localStorage.removeItem(ADMIN_STORAGE_KEY), setCurrentMode(AppMode.GUEST), showToast('已退出模式','info')) : setShowPwdInput(true)} className={`text-xs font-black px-4 py-2 rounded-full border-2 transition-all ${currentMode === AppMode.ADMIN ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {currentMode === AppMode.ADMIN ? '🚪 退出首領' : '🥚 切換首領'}
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
            <button onClick={() => setSelectedEventId(null)} className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1 group transition-colors hover:text-emerald-900">
              <span className="group-hover:-translate-x-1 transition-transform">🔙</span> 返回叢林
            </button>
            <div className={`bg-white rounded-[2.5rem] border-4 p-6 md:p-10 shadow-xl ${showHistory ? 'border-gray-200' : 'border-emerald-50'}`}>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-black text-emerald-900 leading-tight flex-1">{selectedEvent.title}</h2>
                <button onClick={() => handleToggleWish(selectedEvent.id, selectedEvent.wishers)} className={`flex flex-col items-center px-4 py-2 rounded-2xl border-2 transition-all active:scale-90 ${selectedEvent.wishers?.includes(user.uid) ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'border-gray-100 text-gray-400'}`}>
                  <span className="text-2xl">🥣</span>
                  <span className="text-xs font-black">{selectedEvent.wishers?.length || 0}</span>
                </button>
              </div>
              <div className="bg-gray-50/80 rounded-[2rem] p-6 mb-10 border-2 border-dashed border-gray-200">
                <p className="text-emerald-900 font-medium whitespace-pre-wrap leading-relaxed">{selectedEvent.content}</p>
                <div className="mt-4 text-sm text-gray-500 font-bold space-y-1">
                    <div className="flex items-center gap-2">📍 <a href={generateMapLink(selectedEvent)} target="_blank" className="hover:text-emerald-600 underline decoration-emerald-200 underline-offset-2">{selectedEvent.locationName} ({selectedEvent.locationAddress})</a></div>
                    <div>⏰ {formatTWDate(selectedEvent.dateTime)}</div>
                </div>
                {selectedEvent.enableDonation && (
                    <div className="mt-6 pt-6 border-t border-gray-200/50">
                        <DonationProgressBar current={currentTotalDonation} goal={selectedEvent.fundraisingGoal} />
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                    <a href={generateMapLink(selectedEvent)} target="_blank" className="flex items-center justify-center gap-3 bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-[0_4px_0_0_#065f46] active:translate-y-[4px] active:shadow-none transition-all">🧭 點擊導航前往</a>
                    <a href={generateGoogleCalendarLink(selectedEvent)} target="_blank" className="flex items-center justify-center gap-3 bg-white text-emerald-700 border-4 border-emerald-100 py-4 rounded-2xl font-black active:scale-95 transition-all">📅 加入行程</a>
                </div>
                <button onClick={() => copyToClipboard(generateChainText(selectedEvent))} className="w-full mt-4 bg-orange-100 text-orange-700 py-3 rounded-2xl font-bold border-2 border-orange-200 hover:bg-orange-200 transition-colors">📋 複製探險接龍文字</button>
              </div>

              <div className="mb-10">
                <h3 className="text-xl font-black text-emerald-900 mb-4">🦖 報名名單 ({selectedEvent.participants?.length || 0}/{selectedEvent.maxParticipants || '∞'})</h3>
                <div className="space-y-2">
                  {selectedEvent.participants?.map((p, i) => (
                    <div key={p.id} className="p-4 bg-emerald-50/30 rounded-2xl font-bold text-emerald-900 flex justify-between items-center group/item transition-colors hover:bg-emerald-50">
                      <span>{i + 1}. {p.name} {p.note && <span className="text-xs font-normal text-emerald-600 bg-white px-2 py-0.5 rounded-lg ml-1 border border-emerald-50">🦴 {p.note}</span>}</span>
                      <button onClick={() => setCancelTarget(p)} className="text-xs text-gray-400 hover:text-red-500 font-black px-2 py-1 rounded-md opacity-0 group-hover/item:opacity-100 transition-opacity">{currentMode === AppMode.ADMIN ? '移除' : '取消'}</button>
                    </div>
                  ))}
                </div>
                {!showHistory && (
                  <form onSubmit={handleJoinEvent} className="mt-8 bg-emerald-600 p-8 rounded-[2rem] space-y-4 shadow-lg">
                    <h4 className="text-white font-black text-xl mb-2 flex items-center gap-2">🐾 加入這場探險</h4>
                    <input required placeholder="暱稱" value={joinName} onChange={(e) => setJoinName(e.target.value)} className="w-full px-6 py-4 rounded-2xl font-bold text-gray-900 outline-none focus:ring-4 focus:ring-emerald-400 transition-all" />
                    <input placeholder="想說的話 (選填)" value={joinNote} onChange={(e) => setJoinNote(e.target.value)} className="w-full px-6 py-4 rounded-2xl font-bold text-gray-900 outline-none focus:ring-4 focus:ring-emerald-400 transition-all" />
                    {selectedEvent.enableDonation && (
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-400 font-bold">❤️ NT$</span>
                        <input type="number" placeholder="自由樂捐金額" value={joinDonation} onChange={(e) => setJoinDonation(e.target.value)} className="w-full pl-20 pr-6 py-4 rounded-2xl font-bold bg-orange-50 text-orange-900 outline-none focus:ring-4 focus:ring-orange-200 transition-all" />
                      </div>
                    )}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-white text-emerald-700 py-4 rounded-2xl font-black text-lg shadow-[0_6px_0_0_#064e3b] active:translate-y-[6px] active:shadow-none active:scale-[0.98] transition-all disabled:opacity-50">確認報名</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : isCreating ? (
          <EventForm onSubmit={handleCreateEvent} onCancel={() => setIsCreating(false)} isSubmitting={isSubmitting} />
        ) : (
          <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-end flex-wrap gap-4">
              <div>
                <h2 className="text-3xl font-black text-emerald-900 tracking-tight">{showHistory ? '📜 歷史足跡' : '🦕 正在進行的探險'}</h2>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setShowHistory(false)} className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all ${!showHistory ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>進行中</button>
                  <button onClick={() => setShowHistory(true)} className={`text-sm font-bold px-4 py-1.5 rounded-full transition-all ${showHistory ? 'bg-gray-200 text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>歷史足跡</button>
                </div>
              </div>
              {currentMode === AppMode.ADMIN && (
                <button onClick={() => setIsCreating(true)} className="bg-emerald-500 text-white py-3 px-6 rounded-2xl font-black shadow-[0_4px_0_0_#065f46] hover:bg-emerald-600 active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2">
                  <span className="text-xl">🥚</span> 發起聚首
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayEvents.length > 0 ? (
                  displayEvents.map(e => (
                    <EventCard key={e.id} event={{ ...e, dateTimeFormatted: formatTWDate(e.dateTime) }} mode={currentMode} currentUserId={user.uid} isHistory={showHistory} onView={setSelectedEventId} onDelete={id => setDeleteConfirmationId(id)} onWish={() => handleToggleWish(e.id, e.wishers)} />
                  ))
              ) : (
                  <div className="col-span-1 md:col-span-2 text-center py-20 bg-white/50 rounded-[3rem] border-4 border-dashed border-gray-200/50">
                      <div className="text-6xl mb-4 opacity-10">🦕</div>
                      <p className="font-bold text-gray-300">目前沒有相關足跡...</p>
                  </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md py-4 text-center border-t border-emerald-50 text-xs font-black text-emerald-300 tracking-widest">DINOEVENT 2024</footer>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="確定要取消報名？">
         <div className="space-y-4">
             <p className="font-bold text-gray-700">{cancelTarget?.name}，真的不來了嗎？</p>
             <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase">取消原因 (必填)</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="生病了、有事、恐龍蛋要孵化了..." className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 outline-none focus:border-red-400 transition-colors" rows={3} />
             </div>
             <button onClick={handleCancelRegistration} disabled={!cancelReason.trim()} className="w-full bg-red-500 text-white font-black py-4 rounded-xl shadow-[0_4px_0_0_#991b1b] active:translate-y-[4px] active:shadow-none transition-all disabled:opacity-50">確認取消 🌪️</button>
         </div>
      </Modal>

      <Modal isOpen={!!deleteConfirmationId} onClose={() => setDeleteConfirmationId(null)} title="確認刪除">
        <div className="space-y-6">
            <p className="font-bold text-gray-600">確定要取消這場聚首嗎？所有資料將無法復原。</p>
            <button onClick={handleDeleteEvent} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black shadow-[0_4px_0_0_#991b1b] active:translate-y-[4px] active:shadow-none transition-all">確定刪除 🗑️</button>
        </div>
      </Modal>
    </div>
  );
};

export default App;

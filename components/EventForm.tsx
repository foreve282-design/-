
import React, { useState } from 'react';
import { Event } from '../types';

interface EventFormProps {
  onSubmit: (data: Omit<Event, 'id' | 'createdAt' | 'participants'>) => void;
  onCancel: () => void;
  initialData?: Event;
}

const EventForm: React.FC<EventFormProps> = ({ onSubmit, onCancel, initialData }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    dateTime: initialData?.dateTime || '',
    locationName: initialData?.locationName || '',
    locationAddress: initialData?.locationAddress || '',
    locationLink: initialData?.locationLink || '',
    content: initialData?.content || '',
    note: initialData?.note || '',
    maxParticipants: initialData?.maxParticipants || 12,
  });

  const [isDetecting, setIsDetecting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
          locationName: prev.locationName || '我的目前位置',
          locationLink: geoLink
        }));
        setIsDetecting(false);
      },
      (error) => {
        console.error(error);
        alert("偵測失敗，請手動輸入或檢查權限設定。");
        setIsDetecting(false);
      }
    );
  };

  const handleSearchOnMap = () => {
    const query = formData.locationAddress || formData.locationName;
    if (!query) {
      alert("請先輸入地點名稱或地址喔！");
      return;
    }
    const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank');
    // 如果目前沒有連結，自動幫他填入搜尋連結
    if (!formData.locationLink) {
      setFormData(prev => ({ ...prev, locationLink: searchUrl }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-[2rem] border-4 border-emerald-100 shadow-xl bounce-in">
      <h2 className="text-2xl font-black text-emerald-900 mb-6 flex items-center gap-2">
        <span className="text-3xl">🥚</span> {initialData ? '修改探險計畫' : '發起新的聚首'}
      </h2>
      
      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">計畫名稱</label>
        <input
          required
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="例如：草食系桌遊團"
          className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">出發時間</label>
        <input
          required
          type="datetime-local"
          name="dateTime"
          value={formData.dateTime}
          onChange={handleChange}
          className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">巢穴地點</label>
          <input
            required
            name="locationName"
            value={formData.locationName}
            onChange={handleChange}
            placeholder="地點名稱"
            className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
          />
          <button
            type="button"
            onClick={handleDetectLocation}
            className="absolute right-3 bottom-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold hover:bg-emerald-200 transition-colors"
          >
            {isDetecting ? '偵測中...' : '📍 偵測目前'}
          </button>
        </div>
        <div>
          <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">探險隊上限</label>
          <input
            type="number"
            name="maxParticipants"
            min="1"
            value={formData.maxParticipants}
            onChange={(e) => setFormData(p => ({ ...p, maxParticipants: parseInt(e.target.value) }))}
            className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">座標詳情</label>
        <input
          name="locationAddress"
          value={formData.locationAddress}
          onChange={handleChange}
          placeholder="詳細地址"
          className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">地圖雷達 (Google Maps)</label>
        <div className="flex gap-2">
          <input
            name="locationLink"
            value={formData.locationLink}
            onChange={handleChange}
            placeholder="連結網址 (選填，可點右側搜尋產生)"
            className="flex-1 px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
          />
          <button
            type="button"
            onClick={handleSearchOnMap}
            className="bg-orange-100 text-orange-600 px-4 py-3 rounded-2xl font-bold hover:bg-orange-200 transition-colors"
            title="在地圖中尋找"
          >
            🔍
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">探險簡報</label>
        <textarea
          name="content"
          value={formData.content}
          onChange={handleChange}
          rows={3}
          placeholder="我們要去做什麼呢？"
          className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-emerald-700 mb-2 ml-1">特別叮嚀</label>
        <input
          name="note"
          value={formData.note}
          onChange={handleChange}
          placeholder="例如：帶上你的肉食朋友"
          className="w-full px-5 py-3 rounded-2xl border-2 border-emerald-50 focus:border-emerald-500 bg-emerald-50/30 outline-none font-bold text-gray-900 placeholder:text-emerald-300 transition-all"
        />
      </div>

      <div className="flex gap-4 pt-6">
        <button
          type="submit"
          className="flex-1 bg-emerald-500 text-white py-4 px-6 rounded-2xl font-black text-lg hover:bg-emerald-600 transition-all shadow-[0_6px_0_0_#065f46] active:translate-y-[6px] active:shadow-none"
        >
          發布計畫！
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-100 text-gray-500 py-4 px-8 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
        >
          先等等
        </button>
      </div>
    </form>
  );
};

export default EventForm;

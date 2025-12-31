
import React from 'react';
import { Event, AppMode } from '../types';

interface EventCardProps {
  event: Event;
  mode: AppMode;
  onView: (id: string) => void;
  onDelete?: (id: string) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, mode, onView, onDelete }) => {
  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_0_0_#d1fae5] border-2 border-emerald-100 overflow-hidden hover:translate-y-[-4px] transition-all duration-300 group">
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-emerald-900 leading-tight group-hover:text-emerald-600 transition-colors">🦕 {event.title}</h3>
          <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">
            {event.participants.length} 隻恐龍已加入
          </span>
        </div>
        
        <div className="space-y-2 mb-6 bg-emerald-50/50 p-3 rounded-2xl">
          <div className="flex items-center text-sm text-emerald-700 font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {event.dateTime}
          </div>
          <div className="flex items-center text-sm text-emerald-700 font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {event.locationName}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onView(event.id)}
            className="flex-1 bg-emerald-500 text-white py-3 px-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-[0_4px_0_0_#065f46] active:shadow-none active:translate-y-[4px]"
          >
            查看地圖
          </button>
          {mode === AppMode.ADMIN && onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="bg-red-100 text-red-600 p-3 rounded-2xl hover:bg-red-200 transition-colors"
              title="撤銷聚首"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventCard;

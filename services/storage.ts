
import { Event } from '../types';
import { INITIAL_EVENTS } from '../constants';

const STORAGE_KEY = 'quick_event_data';

export const storageService = {
  getEvents: (): Event[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_EVENTS));
      return INITIAL_EVENTS;
    }
    return JSON.parse(data);
  },

  saveEvents: (events: Event[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  },

  addEvent: (event: Event): void => {
    const events = storageService.getEvents();
    storageService.saveEvents([event, ...events]);
  },

  updateEvent: (updatedEvent: Event): void => {
    const events = storageService.getEvents();
    const newEvents = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    storageService.saveEvents(newEvents);
  },

  deleteEvent: (id: string): void => {
    const events = storageService.getEvents();
    storageService.saveEvents(events.filter(e => e.id !== id));
  }
};

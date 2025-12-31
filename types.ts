
export interface Participant {
  id: string;
  name: string;
  note?: string;
}

export interface Event {
  id: string;
  title: string;
  dateTime: string;
  locationName: string;
  locationAddress: string;
  locationLink: string;
  content: string;
  participants: Participant[];
  maxParticipants?: number;
  note: string;
  createdAt: number;
}

export enum AppMode {
  GUEST = 'GUEST',
  ADMIN = 'ADMIN'
}

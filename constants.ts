
import { Event } from './types';

export const INITIAL_EVENTS: Event[] = [
  {
    id: '1',
    title: '桌遊聚會 - 派對與策略',
    dateTime: '2024-11-12T19:30',
    locationName: '華生家',
    locationAddress: '403台中市西區精誠二十二街1-1號',
    locationLink: 'https://maps.app.goo.gl/yHghpmTYyNSMbSA98',
    content: '歡迎大家來玩！這次會開一些輕鬆的派對遊戲，如果人夠多就開阿瓦隆。',
    participants: [
      { id: 'p1', name: 'W' },
      { id: 'p2', name: '崔' },
      { id: 'p3', name: 'NASH' },
      { id: 'p4', name: 'U蕾' },
      { id: 'p5', name: 'ROLY' }
    ],
    maxParticipants: 12,
    note: '滿 9 人即開局，報名請早！',
    createdAt: Date.now()
  }
];

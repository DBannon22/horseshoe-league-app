import { generateSchedule } from './scheduler';
import type { Player } from './types';

export interface GenerateRequest {
  players: Player[];
  startDate: string;
  gamesPerNight: number;
  seed: number;
}

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { players, startDate, gamesPerNight, seed } = e.data;
  (self as unknown as Worker).postMessage(generateSchedule(players, startDate, gamesPerNight, seed));
};

import type { GenerateRequest } from './scheduleWorker';
import type { Schedule } from './types';

/** Runs the optimizer off the main thread so the page stays responsive. */
export function generateInWorker(request: GenerateRequest): Promise<Schedule> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./scheduleWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<Schedule>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(new Error(e.message || 'Schedule generation failed'));
      worker.terminate();
    };
    worker.postMessage(request);
  });
}

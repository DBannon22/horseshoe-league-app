import type { FirebaseOptions } from 'firebase/app';

/**
 * Web app config from Firebase console → Project settings → General → Your apps.
 * These values are not secret; access is controlled by firestore.rules.
 *
 * Set this to null to run in local mode (data kept in one browser, no login).
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyB8DV7ByptWaGgKalIwb8PDLCvKhCGiwTE',
  authDomain: 'horseshoe-league.firebaseapp.com',
  projectId: 'horseshoe-league',
  storageBucket: 'horseshoe-league.firebasestorage.app',
  messagingSenderId: '632304921060',
  appId: '1:632304921060:web:25cd6edc37349603073ff1',
  measurementId: 'G-2PQSD8MEXH',
};

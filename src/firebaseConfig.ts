import type { FirebaseOptions } from 'firebase/app';

/**
 * Paste the web app config from Firebase console → Project settings → General →
 * Your apps (see README “Admin login setup”). These values are not secret; access
 * is controlled by firestore.rules.
 *
 * While this is null the app runs in local mode: data is kept in this browser only
 * and there is no login.
 */
export const firebaseConfig: FirebaseOptions | null = null;

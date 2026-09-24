import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebaseConfig';
import type { League } from './types';

/*
 * The whole league lives in one Firestore document, leagues/main, stored as a
 * JSON string. Anyone can read it; only users with a document at admins/{uid}
 * can write it (enforced by firestore.rules, not just the UI).
 */

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === 'true';

function createCloud() {
  const config = useEmulator
    ? { apiKey: 'demo-key', projectId: 'demo-horseshoe', authDomain: 'demo-horseshoe.firebaseapp.com' }
    : firebaseConfig;
  if (!config) return null;

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  const leagueDoc = doc(db, 'leagues', 'main');

  return {
    watchLeague(onData: (league: League | null) => void, onError: (e: Error) => void): () => void {
      return onSnapshot(
        leagueDoc,
        (snap) => onData(snap.exists() ? (JSON.parse(snap.data().data) as League) : null),
        onError,
      );
    },
    async saveLeague(league: League): Promise<void> {
      await setDoc(leagueDoc, {
        data: JSON.stringify(league),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid ?? null,
      });
    },
    watchAuth(callback: (user: User | null) => void): () => void {
      return onAuthStateChanged(auth, callback);
    },
    async isAdmin(uid: string): Promise<boolean> {
      try {
        return (await getDoc(doc(db, 'admins', uid))).exists();
      } catch {
        return false;
      }
    },
    async signIn(email: string, password: string): Promise<void> {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signOut: () => signOut(auth),
  };
}

export const cloud = createCloud();

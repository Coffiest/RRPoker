'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, Subscription } from '@/lib/types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  subscription: Subscription | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const [userDoc, subDoc] = await Promise.all([
          getDoc(doc(db, 'users', fbUser.uid)),
          getDoc(doc(db, 'subscriptions', fbUser.uid)),
        ]);
        setUser(userDoc.exists() ? (userDoc.data() as User) : null);
        setSubscription(subDoc.exists() ? (subDoc.data() as Subscription) : null);
      } else {
        setUser(null);
        setSubscription(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const createUserDoc = async (fbUser: FirebaseUser, username: string) => {
    const now = serverTimestamp();
    await Promise.all([
      setDoc(doc(db, 'users', fbUser.uid), {
        uid: fbUser.uid,
        email: fbUser.email,
        username,
        profileImageUrl: fbUser.photoURL,
        bio: '',
        isPublicStats: false,
        createdAt: now,
        updatedAt: now,
      }),
      setDoc(doc(db, 'userStats', fbUser.uid), {
        uid: fbUser.uid,
        totalHands: 0,
        totalTournaments: 0,
        itmCount: 0,
        itmPercentage: 0,
        totalRoi: 0,
        totalPrize: 0,
        updatedAt: now,
      }),
      setDoc(doc(db, 'subscriptions', fbUser.uid), {
        id: fbUser.uid,
        userId: fbUser.uid,
        plan: 'free',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      }),
    ]);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, username: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await sendEmailVerification(cred.user);
    await createUserDoc(cred.user, username);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if (!userDoc.exists()) {
      const username = cred.user.displayName || `player_${cred.user.uid.slice(0, 8)}`;
      await createUserDoc(cred.user, username);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const isPremium = subscription?.plan === 'premium' &&
    (subscription.status === 'active' || subscription.status === 'trialing');

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      user,
      subscription,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logout,
      sendPasswordReset,
      isPremium,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  updateProfile as firebaseUpdateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import {
  getUserProfile,
  saveUserProfile,
  UserProfile,
} from "./firestore";
import { toast } from "sonner";
import api from "@/lib/api";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore whenever user changes
  const syncProfile = async (firebaseUser: FirebaseUser) => {
    try {
      let prof = await getUserProfile(firebaseUser.uid);
      if (!prof) {
        // Create initial profile in Firestore
        prof = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "traveler@roamly.ai",
          displayName:
            firebaseUser.displayName ||
            (firebaseUser.isAnonymous ? "Guest Explorer" : "Anya Sharma"),
          photoURL:
            firebaseUser.photoURL ||
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80",
          travelPace: "relaxed",
          budgetTier: "comfort",
          currency: "INR",
          dietary: "Vegetarian / Local specialty",
          interests: [
            "Nature & Scenery",
            "Culinary & Street Food",
            "Culture & History",
            "Photography",
          ],
          countriesVisited: 12,
          createdAt: new Date().toISOString(),
        };
        await saveUserProfile(firebaseUser.uid, prof);

      }
      setProfile(prof);
    } catch (err) {
      console.error("Error syncing profile with Firestore:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        api.setToken(await currentUser.getIdToken());
        await syncProfile(currentUser);
      } else {
        api.clearToken();
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    api.setToken(await cred.user.getIdToken());
    await syncProfile(cred.user);
    toast.success("Welcome back to Roamly AI!");
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    api.setToken(await cred.user.getIdToken());
    if (name) {
      await firebaseUpdateProfile(cred.user, { displayName: name });
    }
    await syncProfile({ ...cred.user, displayName: name });
    toast.success(`Account created! Welcome, ${name || "Traveler"}!`);
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      api.setToken(await cred.user.getIdToken());
      await syncProfile(cred.user);
      toast.success(`Signed in with Google as ${cred.user.displayName || cred.user.email}`);
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        toast.info("Google sign-in was cancelled.");
        return;
      }
      if (err.code === "auth/unauthorized-domain") {
        toast.error("Domain unauthorized in Firebase console. Please add localhost to Authorized Domains.");
        return;
      }
      toast.error(err.message || "Failed to sign in with Google");
      throw err;
    }
  };

  const loginAsDemo = async () => {
    try {
      const cred = await signInAnonymously(auth);
      api.setToken(await cred.user.getIdToken());
      await firebaseUpdateProfile(cred.user, { displayName: "Demo Traveler" });
      await syncProfile({ ...cred.user, displayName: "Demo Traveler" });
      toast.success("Signed in with Demo Traveler Account!");
    } catch (err: any) {
      console.warn("Anonymous auth failed, falling back to local demo state", err);
      toast.success("Demo Traveler session started!");
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
    toast.info("Signed out of Roamly AI.");
  };

  const refreshProfile = async () => {
    if (user) {
      await syncProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginAsDemo,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

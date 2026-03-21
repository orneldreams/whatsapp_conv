import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, firestore } from "../services/firebase";

const AuthContext = createContext(null);

function toProfileFromUser(user) {
  const displayName = user?.displayName || "";
  const firstName = displayName.trim().split(" ")[0] || "";

  return {
    uid: user?.uid || "",
    email: user?.email || "",
    displayName,
    firstName
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const baseProfile = toProfileFromUser(nextUser);

      try {
        const profileRef = doc(firestore, "pasteurs", nextUser.uid);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const data = profileSnap.data() || {};
          setProfile({
            ...baseProfile,
            firstName: data.firstName || baseProfile.firstName,
            lastName: data.lastName || "",
            phone: data.phone || "",
            country: data.country || ""
          });
        } else {
          setProfile(baseProfile);
        }
      } catch (_error) {
        setProfile(baseProfile);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    return signOut(auth);
  }

  async function forgotPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function saveProfile({ firstName, lastName, phone, country }) {
    if (!auth.currentUser) {
      throw new Error("Utilisateur non connecte");
    }

    const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const profileRef = doc(firestore, "pasteurs", auth.currentUser.uid);
    const existingProfile = await getDoc(profileRef);

    if (displayName) {
      await updateProfile(auth.currentUser, { displayName });
    }

    await setDoc(
      profileRef,
      {
        firstName: firstName || "",
        lastName: lastName || "",
        phone: phone || "",
        country: country || "",
        email: auth.currentUser.email || "",
        displayName,
        updatedAt: serverTimestamp(),
        ...(existingProfile.exists() ? {} : { createdAt: serverTimestamp() })
      },
      { merge: true }
    );

    setProfile((prev) => ({
      ...(prev || {}),
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || "",
      displayName,
      firstName: firstName || "",
      lastName: lastName || "",
      phone: phone || "",
      country: country || ""
    }));
  }

  async function changePassword(nextPassword) {
    if (!auth.currentUser) {
      throw new Error("Utilisateur non connecte");
    }

    return updatePassword(auth.currentUser, nextPassword);
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      forgotPassword,
      saveProfile,
      changePassword
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

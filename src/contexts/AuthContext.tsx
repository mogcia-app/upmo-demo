"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface UserRole {
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'pending';
  department?: string;
  position?: string;
}

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebaseが初期化されていない場合（環境変数が設定されていない場合）
    if (!auth) {
      console.warn('Firebase Auth is not initialized. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Firestore からユーザーロール情報を取得
        if (!db) {
          console.warn('Firestore is not initialized. User role cannot be fetched.');
          setUserRole({
            role: 'user',
            status: 'active'
          });
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole({
              role: userData.role || 'user',
              status: userData.status || 'active',
              department: userData.department,
              position: userData.position
            });
          } else {
            // ユーザーデータが存在しない場合はデフォルト値を設定
            setUserRole({
              role: 'user',
              status: 'active'
            });
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole({
            role: 'user',
            status: 'active'
          });
        }
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    if (!auth) {
      console.warn('Firebase Auth is not initialized. Cannot sign out.');
      return;
    }
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = {
    user,
    userRole,
    loading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

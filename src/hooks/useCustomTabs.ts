"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CustomComponent } from "../types/components";

export interface CustomTab {
  id: string;
  title: string;
  icon: string;
  route: string;
  userId: string;
  components: CustomComponent[]; // カスタムコンポーネントの配列
  createdAt: Date;
  updatedAt?: Date;
}

export const useCustomTabs = () => {
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // 認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setCustomTabs([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // カスタムタブを取得
  const fetchCustomTabs = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    
    try {
      const q = query(
        collection(db, "customTabs"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const tabs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as CustomTab[];
      
      setCustomTabs(tabs);
    } catch (error) {
      console.error("Error fetching custom tabs:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 日本語タイトルを英語スラッグに変換する関数
  const createSlug = (title: string) => {
    // 日本語の場合は英語に変換
    const japaneseToEnglish: { [key: string]: string } = {
      '営業進捗': 'sales-progress',
      'カレンダー': 'calendar',
      '売上管理': 'sales-management',
      'プロジェクト管理': 'project-management',
      'タスク管理': 'task-management',
      '顧客管理': 'customer-management',
      '在庫管理': 'inventory-management',
      '財務管理': 'finance-management',
      '人事管理': 'hr-management',
      'マーケティング': 'marketing',
      'レポート': 'reports',
      '分析': 'analytics',
      '設定': 'settings',
      'ダッシュボード': 'dashboard',
      '通知': 'notifications',
      '履歴': 'history'
    };

    // 日本語がマッピングにある場合はそれを使用
    if (japaneseToEnglish[title]) {
      return japaneseToEnglish[title];
    }

    // それ以外は英語の場合はそのまま、日本語の場合はランダムなIDを生成
    if (/[ひらがなカタカナ一-龯]/.test(title)) {
      return `custom-${Date.now().toString(36)}`;
    }

    // 英語の場合はスペースをハイフンに変換
    return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  // 新しいカスタムタブを追加
  const addCustomTab = async (title: string, icon: string) => {
    if (!userId) {
      console.error("User not authenticated");
      return;
    }
    
    try {
      const slug = createSlug(title);
      const route = `/custom/${slug}`;
      const newTab = {
        title,
        icon,
        route,
        userId,
        components: [], // 初期状態では空のコンポーネント配列
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, "customTabs"), newTab);
      const addedTab = { id: docRef.id, ...newTab };
      
      setCustomTabs(prev => [addedTab, ...prev]);
      return addedTab;
    } catch (error) {
      console.error("Error adding custom tab:", error);
      throw error;
    }
  };

  // カスタムタブを削除
  const deleteCustomTab = async (tabId: string) => {
    if (!userId) {
      console.error("User not authenticated");
      return;
    }
    
    try {
      await deleteDoc(doc(db, "customTabs", tabId));
      setCustomTabs(prev => prev.filter(tab => tab.id !== tabId));
    } catch (error) {
      console.error("Error deleting custom tab:", error);
    }
  };

  // カスタムタブのコンポーネントを更新
  const updateCustomTabComponents = async (tabId: string, components: CustomComponent[]) => {
    if (!userId) {
      console.error("User not authenticated");
      return;
    }
    
    try {
      await updateDoc(doc(db, "customTabs", tabId), {
        components: components,
        updatedAt: new Date(),
      });
      
      // ローカル状態も更新
      setCustomTabs(prev => prev.map(tab => 
        tab.id === tabId 
          ? { ...tab, components: components, updatedAt: new Date() }
          : tab
      ));
    } catch (error) {
      console.error("Error updating custom tab components:", error);
    }
  };

  // 特定のカスタムタブを取得
  const getCustomTabByRoute = async (route: string): Promise<CustomTab | null> => {
    if (!userId) {
      console.error("User not authenticated");
      return null;
    }
    
    try {
      const q = query(
        collection(db, "customTabs"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const tab = querySnapshot.docs.find(doc => doc.data().route === route);
      if (tab) {
        const data = tab.data();
        return {
          id: tab.id,
          title: data.title,
          icon: data.icon,
          route: data.route,
          userId: data.userId,
          components: data.components || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting custom tab by route:", error);
      return null;
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCustomTabs();
    }
  }, [userId, fetchCustomTabs]);

  return {
    customTabs,
    loading,
    addCustomTab,
    deleteCustomTab,
    updateCustomTabComponents,
    getCustomTabByRoute,
    refetch: fetchCustomTabs,
  };
};

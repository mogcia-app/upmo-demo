"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CustomComponent } from "../types/components";
import { createNotification } from "../utils/notifications";

export interface CustomTab {
  id: string;
  title: string;
  icon: string;
  route: string;
  userId: string;
  components: CustomComponent[]; // カスタムコンポーネントの配列
  isShared: boolean; // チーム全体に共有されているか
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
    if (!userId || !db) {
      setLoading(false);
      return;
    }
    
    try {
      // 自分のタブを取得
      const myTabsQuery = query(
        collection(db, "customTabs"),
        where("userId", "==", userId)
      );
      const myTabsSnapshot = await getDocs(myTabsQuery);
      
      // チーム全体に共有されたタブを取得（自分のタブ以外）
      const sharedTabsQuery = query(
        collection(db, "customTabs"),
        where("isShared", "==", true)
      );
      const sharedTabsSnapshot = await getDocs(sharedTabsQuery);
      
      // 両方の結果をマージ
      const allDocs = [...myTabsSnapshot.docs, ...sharedTabsSnapshot.docs];
      
      // 重複を除去（同じIDのタブが複数ある場合）
      const uniqueDocs = Array.from(
        new Map(allDocs.map(doc => [doc.id, doc])).values()
      );
      
      // クライアント側でソート（Firestoreのインデックス問題を回避）
      const tabs = uniqueDocs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          isShared: doc.data().isShared || false,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as CustomTab[];
      
      // 作成日時で降順ソート
      tabs.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      
      setCustomTabs(tabs);
    } catch (error: any) {
      console.error("Error fetching custom tabs:", error);
      // インデックスエラーの場合は空配列を返す
      if (error.code === 'failed-precondition') {
        console.warn("Firestore index may be missing. Please create a composite index for customTabs collection.");
        setCustomTabs([]);
      }
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
  const addCustomTab = async (title: string, icon: string, isShared: boolean = false) => {
    if (!userId) {
      const error = new Error("User not authenticated");
      console.error(error.message);
      throw error;
    }
    
    try {
      const slug = createSlug(title);
      const route = `/custom/${slug}`;
      const newTab = {
        title,
        icon,
        route,
        userId,
        isShared: isShared || false,
        components: [], // 初期状態では空のコンポーネント配列
        createdAt: new Date(),
      };

      const docRef = await addDoc(collection(db, "customTabs"), newTab);
      const addedTab = { id: docRef.id, ...newTab };
      setCustomTabs(prev => [addedTab, ...prev]);
      
      // 通知を作成
      if (auth.currentUser) {
        await createNotification(auth.currentUser, {
          type: 'create',
          pageName: 'カスタムページ',
          pageUrl: route,
          title: `カスタムページ「${title}」が追加されました`,
          action: 'created',
        });
      }
      
      return addedTab;
    } catch (error: any) {
      console.error("Error adding custom tab:", error);
      // 権限エラーの場合は詳細を表示
      if (error.code === 'permission-denied') {
        throw new Error("カスタムタブの追加に失敗しました。権限を確認してください。");
      }
      throw error;
    }
  };

  // カスタムタブを削除（所有者のみ可能）
  const deleteCustomTab = async (tabId: string) => {
    if (!userId) {
      console.error("User not authenticated");
      return;
    }
    
    try {
      // タブが自分のものか確認
      const tab = customTabs.find(t => t.id === tabId);
      if (!tab) {
        alert("タブが見つかりません。");
        return;
      }
      
      if (tab.userId !== userId) {
        alert("このタブは削除できません。所有者のみが削除できます。");
        return;
      }
      
      await deleteDoc(doc(db, "customTabs", tabId));
      setCustomTabs(prev => prev.filter(tab => tab.id !== tabId));
    } catch (error: any) {
      console.error("Error deleting custom tab:", error);
      // 権限エラーの場合はユーザーに通知
      if (error.code === 'permission-denied') {
        alert("カスタムタブの削除に失敗しました。権限を確認してください。");
      }
    }
  };

  // カスタムタブのコンポーネントを更新（所有者のみ可能）
  const updateCustomTabComponents = async (tabId: string, components: CustomComponent[]) => {
    if (!userId) {
      console.error("User not authenticated");
      throw new Error("ユーザーが認証されていません。");
    }
    
    try {
      // タブが自分のものか確認
      const tab = customTabs.find(t => t.id === tabId);
      if (!tab) {
        throw new Error("タブが見つかりません。");
      }
      
      if (tab.userId !== userId) {
        throw new Error("このタブは編集できません。所有者のみが編集できます。");
      }
      
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
      
      // 通知を作成
      if (auth.currentUser) {
        await createNotification(auth.currentUser, {
          type: 'update',
          pageName: 'カスタムページ',
          pageUrl: tab.route,
          title: `カスタムページ「${tab.title}」が編集されました`,
          action: 'updated',
        });
      }
    } catch (error: any) {
      console.error("Error updating custom tab components:", error);
      // 権限エラーの場合はユーザーに通知
      if (error.code === 'permission-denied') {
        throw new Error("カスタムタブの更新に失敗しました。権限を確認してください。");
      }
      throw error;
    }
  };

  // 特定のカスタムタブを取得（自分のタブまたは共有タブ）
  const getCustomTabByRoute = useCallback(async (route: string): Promise<CustomTab | null> => {
    if (!userId || !db) {
      console.error("User not authenticated or db not available");
      return null;
    }
    
    try {
      // 自分のタブを検索
      const myTabsQuery = query(
        collection(db, "customTabs"),
        where("userId", "==", userId)
      );
      const myTabsSnapshot = await getDocs(myTabsQuery);
      let tab = myTabsSnapshot.docs.find(doc => doc.data().route === route);
      
      // 自分のタブで見つからない場合、共有タブを検索
      if (!tab) {
        const sharedTabsQuery = query(
          collection(db, "customTabs"),
          where("isShared", "==", true)
        );
        const sharedTabsSnapshot = await getDocs(sharedTabsQuery);
        tab = sharedTabsSnapshot.docs.find(doc => doc.data().route === route);
      }
      
      if (tab) {
        const data = tab.data();
        return {
          id: tab.id,
          title: data.title,
          icon: data.icon,
          route: data.route,
          userId: data.userId,
          isShared: data.isShared || false,
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
  }, [userId]);

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

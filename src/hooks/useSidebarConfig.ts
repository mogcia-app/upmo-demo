"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { AVAILABLE_MENU_ITEMS, AvailableMenuItem, SidebarConfig, SidebarMenuItem } from "../types/sidebar";

// 型を再エクスポート（後方互換性のため）
export type { SidebarMenuItem, SidebarConfig, AvailableMenuItem };

const DEFAULT_COMMON_MENU_ITEMS: SidebarMenuItem[] = [
  { id: "todo", name: "TODOリスト", icon: "•", href: "/todo", category: "other", enabled: true, order: 1 },
  { id: "progress-notes", name: "メモ", icon: "•", href: "/sales/progress-notes", category: "sales", enabled: true, order: 2 },
  { id: "contracts", name: "契約書管理", icon: "•", href: "/admin/contracts", category: "document", enabled: true, order: 3 },
  { id: "users", name: "利用者管理", icon: "•", href: "/admin/users", category: "other", enabled: true, order: 4 },
  { id: "company-info", name: "会社情報", icon: "•", href: "/admin/company", category: "other", enabled: true, order: 5 },
  { id: "invoice", name: "請求書発行", icon: "•", href: "/admin/invoice", category: "other", enabled: true, order: 6 },
  { id: "calendar", name: "カレンダー", icon: "•", href: "/calendar", category: "other", enabled: true, order: 7 },
];

const DEFAULT_ADMIN_MENU_ITEMS: SidebarMenuItem[] = [
];

export const useSidebarConfig = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<SidebarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [companyName, setCompanyName] = useState<string>("default");

  // ユーザーのcompanyNameを取得
  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!user || !db) {
        setCompanyName("default");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCompanyName(userData?.companyName || "default");
        } else {
          setCompanyName("default");
        }
      } catch (err) {
        console.error("Error fetching company name:", err);
        setCompanyName("default");
      }
    };

    fetchCompanyName();
  }, [user]);

  // サイドバー設定を取得
  const fetchSidebarConfig = useCallback(async () => {
    if (!db || !companyName) {
      setLoading(false);
      return;
    }

    try {
      const configDocRef = doc(db, "sidebarConfig", companyName);
      const configDoc = await getDoc(configDocRef);

      if (configDoc.exists()) {
        const data = configDoc.data();
        
        // contractsがadminMenuItemsにある場合はcommonMenuItemsに移動
        // commonMenuItemsが空の配列の場合はデフォルトを使用
        let commonMenuItems = (data.commonMenuItems && data.commonMenuItems.length > 0) 
          ? data.commonMenuItems 
          : DEFAULT_COMMON_MENU_ITEMS;
        let adminMenuItems = data.adminMenuItems || DEFAULT_ADMIN_MENU_ITEMS;
        
        // contractsがadminMenuItemsにあるかチェック
        const contractsInAdmin = adminMenuItems.find((item: any) => item.id === 'contracts');
        const contractsInCommon = commonMenuItems.find((item: any) => item.id === 'contracts');
        
        if (contractsInAdmin && !contractsInCommon) {
          // contractsをadminMenuItemsから削除してcommonMenuItemsに追加
          adminMenuItems = adminMenuItems.filter((item: any) => item.id !== 'contracts');
          // commonMenuItemsにcontractsがなければ追加
          if (!commonMenuItems.find((item: any) => item.id === 'contracts')) {
            commonMenuItems = [...commonMenuItems, {
              id: "contracts",
              name: "契約書管理",
              icon: "•",
              href: "/admin/contracts",
              enabled: true,
              order: 6
            }];
          }
        }
        
        // usersがadminMenuItemsにある場合はcommonMenuItemsに移動
        const usersInAdmin = adminMenuItems.find((item: any) => item.id === 'users');
        const usersInCommon = commonMenuItems.find((item: any) => item.id === 'users');
        
        if (usersInAdmin && !usersInCommon) {
          // usersをadminMenuItemsから削除してcommonMenuItemsに追加
          adminMenuItems = adminMenuItems.filter((item: any) => item.id !== 'users');
          // commonMenuItemsにusersがなければ追加
          if (!commonMenuItems.find((item: any) => item.id === 'users')) {
            commonMenuItems = [...commonMenuItems, {
              id: "users",
              name: "利用者管理",
              icon: "•",
              href: "/admin/users",
              enabled: true,
              order: 7
            }];
          }
        }
        
        setConfig({
          commonMenuItems: commonMenuItems,
          adminMenuItems: adminMenuItems,
          enabledMenuItems: data.enabledMenuItems || [], // 有効化された追加メニュー項目のIDリスト
          updatedAt: data.updatedAt?.toDate() || new Date(),
          updatedBy: data.updatedBy || "",
        });
      } else {
        // デフォルト設定を使用
        setConfig({
          commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
          adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
          enabledMenuItems: [], // 初期状態では何も有効化されていない
          updatedAt: new Date(),
          updatedBy: "",
        });
      }
      setError(null);
    } catch (err: any) {
      console.error("Error fetching sidebar config:", err);
      setError(err);
      // エラー時もデフォルト設定を使用
      setConfig({
        commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
        adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
        enabledMenuItems: [],
        updatedAt: new Date(),
        updatedBy: "",
      });
    } finally {
      setLoading(false);
    }
  }, [companyName]);

  // リアルタイムでサイドバー設定を監視
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // companyNameが取得されるまで待つ（初期値の"default"でも動作する）
    const configDocId = companyName || "default";
    console.log('[useSidebarConfig] Setting up snapshot for companyName:', companyName, 'docId:', configDocId);
    const configDocRef = doc(db, "sidebarConfig", configDocId);
    const defaultDocRef = doc(db, "sidebarConfig", "default");
    
    // まず会社名のドキュメントを取得
    const unsubscribe = onSnapshot(
      configDocRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[useSidebarConfig] Firestore data (company):', {
            id: snapshot.id,
            enabledMenuItems: data.enabledMenuItems,
            enabledMenuItemsLength: data.enabledMenuItems?.length || 0,
            commonMenuItemsLength: data.commonMenuItems?.length || 0,
            adminMenuItemsLength: data.adminMenuItems?.length || 0,
          });
          
          // contractsがadminMenuItemsにある場合はcommonMenuItemsに移動
          // commonMenuItemsが空の配列の場合はデフォルトを使用
          let commonMenuItems = (data.commonMenuItems && data.commonMenuItems.length > 0) 
            ? data.commonMenuItems 
            : DEFAULT_COMMON_MENU_ITEMS;
          let adminMenuItems = data.adminMenuItems || DEFAULT_ADMIN_MENU_ITEMS;
          
          // contractsがadminMenuItemsにあるかチェック
          const contractsInAdmin = adminMenuItems.find((item: any) => item.id === 'contracts');
          const contractsInCommon = commonMenuItems.find((item: any) => item.id === 'contracts');
          
          if (contractsInAdmin && !contractsInCommon) {
            // contractsをadminMenuItemsから削除してcommonMenuItemsに追加
            adminMenuItems = adminMenuItems.filter((item: any) => item.id !== 'contracts');
            // commonMenuItemsにcontractsがなければ追加
            if (!commonMenuItems.find((item: any) => item.id === 'contracts')) {
              commonMenuItems = [...commonMenuItems, {
                id: "contracts",
                name: "契約書管理",
                icon: "•",
                href: "/admin/contracts",
                enabled: true,
                order: 6
              }];
            }
          }
          
          // usersがadminMenuItemsにある場合はcommonMenuItemsに移動
          const usersInAdmin = adminMenuItems.find((item: any) => item.id === 'users');
          const usersInCommon = commonMenuItems.find((item: any) => item.id === 'users');
          
          if (usersInAdmin && !usersInCommon) {
            // usersをadminMenuItemsから削除してcommonMenuItemsに追加
            adminMenuItems = adminMenuItems.filter((item: any) => item.id !== 'users');
            // commonMenuItemsにusersがなければ追加
            if (!commonMenuItems.find((item: any) => item.id === 'users')) {
              commonMenuItems = [...commonMenuItems, {
                id: "users",
                name: "利用者管理",
                icon: "•",
                href: "/admin/users",
                enabled: true,
                order: 7
              }];
            }
          }
          
          // enabledMenuItemsが空の場合、defaultドキュメントから取得を試みる
          let enabledMenuItems = data.enabledMenuItems || [];
          if (enabledMenuItems.length === 0 && configDocId !== "default") {
            getDoc(defaultDocRef).then((defaultDoc) => {
              if (defaultDoc.exists()) {
                const defaultData = defaultDoc.data();
                enabledMenuItems = defaultData.enabledMenuItems || [];
                console.log('[useSidebarConfig] Fallback to default enabledMenuItems:', enabledMenuItems);
              }
              
              const configData = {
                commonMenuItems: commonMenuItems,
                adminMenuItems: adminMenuItems,
                enabledMenuItems: enabledMenuItems,
                updatedAt: data.updatedAt?.toDate() || new Date(),
                updatedBy: data.updatedBy || "",
              };
              console.log('[useSidebarConfig] Setting config (with fallback):', {
                enabledMenuItems: configData.enabledMenuItems,
                enabledMenuItemsLength: configData.enabledMenuItems.length,
              });
              setConfig(configData);
              setLoading(false);
              setError(null);
            }).catch((err) => {
              console.error('[useSidebarConfig] Error fetching default config:', err);
              const configData = {
                commonMenuItems: commonMenuItems,
                adminMenuItems: adminMenuItems,
                enabledMenuItems: enabledMenuItems,
                updatedAt: data.updatedAt?.toDate() || new Date(),
                updatedBy: data.updatedBy || "",
              };
              setConfig(configData);
              setLoading(false);
              setError(null);
            });
            return; // 非同期処理中はここで終了
          }
          
          const configData = {
            id: snapshot.id,
            commonMenuItems: commonMenuItems,
            adminMenuItems: adminMenuItems,
            enabledMenuItems: enabledMenuItems,
            updatedAt: data.updatedAt?.toDate() || new Date(),
            updatedBy: data.updatedBy || "",
          };
          console.log('[useSidebarConfig] Setting config:', {
            enabledMenuItems: configData.enabledMenuItems,
            enabledMenuItemsLength: configData.enabledMenuItems.length,
          });
          setConfig(configData);
        } else {
          // 会社名のドキュメントが存在しない場合、defaultドキュメントを取得
          if (configDocId !== "default") {
            getDoc(defaultDocRef).then((defaultDoc) => {
              if (defaultDoc.exists()) {
                const defaultData = defaultDoc.data();
                console.log('[useSidebarConfig] Using default config:', {
                  enabledMenuItems: defaultData.enabledMenuItems,
                  enabledMenuItemsLength: defaultData.enabledMenuItems?.length || 0,
                });
                
                const commonMenuItems = (defaultData.commonMenuItems && defaultData.commonMenuItems.length > 0) 
                  ? defaultData.commonMenuItems 
                  : DEFAULT_COMMON_MENU_ITEMS;
                const adminMenuItems = defaultData.adminMenuItems || DEFAULT_ADMIN_MENU_ITEMS;
                
                setConfig({
                  commonMenuItems: commonMenuItems,
                  adminMenuItems: adminMenuItems,
                  enabledMenuItems: defaultData.enabledMenuItems || [],
                  updatedAt: defaultData.updatedAt?.toDate() || new Date(),
                  updatedBy: defaultData.updatedBy || "",
                });
              } else {
                // デフォルト設定を使用
                setConfig({
                  commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
                  adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
                  enabledMenuItems: [],
                  updatedAt: new Date(),
                  updatedBy: "",
                });
              }
              setLoading(false);
              setError(null);
            }).catch((err) => {
              console.error('[useSidebarConfig] Error fetching default config:', err);
              // デフォルト設定を使用
              setConfig({
                commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
                adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
                enabledMenuItems: [],
                updatedAt: new Date(),
                updatedBy: "",
              });
              setLoading(false);
              setError(null);
            });
            return; // 非同期処理中はここで終了
          }
          
          // デフォルト設定を使用
          setConfig({
            commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
            adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
            enabledMenuItems: [],
            updatedAt: new Date(),
            updatedBy: "",
          });
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error listening to sidebar config:", err);
        setError(err);
        // エラー時もデフォルト設定を使用
        setConfig({
          commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
          adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
          enabledMenuItems: [],
          updatedAt: new Date(),
          updatedBy: "",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyName]);

  // 有効なメニューアイテムのみを取得（order順にソート）
  const getEnabledCommonMenuItems = useCallback((): SidebarMenuItem[] => {
    let items: SidebarMenuItem[];
    if (!config) {
      items = DEFAULT_COMMON_MENU_ITEMS.filter((item: any) => item.enabled);
    } else {
      // commonMenuItemsが空の場合はデフォルトを使用
      const menuItems = (config.commonMenuItems && config.commonMenuItems.length > 0)
        ? config.commonMenuItems
        : DEFAULT_COMMON_MENU_ITEMS;
      items = menuItems
        .filter((item: any) => item.enabled)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    // contractsが含まれていない場合は強制的に追加
    if (!items.find((item: any) => item.id === 'contracts')) {
      items = [...items, {
        id: "contracts",
        name: "契約書管理",
        icon: "•",
        href: "/admin/contracts",
        category: "document",
        enabled: true,
        order: 6
      }].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    // usersが含まれていない場合は強制的に追加
    if (!items.find((item: any) => item.id === 'users')) {
      items = [...items, {
        id: "users",
        name: "利用者招待",
        icon: "•",
        href: "/admin/users",
        category: "other",
        enabled: true,
        order: 7
      }].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    
    return items;
  }, [config]);

  const getEnabledAdminMenuItems = useCallback((): SidebarMenuItem[] => {
    if (!config) return DEFAULT_ADMIN_MENU_ITEMS.filter((item: any) => item.enabled);
    return config.adminMenuItems
      .filter((item: any) => item.enabled)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [config]);

  // 有効化された追加メニュー項目を取得（候補プールから）
  const getEnabledAdditionalMenuItems = useCallback((): AvailableMenuItem[] => {
    if (!config) {
      console.log('[useSidebarConfig] config is null');
      return [];
    }
    
    if (!config.enabledMenuItems || config.enabledMenuItems.length === 0) {
      console.log('[useSidebarConfig] enabledMenuItems is empty:', config.enabledMenuItems);
      return [];
    }
    
    console.log('[useSidebarConfig] enabledMenuItems:', config.enabledMenuItems);
    console.log('[useSidebarConfig] AVAILABLE_MENU_ITEMS count:', AVAILABLE_MENU_ITEMS.length);
    
    // 有効化されたIDリストに基づいて、候補プールから該当する項目を取得
    const filtered = AVAILABLE_MENU_ITEMS
      .filter((item: any) => (config.enabledMenuItems || []).includes(item.id))
      .sort((a, b) => {
        // カテゴリ順、次にorder順でソート
        const categoryOrder = ['sales', 'customer', 'inventory', 'finance', 'pdca', 'document', 'project', 'analytics', 'other'];
        const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        if (categoryDiff !== 0) return categoryDiff;
        return (a.order || 0) - (b.order || 0);
      });
    
    console.log('[useSidebarConfig] filtered items count:', filtered.length);
    return filtered;
  }, [config]);

  return {
    config,
    loading,
    error,
    getEnabledCommonMenuItems,
    getEnabledAdminMenuItems,
    getEnabledAdditionalMenuItems,
    refetch: fetchSidebarConfig,
  };
};


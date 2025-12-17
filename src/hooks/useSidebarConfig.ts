"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AVAILABLE_MENU_ITEMS, AvailableMenuItem, SidebarConfig, SidebarMenuItem } from "../types/sidebar";

// 型を再エクスポート（後方互換性のため）
export type { SidebarMenuItem, SidebarConfig, AvailableMenuItem };

const DEFAULT_COMMON_MENU_ITEMS: SidebarMenuItem[] = [
  { id: "todo", name: "TODOリスト", icon: "•", href: "/todo", enabled: true, order: 1 },
  { id: "progress-notes", name: "進捗メモ", icon: "•", href: "/sales/progress-notes", enabled: true, order: 2 },
  { id: "contracts", name: "契約書管理", icon: "•", href: "/admin/contracts", enabled: true, order: 3 },
  { id: "users", name: "利用者招待", icon: "•", href: "/admin/users", enabled: true, order: 4 },
];

const DEFAULT_ADMIN_MENU_ITEMS: SidebarMenuItem[] = [
];

export const useSidebarConfig = () => {
  const [config, setConfig] = useState<SidebarConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // サイドバー設定を取得
  const fetchSidebarConfig = useCallback(async () => {
    if (!db) {
      setLoading(false);
      return;
    }

    try {
      const configDocRef = doc(db, "sidebarConfig", "default");
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
              name: "利用者招待",
              icon: "•",
              href: "/admin/users",
              enabled: true,
              order: 7
            }];
          }
        }
        
        setConfig({
          id: configDoc.id,
          commonMenuItems: commonMenuItems,
          adminMenuItems: adminMenuItems,
          enabledMenuItems: data.enabledMenuItems || [], // 有効化された追加メニュー項目のIDリスト
          updatedAt: data.updatedAt?.toDate() || new Date(),
          updatedBy: data.updatedBy || "",
        });
      } else {
        // デフォルト設定を使用
        setConfig({
          id: "default",
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
        id: "default",
        commonMenuItems: DEFAULT_COMMON_MENU_ITEMS,
        adminMenuItems: DEFAULT_ADMIN_MENU_ITEMS,
        enabledMenuItems: [],
        updatedAt: new Date(),
        updatedBy: "",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // リアルタイムでサイドバー設定を監視
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    const configDocRef = doc(db, "sidebarConfig", "default");
    
    const unsubscribe = onSnapshot(
      configDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
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
                name: "利用者招待",
                icon: "•",
                href: "/admin/users",
                enabled: true,
                order: 7
              }];
            }
          }
          
          setConfig({
            id: snapshot.id,
            commonMenuItems: commonMenuItems,
            adminMenuItems: adminMenuItems,
            enabledMenuItems: data.enabledMenuItems || [],
            updatedAt: data.updatedAt?.toDate() || new Date(),
            updatedBy: data.updatedBy || "",
          });
        } else {
          // デフォルト設定を使用
          setConfig({
            id: "default",
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
          id: "default",
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
  }, []);

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
        .sort((a, b) => a.order - b.order);
    }
    
    // contractsが含まれていない場合は強制的に追加
    if (!items.find((item: any) => item.id === 'contracts')) {
      items = [...items, {
        id: "contracts",
        name: "契約書管理",
        icon: "•",
        href: "/admin/contracts",
        enabled: true,
        order: 6
      }].sort((a, b) => a.order - b.order);
    }
    
    // usersが含まれていない場合は強制的に追加
    if (!items.find((item: any) => item.id === 'users')) {
      items = [...items, {
        id: "users",
        name: "利用者招待",
        icon: "•",
        href: "/admin/users",
        enabled: true,
        order: 7
      }].sort((a, b) => a.order - b.order);
    }
    
    return items;
  }, [config]);

  const getEnabledAdminMenuItems = useCallback((): SidebarMenuItem[] => {
    if (!config) return DEFAULT_ADMIN_MENU_ITEMS.filter((item: any) => item.enabled);
    return config.adminMenuItems
      .filter((item: any) => item.enabled)
      .sort((a, b) => a.order - b.order);
  }, [config]);

  // 有効化された追加メニュー項目を取得（候補プールから）
  const getEnabledAdditionalMenuItems = useCallback((): AvailableMenuItem[] => {
    if (!config || !config.enabledMenuItems || config.enabledMenuItems.length === 0) {
      return [];
    }
    
    // 有効化されたIDリストに基づいて、候補プールから該当する項目を取得
    return AVAILABLE_MENU_ITEMS
      .filter((item: any) => config.enabledMenuItems.includes(item.id))
      .sort((a, b) => {
        // カテゴリ順、次にorder順でソート
        const categoryOrder = ['sales', 'customer', 'inventory', 'finance', 'pdca', 'document', 'project', 'analytics', 'other'];
        const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        if (categoryDiff !== 0) return categoryDiff;
        return (a.order || 0) - (b.order || 0);
      });
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


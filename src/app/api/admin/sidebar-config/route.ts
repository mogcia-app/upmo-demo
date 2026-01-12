import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { AVAILABLE_MENU_ITEMS } from "@/types/sidebar";

// Firebase Admin SDK の初期化
if (!getApps().length) {
  // 環境変数が設定されていない場合はスキップ
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

// Firebase Admin SDK が初期化されていない場合は null を返す
const auth = getApps().length > 0 ? getAuth() : null;
const db = getApps().length > 0 ? getFirestore() : null;

interface SidebarMenuItem {
  id: string;
  name: string;
  icon: string;
  href: string;
  enabled: boolean;
  order: number;
}

interface SidebarConfigRequest {
  commonMenuItems?: SidebarMenuItem[];
  adminMenuItems?: SidebarMenuItem[];
  enabledMenuItems?: string[]; // 有効化された追加メニュー項目のIDリスト
}

// サイドバー設定を取得
export async function GET(request: NextRequest) {
  try {
    if (!db || !auth) {
      return NextResponse.json(
        { error: "Firebase not initialized" },
        { status: 500 }
      );
    }

    // 認証トークンを取得（Authorizationヘッダーから）
    const authHeader = request.headers.get("authorization");
    let companyName = "default"; // デフォルト値
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const decodedToken = await auth.verifyIdToken(token);
        const userId = decodedToken.uid;
        
        // ユーザーのcompanyNameを取得
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          companyName = userData?.companyName || "default";
        }
      } catch (authError: any) {
        console.warn("Auth verification error (using default config):", authError);
        // 認証エラーの場合はデフォルト設定を使用
      }
    }

    const configDocRef = db.collection("sidebarConfig").doc(companyName);
    const configDoc = await configDocRef.get();

    if (configDoc.exists) {
      const data = configDoc.data();
      const updatedAt = data?.updatedAt;
      return NextResponse.json({
        id: configDoc.id,
        companyName: companyName,
        commonMenuItems: data?.commonMenuItems || [],
        adminMenuItems: data?.adminMenuItems || [],
        enabledMenuItems: data?.enabledMenuItems || [],
        availableMenuItems: AVAILABLE_MENU_ITEMS, // 利用可能なメニュー項目の候補プール
        updatedAt: updatedAt instanceof Timestamp 
          ? updatedAt.toDate().toISOString() 
          : updatedAt?.toISOString() || new Date().toISOString(),
        updatedBy: data?.updatedBy || "",
      });
    } else {
      // デフォルト設定を返す
      return NextResponse.json({
        id: companyName,
        companyName: companyName,
        commonMenuItems: [
          { id: "todo", name: "TODOリスト", icon: "•", href: "/todo", enabled: true, order: 1 },
          { id: "progress-notes", name: "メモ", icon: "•", href: "/sales/progress-notes", enabled: true, order: 2 },
          { id: "contracts", name: "契約書管理", icon: "•", href: "/admin/contracts", enabled: true, order: 3 },
          { id: "users", name: "利用者管理", icon: "•", href: "/admin/users", enabled: true, order: 4 },
          { id: "company-info", name: "会社情報", icon: "•", href: "/admin/company", enabled: true, order: 5 },
          { id: "invoice", name: "請求書発行", icon: "•", href: "/admin/invoice", enabled: true, order: 6 },
          { id: "calendar", name: "カレンダー", icon: "📅", href: "/calendar", enabled: true, order: 7 },
        ],
        adminMenuItems: [
          { id: "contracts", name: "契約書", icon: "•", href: "/admin/contracts", enabled: true, order: 1 },
          { id: "users", name: "ユーザー管理", icon: "•", href: "/admin/users", enabled: true, order: 2 },
        ],
        enabledMenuItems: [],
        availableMenuItems: AVAILABLE_MENU_ITEMS, // 利用可能なメニュー項目の候補プール
        updatedAt: new Date().toISOString(),
        updatedBy: "",
      });
    }
  } catch (error: any) {
    console.error("Error fetching sidebar config:", error);
    return NextResponse.json(
      { error: "Failed to fetch sidebar config", details: error.message },
      { status: 500 }
    );
  }
}

// サイドバー設定を更新
export async function POST(request: NextRequest) {
  try {
    if (!db || !auth) {
      return NextResponse.json(
        { error: "Firebase not initialized" },
        { status: 500 }
      );
    }

    // 認証トークンを取得（Authorizationヘッダーから）
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Firebase Admin SDKでトークンを検証
    let userId = "";
    try {
      const decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;

      // 管理者権限を確認（必要に応じて）
      // const userDoc = await db.collection("users").doc(userId).get();
      // if (!userDoc.exists || userDoc.data()?.role !== "admin") {
      //   return NextResponse.json(
      //     { error: "Forbidden: Admin access required" },
      //     { status: 403 }
      //   );
      // }
    } catch (authError: any) {
      console.error("Auth verification error:", authError);
      return NextResponse.json(
        { error: "Unauthorized: Invalid token", details: authError.message },
        { status: 401 }
      );
    }

    // ユーザーのcompanyNameを取得
    const userDoc = await db.collection("users").doc(userId).get();
    let companyName = "default";
    if (userDoc.exists) {
      const userData = userDoc.data();
      companyName = userData?.companyName || "default";
    }

    const body: SidebarConfigRequest = await request.json();
    const { commonMenuItems, adminMenuItems, enabledMenuItems } = body;

    // 既存の設定を取得（会社単位）
    const configDocRef = db.collection("sidebarConfig").doc(companyName);
    const existingDoc = await configDocRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    // 新しい設定をマージ（指定されたもののみ更新）
    const updatedConfig = {
      companyName: companyName, // 会社名を保存
      commonMenuItems: commonMenuItems || existingData?.commonMenuItems || [],
      adminMenuItems: adminMenuItems || existingData?.adminMenuItems || [],
      enabledMenuItems: enabledMenuItems !== undefined ? enabledMenuItems : (existingData?.enabledMenuItems || []),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Firestoreに保存（会社単位）
    await configDocRef.set(updatedConfig, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Sidebar config updated successfully",
      config: {
        id: companyName,
        ...updatedConfig,
        updatedAt: updatedConfig.updatedAt.toDate().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error updating sidebar config:", error);
    return NextResponse.json(
      { error: "Failed to update sidebar config", details: error.message },
      { status: 500 }
    );
  }
}


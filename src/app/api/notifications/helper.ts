import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// 通知を作成するヘルパー関数（サーバーサイド用）
export async function createNotificationInServer(
  adminDb: ReturnType<typeof getFirestore>,
  userId: string,
  companyName: string,
  options: {
    type: 'create' | 'update' | 'delete' | 'info' | 'reply';
    pageName: string;
    pageUrl: string;
    title?: string;
    message?: string;
    action: 'created' | 'updated' | 'deleted' | 'replied';
  }
): Promise<void> {
  try {
    // ユーザー名を取得
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const userName = userData?.displayName || userData?.email || '不明なユーザー';
    
    // 通知を作成（作成者は既読として扱う）
    const getActionLabel = () => {
      switch (options.action) {
        case 'created': return '追加';
        case 'updated': return '編集';
        case 'deleted': return '削除';
        case 'replied': return '返信';
        default: return '更新';
      }
    };
    
    const notificationData = {
      type: options.type,
      title: options.title || `${options.pageName}が${getActionLabel()}されました`,
      message: options.message || '',
      pageUrl: options.pageUrl,
      pageName: options.pageName,
      action: options.action,
      createdBy: userId,
      createdByName: userName,
      companyName,
      readBy: [userId], // 作成者は既読として扱う（自分には通知が来ない）
      createdAt: Timestamp.now(),
    };
    
    await adminDb.collection('notifications').add(notificationData);
  } catch (error) {
    console.error('通知作成エラー:', error);
    // エラーが発生しても処理を続行（通知はオプション機能）
  }
}


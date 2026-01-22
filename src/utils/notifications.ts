import { User } from 'firebase/auth';

// 通知を作成する関数
export async function createNotification(
  user: User,
  options: {
    type: 'create' | 'update' | 'delete' | 'info';
    pageName: string;
    pageUrl: string;
    title?: string;
    message?: string;
    action: 'created' | 'updated' | 'deleted';
  }
): Promise<void> {
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: options.type,
        title: options.title || `${options.pageName}が${options.action === 'created' ? '追加' : options.action === 'updated' ? '編集' : '削除'}されました`,
        message: options.message || '',
        pageUrl: options.pageUrl,
        pageName: options.pageName,
        action: options.action,
      }),
    });

    if (!response.ok) {
      console.error('通知作成エラー:', await response.text());
    }
  } catch (error) {
    console.error('通知作成エラー:', error);
    // エラーが発生しても処理を続行（通知はオプション機能）
  }
}





import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    let q;
    
    if (userId) {
      // userIdがある場合は、whereのみ（インデックス問題を回避）
      q = query(collection(db, 'manualDocuments'), where('userId', '==', userId));
    } else {
      // userIdがない場合は、全件取得
      q = query(collection(db, 'manualDocuments'));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated || Date.now())
      };
    });

    // クライアント側でソート（Firestoreのインデックス問題を回避）
    documents.sort((a, b) => {
      const dateA = a.lastUpdated instanceof Date ? a.lastUpdated : new Date(a.lastUpdated);
      const dateB = b.lastUpdated instanceof Date ? b.lastUpdated : new Date(b.lastUpdated);
      return dateB.getTime() - dateA.getTime();
    });

    return NextResponse.json({ 
      success: true, 
      documents 
    });

  } catch (error) {
    console.error('Manual document fetch error:', error);
    console.error('Error details:', error);
    return NextResponse.json({ 
      error: '文書の取得に失敗しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

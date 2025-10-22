import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    let q = query(collection(db, 'manualDocuments'), orderBy('lastUpdated', 'desc'));
    
    if (userId) {
      q = query(q, where('userId', '==', userId));
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

    return NextResponse.json({ 
      success: true, 
      documents 
    });

  } catch (error) {
    console.error('Manual document fetch error:', error);
    return NextResponse.json({ error: '文書の取得に失敗しました' }, { status: 500 });
  }
}

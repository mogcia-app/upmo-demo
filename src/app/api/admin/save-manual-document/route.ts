import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { title, description, type, sections, tags, priority, userId } = data;
    
    if (!title || !userId) {
      return NextResponse.json({ error: 'タイトルとユーザーIDが必要です' }, { status: 400 });
    }

    // Firestoreに保存
    const docRef = await addDoc(collection(db, 'manualDocuments'), {
      title,
      description: description || '',
      type: type || 'meeting',
      sections: sections || {
        overview: '',
        features: [],
        pricing: [],
        procedures: []
      },
      tags: tags || [],
      priority: priority || 'medium',
      userId,
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      documentId: docRef.id,
      message: '文書が正常に保存されました'
    });

  } catch (error) {
    console.error('Manual document save error:', error);
    return NextResponse.json({ error: '文書の保存に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    let q = query(collection(db, 'manualDocuments'), orderBy('lastUpdated', 'desc'));
    
    if (userId) {
      q = query(q, where('userId', '==', userId));
    }
    
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      lastUpdated: doc.data().lastUpdated?.toDate() || new Date()
    }));

    return NextResponse.json({ 
      success: true, 
      documents 
    });

  } catch (error) {
    console.error('Manual document fetch error:', error);
    return NextResponse.json({ error: '文書の取得に失敗しました' }, { status: 500 });
  }
}

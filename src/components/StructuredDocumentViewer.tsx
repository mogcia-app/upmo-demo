// 構造化ドキュメントの表示コンポーネント

import React from 'react';

interface StructuredDocumentViewerProps {
  documentId: string;
  sections: Array<{
    title: string;
    content: string;
    category: 'overview' | 'features' | 'pricing' | 'flow' | 'contact' | 'other';
  }>;
}

export const StructuredDocumentViewer: React.FC<StructuredDocumentViewerProps> = ({ 
  documentId, 
  sections 
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'overview': return '📋';
      case 'features': return '⚡';
      case 'pricing': return '💰';
      case 'flow': return '🔄';
      case 'contact': return '📞';
      default: return '📄';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'overview': return '概要';
      case 'features': return '機能・できること';
      case 'pricing': return '料金';
      case 'flow': return '導入フロー';
      case 'contact': return 'お問い合わせ';
      default: return 'その他';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'overview': return 'bg-blue-100 text-blue-800';
      case 'features': return 'bg-green-100 text-green-800';
      case 'pricing': return 'bg-yellow-100 text-yellow-800';
      case 'flow': return 'bg-purple-100 text-purple-800';
      case 'contact': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          📁 構造化されたドキュメント
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section, index) => (
            <div 
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">
                  {getCategoryIcon(section.category)}
                </span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(section.category)}`}>
                  {getCategoryName(section.category)}
                </span>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2">
                {section.title}
              </h3>
              
              <p className="text-sm text-gray-600 line-clamp-3">
                {section.content.substring(0, 150)}...
              </p>
              
              <button className="mt-3 text-sm text-blue-600 hover:text-blue-800">
                詳細を見る →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

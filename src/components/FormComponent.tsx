"use client";

import React, { useState } from "react";
import { FormComponent as FormComponentType } from "../types/components";

interface FormComponentProps {
  component: FormComponentType;
  onUpdate: (component: FormComponentType) => void;
}

const FormComponent: React.FC<FormComponentProps> = ({ component, onUpdate }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // ここでフォームデータを処理（Firestoreに保存など）
      console.log("Form submitted:", formData);
      
      // 成功メッセージ
      alert("フォームが送信されました！");
      
      // フォームをリセット
      setFormData({});
      
      // ここで実際の保存処理を実装
      // await saveFormData(formData);
      
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("送信に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.id] || "";

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={`${field.label}を入力してください`}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={`${field.label}を入力してください`}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={`${field.label}を入力してください`}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={`${field.label}を入力してください`}
            required={field.required}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          >
            <option value="">選択してください</option>
            {field.options?.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.id, e.target.value)}
            placeholder={`${field.label}を入力してください`}
            required={field.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#005eb2] focus:border-transparent"
          />
        );
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{component.title}</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {component.config.fields?.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>

        {component.config.fields?.length > 0 && (
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setFormData({})}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              リセット
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#005eb2] text-white rounded-md hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-[#005eb2] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </div>
        )}

        {component.config.fields?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            フォームフィールドが設定されていません。コンポーネントを編集してフィールドを追加してください。
          </div>
        )}
      </form>
    </div>
  );
};

export default FormComponent;

"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Firebase環境変数が設定されているかチェック
    if (!auth) {
      setError('Firebase環境変数が設定されていません。.env.localファイルに必要な環境変数を設定してください。');
      setLoading(false);
      return;
    }

    try {
      // ログイン
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (error: unknown) {
      console.error("Authentication error:", error);
      setError(getErrorMessage((error as { code?: string }).code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string | undefined) => {
    switch (errorCode) {
      case "auth/user-not-found":
        return "ユーザーが見つかりません。";
      case "auth/wrong-password":
        return "パスワードが間違っています。";
      case "auth/invalid-email":
        return "有効なメールアドレスを入力してください。";
      case "auth/api-key-not-valid":
        return "Firebase APIキーが無効です。.env.localファイルの環境変数を確認してください。";
      case "auth/network-request-failed":
        return "ネットワークエラーが発生しました。インターネット接続を確認してください。";
      default:
        return "エラーが発生しました。もう一度お試しください。";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#005eb2] mb-2">Upmo Demo</h1>
          <h2 className="text-2xl font-bold text-gray-900">
            ログイン
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            アカウントにログインしてください
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#005eb2] focus:border-[#005eb2] sm:text-sm"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-[#005eb2] focus:border-[#005eb2] sm:text-sm"
                  placeholder="パスワードを入力"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#005eb2] hover:bg-[#004a96] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#005eb2] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    処理中...
                  </div>
                ) : (
                  "ログイン"
                )}
              </button>
            </div>
          </form>


          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              デモアカウント: <br />
              メール: demo@example.com <br />
              パスワード: demo123456
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

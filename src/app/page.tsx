"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";

interface CompanySetup {
  companyName: string;
  industry: string;
  industries: string[]; // 複数選択対応
  selectedFeatures: string[];
  teamSize: string;
  isSetupComplete: boolean;
}

// リアルタイムカレンダーコンポーネント
const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [teamEvents, setTeamEvents] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    member: string;
    color: string;
  }>>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    location: '',
    color: '#3B82F6'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // リアルタイムで時刻を更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 画面サイズを監視
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // チーム全員の予定を取得
  useEffect(() => {
    const loadTeamEvents = async () => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/events', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.events) {
            setTeamEvents(data.events.map((event: any) => ({
              id: event.id,
              title: event.title,
              date: event.date,
              time: event.time || '',
              member: event.member || '自分',
              color: event.color || '#3B82F6'
            })));
          }
        }
      } catch (error) {
        console.error('予定の読み込みエラー:', error);
      }
    };

    loadTeamEvents();
  }, [currentDate, user]);

  // 月の日付を生成
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    
    // 前月の日付（空白）
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // 今日の日付判定
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // 指定された日付の予定を取得
  const getEventsForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return teamEvents.filter(event => event.date === dateStr);
  };

  // 週の日付を生成
  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  // 月を変更
  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // 週を変更
  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  // 今日に戻る
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 予定を追加するモーダルを開く
  const openAddEventModal = (date?: Date) => {
    const targetDate = date || new Date();
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    setSelectedDate(targetDate);
    setNewEvent({
      title: '',
      date: dateStr,
      time: '',
      description: '',
      location: '',
      color: '#3B82F6'
    });
    setShowAddEventModal(true);
  };

  // 予定を追加
  const handleAddEvent = async () => {
    if (!user || !newEvent.title.trim() || !newEvent.date) return;

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newEvent.title.trim(),
          date: newEvent.date,
          time: newEvent.time || '',
          description: newEvent.description || '',
          location: newEvent.location || '',
          color: newEvent.color
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 予定リストを再読み込み
          const loadResponse = await fetch('/api/events', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (loadResponse.ok) {
            const loadData = await loadResponse.json();
            if (loadData.success && loadData.events) {
              setTeamEvents(loadData.events.map((event: any) => ({
                id: event.id,
                title: event.title,
                date: event.date,
                time: event.time || '',
                member: event.member || '自分',
                color: event.color || '#3B82F6'
              })));
            }
          }
          setShowAddEventModal(false);
          setNewEvent({
            title: '',
            date: '',
            time: '',
            description: '',
            location: '',
            color: '#3B82F6'
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || '予定の追加に失敗しました');
      }
    } catch (error) {
      console.error('予定追加エラー:', error);
      alert('予定の追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = generateMonthDays();
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  // 現在時刻のフォーマット
  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">カレンダー</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            {formatTime(currentTime)}
          </div>
          <button
            onClick={() => openAddEventModal()}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            予定を追加
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-[#005eb2] text-white rounded hover:bg-[#004a96] transition-colors"
          >
            今日
          </button>
        </div>
      </div>

      {/* 期間ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => isMobile ? changeWeek('prev') : changeMonth('prev')}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-lg font-medium text-gray-900">
          {isMobile ? (() => {
            const weekDays = generateWeekDays();
            const startDate = weekDays[0];
            const endDate = weekDays[6];
            return `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
          })() : `${currentDate.getFullYear()}年${monthNames[currentDate.getMonth()]}`}
        </h3>
        
        <button
          onClick={() => isMobile ? changeWeek('next') : changeMonth('next')}
          className="p-2 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* カレンダーグリッド */}
      {isMobile ? (
        // モバイル: 週表示
        <div className="space-y-2">
          {generateWeekDays().map((date) => {
            const today = isToday(date);
            const dayEvents = getEventsForDate(date);
            
            return (
              <div
                key={date.toISOString()}
                onClick={() => openAddEventModal(date)}
                className={`p-3 border-2 border-gray-200 flex flex-col cursor-pointer ${
                  today 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`text-base font-semibold ${
                      today ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className={`text-sm ${
                      today ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      ({dayNames[date.getDay()]})
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="text-sm px-2 py-1.5 rounded flex items-center justify-between"
                        style={{ 
                          backgroundColor: event.color + '20',
                          borderLeft: `3px solid ${event.color}`
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{event.title}</div>
                          {event.time && (
                            <div className="text-xs text-gray-500">{event.time} - {event.member}</div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400">予定なし</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // デスクトップ: 月表示
        <div className="grid grid-cols-7 gap-2">
          {/* 曜日ヘッダー */}
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-medium ${
                index === 0 || index === 6 ? 'text-red-500' : 'text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
          
          {/* 日付 */}
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="aspect-square"></div>;
            }
            
            const today = isToday(date);
            const dayEvents = getEventsForDate(date);
            
            return (
              <div
                key={date.toISOString()}
                onClick={() => openAddEventModal(date)}
                className={`aspect-square p-2 border-2 border-gray-200 flex flex-col cursor-pointer ${
                  today 
                    ? 'bg-blue-50 border-blue-300' 
                    : 'hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className={`text-sm font-semibold mb-1 ${
                  today ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {date.getDate()}
                </div>
                <div className="flex-1 space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate"
                      style={{ 
                        backgroundColor: event.color, 
                        color: 'white',
                        fontSize: '10px'
                      }}
                      title={`${event.title} - ${event.member}`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">
                      +{dayEvents.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          }          )}
        </div>
      )}

      {/* 予定追加モーダル */}
      {showAddEventModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddEventModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">予定を追加</h3>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="予定のタイトルを入力"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    日付 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    時間
                  </label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  場所
                </label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="会議室、オンラインなど"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="予定の詳細を入力"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  色
                </label>
                <div className="flex gap-2">
                  {[
                    { value: '#3B82F6', name: '青' },
                    { value: '#EF4444', name: '赤' },
                    { value: '#10B981', name: '緑' },
                    { value: '#F59E0B', name: '黄' },
                    { value: '#8B5CF6', name: '紫' },
                    { value: '#F97316', name: 'オレンジ' }
                  ].map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewEvent({ ...newEvent, color: color.value })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        newEvent.color === color.value
                          ? 'border-gray-900 scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddEventModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddEvent}
                disabled={!newEvent.title.trim() || !newEvent.date || isSubmitting}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 今日の予定詳細ビュー
const TodayEventsView: React.FC = () => {
  const { user } = useAuth();
  const [todayEvents, setTodayEvents] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    member: string;
    color: string;
    description?: string;
    location?: string;
  }>>([]);
  const [selectedEvent, setSelectedEvent] = useState<{
    id: string;
    title: string;
    date: string;
    time?: string;
    member: string;
    color: string;
    description?: string;
    location?: string;
  } | null>(null);

  useEffect(() => {
    const loadTodayEvents = async () => {
      if (!user) return;
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const token = await user.getIdToken();
        const response = await fetch(`/api/events?date=${today}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.events) {
            setTodayEvents(data.events.map((event: any) => ({
              id: event.id,
              title: event.title,
              date: event.date,
              time: event.time || '',
              member: event.member || '自分',
              color: event.color || '#3B82F6',
              description: event.description || '',
              location: event.location || ''
            })));
          } else {
            setTodayEvents([]);
          }
        }
      } catch (error) {
        console.error('今日の予定の読み込みエラー:', error);
      }
    };

    loadTodayEvents();
  }, [user]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        今日の予定
      </h2>
      {todayEvents.length > 0 ? (
        <div className="space-y-3">
          {todayEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className="w-full text-left p-4 border-2 border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-1 h-full min-h-[60px] rounded"
                  style={{ backgroundColor: event.color }}
                ></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {event.title}
                    </h3>
                    <span
                      className="px-2 py-1 text-xs font-medium rounded text-white"
                      style={{ backgroundColor: event.color }}
                    >
                      {event.member}
                    </span>
                  </div>
                  {event.time && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{event.time}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>今日の予定はありません</p>
        </div>
      )}

      {/* 予定詳細モーダル */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedEvent.title}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: selectedEvent.color }}
                >
                  {selectedEvent.member.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{selectedEvent.member}</div>
                  <div className="text-sm text-gray-500">担当者</div>
                </div>
              </div>

              {selectedEvent.time && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900">{selectedEvent.time}</div>
                    <div className="text-sm text-gray-500">時間</div>
                  </div>
                </div>
              )}

              {selectedEvent.location && (
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <div className="font-medium text-gray-900">{selectedEvent.location}</div>
                    <div className="text-sm text-gray-500">場所</div>
                  </div>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-2">説明</div>
                  <div className="text-gray-900">{selectedEvent.description}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { user } = useAuth();
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupData, setSetupData] = useState<CompanySetup>({
    companyName: "",
    industry: "",
    industries: [], // 複数選択対応
    selectedFeatures: [],
    teamSize: "",
    isSetupComplete: false
  });

  // 通常のダッシュボード表示用のstate（すべてのHooksを早期リターンの前に配置）
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [taskStats, setTaskStats] = useState({ completed: 0, pending: 0, today: 0 });
  const [contractCount, setContractCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
    role: string;
    status: string;
    department?: string;
    position?: string;
  }>>([]);

  useEffect(() => {
    // ユーザーの設定状況をチェック
    const checkSetupStatus = async () => {
      if (user) {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.companySetup) {
              setSetupData(userData.companySetup);
              setIsSetupMode(!userData.companySetup.isSetupComplete);
            } else {
              setIsSetupMode(true);
            }
          } else {
            setIsSetupMode(true);
          }
        } catch (error) {
          console.error('設定状況の確認エラー:', error);
          setIsSetupMode(true);
        }
      }
    };

    checkSetupStatus();
  }, [user]);

  // タスク統計と契約書件数を取得
  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.stats) {
            setTaskStats(data.stats.taskStats || { completed: 0, pending: 0, today: 0 });
            setContractCount(data.stats.contractCount || 0);
          }
        }
      } catch (error) {
        console.error('統計情報の読み込みエラー:', error);
      }
    };

    loadStats();
  }, [user]);

  // チーム利用者を取得
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      
      try {
        // 認証トークンを取得
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          // role: 'user' のユーザーのみをチーム利用者として表示
          const users = data.users.filter((u: any) => u.role === 'user');
          setTeamMembers(users);
        }
      } catch (error) {
        console.error('チーム利用者の読み込みエラー:', error);
      }
    };

    loadTeamMembers();
  }, [user]);

  const handleSetupComplete = async () => {
    if (!user || !setupData.companyName) return;

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      // 業種が選択されていない場合はデフォルトで「その他」を設定
      const finalSetupData = {
        ...setupData,
        industries: setupData.industries.length > 0 ? setupData.industries : ['other'],
        industry: setupData.industry || 'other',
        isSetupComplete: true,
        completedAt: new Date()
      };

      await setDoc(doc(db, 'users', user.uid), {
        companySetup: finalSetupData,
        companyName: setupData.companyName
      }, { merge: true });

      setSetupData(finalSetupData);
      setIsSetupMode(false);
      
    } catch (error) {
      console.error('設定保存エラー:', error);
    }
  };


  if (isSetupMode) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="px-4 py-8">
              <div>
                {/* ヘッダー */}
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">
                    🎉 Upmoへようこそ！
                  </h1>
                  <p className="text-xl text-gray-600">
                    あなたのビジネスに最適な設定を行いましょう
                  </p>
                </div>

                {/* 会社情報入力 */}
                  <div className="bg-white rounded-lg shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">会社情報を入力</h2>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          会社名
                        </label>
                        <input
                          type="text"
                          value={setupData.companyName}
                          onChange={(e) => setSetupData(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="例: 株式会社サンプル"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          チーム規模
                        </label>
                        <select
                          value={setupData.teamSize}
                          onChange={(e) => setSetupData(prev => ({ ...prev, teamSize: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-lg"
                        >
                          <option value="">選択してください</option>
                          <option value="1-10">1-10人</option>
                          <option value="11-50">11-50人</option>
                          <option value="51-200">51-200人</option>
                          <option value="200+">200人以上</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end mt-8">
                      <button
                      onClick={handleSetupComplete}
                        disabled={!setupData.companyName || !setupData.teamSize}
                        className="px-8 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed text-lg font-medium"
                      >
                        設定完了
                      </button>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // 通常のダッシュボード表示
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      // 検索結果を処理（必要に応じて結果ページに遷移するなど）
      console.log('検索結果:', data);
      // ここで検索結果ページに遷移するか、モーダルで表示するなど
    } catch (error) {
      console.error('検索エラー:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* 検索バー */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="文書、契約書、規則などを検索..."
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005eb2] text-sm"
                />
                <svg 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSearching ? '検索中...' : '検索'}
              </button>
            </form>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#005eb2] rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">チーム利用者</p>
                  <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">契約書件数</p>
                  <p className="text-2xl font-bold text-gray-900">{contractCount}</p>
              </div>
            </div>
          </div>

            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
              </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600">今日のタスク</p>
                      <span className="text-lg font-bold text-[#000000]">{taskStats.today}</span>
              </div>
              </div>
              </div>
            </div>

          {/* カレンダー */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <CalendarView />
          </div>

          {/* 今日の予定詳細 */}
          <TodayEventsView />

          {/* チーム利用者 */}
          {teamMembers.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">チーム利用者</h2>
                <Link 
                  href="/admin/users" 
                  className="text-sm text-[#005eb2] hover:text-[#004a96]"
                >
                  すべて表示
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.slice(0, 6).map((member) => (
                  <div
                    key={member.id}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#005eb2] text-white flex items-center justify-center font-semibold">
                        {member.displayName.charAt(0)}
                  </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{member.displayName}</div>
                        <div className="text-sm text-gray-500 truncate">{member.email}</div>
                        {member.department && (
                          <div className="text-xs text-gray-400 mt-1">{member.department}</div>
                        )}
                </div>
                  </div>
                </div>
                ))}
                  </div>
              {teamMembers.length > 6 && (
                <div className="mt-4 text-center">
                  <Link
                    href="/admin/users"
                    className="text-sm text-[#005eb2] hover:text-[#004a96]"
                  >
                    +{teamMembers.length - 6}人の利用者を表示
                  </Link>
                </div>
              )}
              </div>
          )}

          {/* 自由タブ作成案内 */}
          {/* <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">追加の機能が必要ですか？</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  自由タブから独自のページを作成して、さらにカスタマイズできます
                </p>
              </div>
              <Link
                href="/custom/new-page"
                className="px-4 sm:px-6 py-2 sm:py-3 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors font-medium text-sm sm:text-base text-center"
              >
                自由タブを作成
              </Link>
            </div>
          </div> */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

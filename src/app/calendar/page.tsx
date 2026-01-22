"use client";

import React, { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";

// シンプルなカレンダーコンポーネント
const SimpleCalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [teamEvents, setTeamEvents] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time?: string;
    member: string;
    userId?: string;
    color: string;
    description?: string;
    location?: string;
    attendees?: string[];
    status?: string;
    type?: string;
  }>>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDateEventsModal, setShowDateEventsModal] = useState(false);
  const [selectedDateForEvents, setSelectedDateForEvents] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    id: string;
    title: string;
    date: string;
    time: string;
    description: string;
    location: string;
    color: string;
    status?: string;
    type?: string;
  } | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    location: '',
    color: '#3B82F6',
    attendees: [] as string[],
    status: 'todo',
    type: 'private'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
  }>>([]);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<Set<string>>(new Set(['todo', 'doing', 'done']));
  const [rightTab, setRightTab] = useState<'calendar' | 'plan'>('calendar');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMiniCalendarDate, setSelectedMiniCalendarDate] = useState<Date | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<typeof teamEvents[0] | null>(null);

  // チームメンバーを取得
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          const currentUser = data.users.find((u: any) => u.id === user.uid);
          const currentCompanyName = currentUser?.companyName || '';
          
          const members = data.users
            .filter((u: any) => 
              u.role === 'user' && 
              u.companyName === currentCompanyName
            )
            .map((u: any) => ({
              id: u.id,
              displayName: u.displayName || u.email,
              email: u.email
            }));
          setTeamMembers(members);
        }
      } catch (error) {
        console.error('チームメンバーの読み込みエラー:', error);
      }
    };

    loadTeamMembers();
  }, [user]);

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
            const mappedEvents = data.events.map((event: any) => {
              const eventUserId = event.userId || '';
              const eventUser = teamMembers.find(m => m.id === eventUserId);
              const memberName = eventUser ? eventUser.displayName : (event.member || '自分');
              
              return {
                id: event.id,
                title: event.title,
                date: event.date,
                time: event.time || '',
                member: memberName,
                userId: eventUserId,
                color: event.color || '#3B82F6',
                description: event.description || '',
                location: event.location || '',
                attendees: Array.isArray(event.attendees) ? event.attendees : [],
                status: event.status || 'todo',
                type: event.type || 'private'
              };
            });
            setTeamEvents(mappedEvents);
          }
        }
      } catch (error) {
        console.error('予定の読み込みエラー:', error);
      }
    };

    loadTeamEvents();
  }, [currentDate, user, teamMembers]);

  // 週の日付を生成
  const generateWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    // 月曜日を週の始まりにする（0=日曜日なので、1を引いて月曜日を0にする）
    const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  // 時間スロットを生成（0時から23時まで）
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
      });
    }
    return slots;
  };

  // 時間文字列から分に変換（例: "14:30" -> 870分）
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  };

  // 現在時刻の位置を計算（分単位、0時0分を基準）
  const getCurrentTimePosition = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  // 指定された日付・時間のイベントを取得
  const getEventsForDateAndTime = (date: Date, hour: number) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return teamEvents.filter(event => {
      if (event.date !== dateStr) return false;
      if (!event.time) return false;
      const eventHour = parseInt(event.time.split(':')[0]);
      return eventHour === hour;
    });
  };

  // 月の日付を生成
  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    // 月曜日を週の始まりにする（日曜日=0を6に、それ以外は-1）
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    
    // 前月の日付（空白）
    for (let i = 0; i < adjustedStartDay; i++) {
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
    
    let filtered = teamEvents.filter(event => event.date === dateStr);
    
    // ステータスでフィルタリング
    filtered = filtered.filter(event => selectedStatus.has(event.status || 'todo'));
    
    // 検索クエリでフィルタリング
    if (searchQuery) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
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

  // 日付をクリックしてその日の予定一覧を表示
  const openDateEventsModal = (date: Date) => {
    const dateForState = new Date(date.getTime());
    setSelectedDateForEvents(dateForState);
    setShowDateEventsModal(true);
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
      color: '#3B82F6',
      attendees: [],
      status: 'todo',
      type: 'private'
    });
    setShowAddEventModal(true);
  };

  // 予定の詳細を表示するモーダルを開く
  const openEventDetailModal = (event: typeof teamEvents[0]) => {
    setSelectedEventDetail(event);
    setShowEventDetailModal(true);
  };

  // 予定を編集するモーダルを開く
  const openEditEventModal = (event: typeof teamEvents[0]) => {
    setEditingEvent({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time || '',
      description: event.description || '',
      location: event.location || '',
      color: event.color || '#3B82F6',
      status: event.status || 'todo',
      type: event.type || 'private'
    });
    setNewEvent({
      title: event.title,
      date: event.date,
      time: event.time || '',
      description: event.description || '',
      location: event.location || '',
      color: event.color || '#3B82F6',
      attendees: event.attendees || [],
      status: event.status || 'todo',
      type: event.type || 'private'
    });
    setShowAddEventModal(true);
  };

  // 参加者の選択を切り替え
  const toggleAttendee = (memberId: string) => {
    setNewEvent(prev => ({
      ...prev,
      attendees: prev.attendees.includes(memberId)
        ? prev.attendees.filter(id => id !== memberId)
        : [...prev.attendees, memberId]
    }));
  };

  // ステータスの選択を切り替え
  const toggleStatus = (status: string) => {
    setSelectedStatus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // 予定リストを再読み込み
  const reloadEvents = async (token: string) => {
    const loadResponse = await fetch('/api/events', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (loadResponse.ok) {
      const loadData = await loadResponse.json();
      if (loadData.success && loadData.events) {
          setTeamEvents(loadData.events.map((event: any) => {
            const eventUserId = event.userId || '';
            const eventUser = teamMembers.find(m => m.id === eventUserId);
            const memberName = eventUser ? eventUser.displayName : (event.member || '自分');
            return {
              id: event.id,
              title: event.title,
              date: event.date,
              time: event.time || '',
              member: memberName,
              userId: eventUserId,
              color: event.color || '#3B82F6',
              description: event.description || '',
              location: event.location || '',
              attendees: Array.isArray(event.attendees) ? event.attendees : [],
              status: event.status || 'todo',
              type: event.type || 'private'
            };
          }));
      }
    }
  };

  // 予定を保存（追加・更新）
  const handleSaveEvent = async () => {
    if (!user || !newEvent.title.trim() || !newEvent.date) return;

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      if (editingEvent) {
        const response = await fetch('/api/events', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: editingEvent.id,
            title: newEvent.title.trim(),
            date: newEvent.date,
            time: newEvent.time || '',
            description: newEvent.description || '',
            location: newEvent.location || '',
            color: newEvent.color,
            attendees: newEvent.attendees || [],
            status: newEvent.status,
            type: newEvent.type
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            await reloadEvents(token);
            setShowAddEventModal(false);
            setEditingEvent(null);
            setNewEvent({
              title: '',
              date: '',
              time: '',
              description: '',
              location: '',
              color: '#3B82F6',
              attendees: [],
              status: 'todo',
              type: 'private'
            });
          }
        } else {
          const error = await response.json();
          alert(error.error || '予定の更新に失敗しました');
        }
      } else {
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
            color: newEvent.color,
            attendees: newEvent.attendees || [],
            status: newEvent.status,
            type: newEvent.type
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            await reloadEvents(token);
            setShowAddEventModal(false);
            setNewEvent({
              title: '',
              date: '',
              time: '',
              description: '',
              location: '',
              color: '#3B82F6',
              attendees: [],
              status: 'todo',
              type: 'private'
            });
          }
        } else {
          const error = await response.json();
          alert(error.error || '予定の追加に失敗しました');
        }
      }
    } catch (error) {
      console.error('予定保存エラー:', error);
      alert(editingEvent ? '予定の更新に失敗しました' : '予定の追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 予定を削除
  const handleDeleteEvent = async (eventId: string) => {
    if (!user || !confirm('この予定を削除しますか？')) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/events?id=${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await reloadEvents(token);
          if (editingEvent && editingEvent.id === eventId) {
            setShowAddEventModal(false);
            setEditingEvent(null);
          }
        }
      } else {
        const error = await response.json();
        alert(error.error || '予定の削除に失敗しました');
      }
    } catch (error) {
      console.error('予定削除エラー:', error);
      alert('予定の削除に失敗しました');
    }
  };

  // 予定のメニューを表示
  const handleEventMenuClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEventId(selectedEventId === eventId ? null : eventId);
  };

  const days = generateMonthDays();
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ];
  const dayNames = ["月", "火", "水", "木", "金", "土", "日"];
  const dayNamesShort = ["月", "火", "水", "木", "金", "土", "日"];

  // 説明文のレンダリング関数
  const renderDescription = (description: string) => {
    return description.split('\n').map((line: string, index: number) => {
      const isBullet = /^[\s]*[-•*]\s/.test(line) || /^[\s]*\d+[\.\)]\s/.test(line);
      if (isBullet) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="text-gray-400 mt-1">•</span>
            <span className="flex-1">{line.replace(/^[\s]*[-•*]\s/, '').replace(/^[\s]*\d+[\.\)]\s/, '')}</span>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={index} className="h-4"></div>;
      }
      return <p key={index} className="my-1">{line}</p>;
    });
  };

  // ステータスの色を取得
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'doing':
        return 'bg-blue-500';
      case 'todo':
        return 'bg-orange-500';
      case 'canceled':
        return 'bg-gray-400';
      default:
        return 'bg-gray-500';
    }
  };

  // ステータスの日本語名を取得
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return '完了';
      case 'doing':
        return '進行中';
      case 'todo':
        return '未着手';
      case 'canceled':
        return 'キャンセル';
      default:
        return status;
    }
  };

  // ミニカレンダーの日付を生成
  const generateMiniCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 月曜日を0に

    const days = [];
    for (let i = 0; i < adjustedStartDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    return days;
  };

  return (
    <div className="flex flex-col bg-white">
      {/* 上部バー */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4 flex-1">
            {/* 検索バー */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          {/* 右上アイコン */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => openAddEventModal()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">{user?.displayName?.[0] || 'U'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* 左側: カレンダー */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* カレンダーヘッダー */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => changeMonth('prev')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-semibold text-gray-900 min-w-[180px] text-center">
                    {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
                  </h2>
                  <button
                    onClick={() => changeMonth('next')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* ビュー切り替え */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  週
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  月
                </button>
              </div>
            </div>
          </div>

          {/* カレンダーグリッド */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'week' && (() => {
              const weekDays = generateWeekDays();
              const timeSlots = generateTimeSlots();
              const currentTimePosition = getCurrentTimePosition();
              const slotHeight = 60; // 1時間 = 60px
              
              return (
                <div className="h-full flex">
                  {/* 時間軸 */}
                  <div className="w-16 flex-shrink-0">
                    <div className="h-12"></div>
                    <div className="relative" style={{ height: `${24 * slotHeight}px` }}>
                      {timeSlots.map((slot) => (
                        <div
                          key={slot.hour}
                          className="text-xs text-gray-500 pr-2 text-right"
                          style={{ height: `${slotHeight}px`, lineHeight: `${slotHeight}px` }}
                        >
                          {slot.hour % 2 === 0 ? slot.time : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 週のカレンダー */}
                  <div className="flex-1 overflow-x-auto">
                    <div className="grid grid-cols-7 border-b border-gray-200">
                      {weekDays.map((date) => {
                        const today = isToday(date);
                        return (
                          <div
                            key={date.toISOString()}
                            className={`border-r border-gray-200 ${today ? 'bg-blue-50' : 'bg-white'}`}
                          >
                            <button
                              onClick={() => openDateEventsModal(date)}
                              className={`w-full text-center py-2 ${
                                today ? 'text-blue-600 font-semibold' : 'text-gray-700'
                              }`}
                            >
                              <div className="text-sm font-medium">{date.getDate()}</div>
                              <div className="text-xs text-gray-500">{dayNames[date.getDay() === 0 ? 6 : date.getDay() - 1]}</div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="relative grid grid-cols-7" style={{ height: `${24 * slotHeight}px` }}>
                      {/* 時間スロットのグリッド */}
                      {weekDays.map((date) => {
                        const today = isToday(date);
                        return (
                          <div
                            key={date.toISOString()}
                            className={`relative border-r border-gray-200 ${today ? 'bg-blue-50/30' : 'bg-white'}`}
                          >
                            {timeSlots.map((slot) => (
                              <div
                                key={slot.hour}
                                className="border-b border-gray-100"
                                style={{ height: `${slotHeight}px` }}
                              ></div>
                            ))}
                            
                            {/* 予定を配置 */}
                            {getEventsForDate(date)
                              .filter(event => event.time)
                              .map((event) => {
                                const eventMinutes = timeToMinutes(event.time || '00:00');
                                const topPosition = (eventMinutes / 60) * slotHeight;
                                
                                return (
                                  <div
                                    key={event.id}
                                    className="absolute left-0 right-0 px-1 group cursor-pointer"
                                    style={{
                                      top: `${topPosition}px`,
                                      height: `${slotHeight * 0.8}px`,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEventDetailModal(event);
                                    }}
                                  >
                                    <div
                                      className="px-2 py-1 text-xs text-white h-full flex items-center justify-between hover:opacity-90"
                                      style={{ backgroundColor: event.color || '#3B82F6' }}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{event.title}</div>
                                        {event.time && (
                                          <div className="text-[10px] opacity-90">{event.time}</div>
                                        )}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventMenuClick(event.id, e);
                                        }}
                                        className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                        </svg>
                                      </button>
                                    </div>
                                    {selectedEventId === event.id && (
                                      <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openEditEventModal(event);
                                            setSelectedEventId(null);
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                          編集
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteEvent(event.id);
                                            setSelectedEventId(null);
                                          }}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                                        >
                                          削除
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            
                            {/* 現在時刻の横線（今日のみ） */}
                            {today && (
                              <div
                                className="absolute left-0 right-0 z-10 pointer-events-none"
                                style={{
                                  top: `${(currentTimePosition / 60) * slotHeight}px`,
                                }}
                              >
                                <div className="flex items-center">
                                  <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                                  <div className="flex-1 h-0.5 bg-red-500"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {viewMode === 'month' && (
              <div className="h-full">
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayNames.map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-gray-700 py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* 日付グリッド */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map((date, index) => {
                    if (!date) {
                      return <div key={index} className="min-h-[120px]"></div>;
                    }
                    
                    const today = isToday(date);
                    const dayEvents = getEventsForDate(date);
                    
                    return (
                      <div
                        key={date.toISOString()}
                        className={`min-h-[120px] p-2 border border-gray-200 ${
                          today ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => openDateEventsModal(date)}
                          className={`w-full text-left mb-1 ${
                            today ? 'text-blue-600 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {date.getDate()}
                        </button>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className="relative group"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEventDetailModal(event);
                              }}
                            >
                              <div
                                className="px-2 py-1 text-xs text-white flex items-center justify-between cursor-pointer hover:opacity-90"
                                style={{ backgroundColor: event.color || '#3B82F6' }}
                              >
                                <span className="truncate flex-1">{event.title}</span>
                                <button
                                  onClick={(e) => handleEventMenuClick(event.id, e)}
                                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                              </div>
                              {selectedEventId === event.id && (
                                <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditEventModal(event);
                                      setSelectedEventId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    編集
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEvent(event.id);
                                      setSelectedEventId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                                  >
                                    削除
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-500 px-2">
                              その他{dayEvents.length - 3}件
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右サイドバー */}
        <div className="hidden lg:flex w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col">

          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* ミニカレンダーセクション */}
                <div className="p-4 border-b border-gray-200">
                  <div className="text-sm font-semibold text-gray-900 mb-3">
                    {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNamesShort.map((day) => (
                      <div key={day} className="text-center text-xs text-gray-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {generateMiniCalendarDays().map((day, index) => {
                      if (day === null) {
                        return <div key={index} className="aspect-square"></div>;
                      }
                      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                      const isCurrentDay = isToday(date);
                      const dayEvents = getEventsForDate(date);
                      const hasEvents = dayEvents.length > 0;
                      const isSelected = selectedMiniCalendarDate && 
                        selectedMiniCalendarDate.getDate() === day &&
                        selectedMiniCalendarDate.getMonth() === currentDate.getMonth() &&
                        selectedMiniCalendarDate.getFullYear() === currentDate.getFullYear();
                      
                      return (
                        <button
                          key={index}
                          onClick={() => {
                            const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                            setSelectedMiniCalendarDate(clickedDate);
                            setCurrentDate(clickedDate);
                          }}
                          className={`aspect-square text-xs rounded-full relative ${
                            isCurrentDay ? 'bg-blue-600 text-white' : isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          {day}
                          {hasEvents && (
                            <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 text-[8px] leading-none">
                              •
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* フィルターセクション */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* 選択された日付（または現在の日付）の予定一覧 */}
                  {(() => {
                    const displayDate = selectedMiniCalendarDate || currentDate;
                    const year = displayDate.getFullYear();
                    const month = String(displayDate.getMonth() + 1).padStart(2, '0');
                    const day = String(displayDate.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    const dayEvents = teamEvents.filter(event => {
                      if (event.date !== dateStr) return false;
                      return selectedStatus.has(event.status || 'todo');
                    });
                    
                    return (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                          {displayDate.getMonth() + 1}月{displayDate.getDate()}日の予定
                        </h3>
                        {dayEvents.length === 0 ? (
                          <p className="text-xs text-gray-500">予定がありません</p>
                        ) : (
                          <div className="space-y-2">
                            {dayEvents
                              .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                              .map((event) => (
                                <div
                                  key={event.id}
                                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                                  onClick={() => openEventDetailModal(event)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: event.color || '#3B82F6' }}
                                        ></div>
                                        <span className="text-xs font-medium text-gray-900">{event.title}</span>
                                      </div>
                                      {event.time && (
                                        <p className="text-xs text-gray-500 ml-4">{event.time}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
          </div>
        </div>
      </div>

      {/* 予定追加/編集モーダル */}
      {showAddEventModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddEventModal(false);
            setEditingEvent(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingEvent ? '予定を編集' : '新しい予定を追加'}
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                <input
                  type="text"
                  id="title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
                  <input
                    type="date"
                    id="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">時間</label>
                  <input
                    type="time"
                    id="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                <input
                  type="text"
                  id="location"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  id="description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                <select
                  value={newEvent.status}
                  onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="todo">未着手</option>
                  <option value="doing">進行中</option>
                  <option value="done">完了</option>
                  <option value="canceled">キャンセル</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="private">プライベート</option>
                  <option value="contractor">契約者</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">色</label>
                <div className="flex gap-2">
                  {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316'].map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${newEvent.color === color ? 'border-blue-500' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewEvent({ ...newEvent, color })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  参加者
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                    className="w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
                  >
                    <span className="text-gray-700">
                      {newEvent.attendees.length > 0
                        ? `${newEvent.attendees.length}名選択中`
                        : '参加者を選択'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${showAttendeeDropdown ? 'transform rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showAttendeeDropdown && (
                    <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {teamMembers.map((member) => (
                        <label key={member.id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newEvent.attendees.includes(member.id)}
                            onChange={() => toggleAttendee(member.id)}
                            className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">{member.displayName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newEvent.attendees.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {newEvent.attendees.map((attendeeId) => {
                      const member = teamMembers.find(m => m.id === attendeeId);
                      const displayName = member?.displayName || attendeeId;
                      return (
                        <span
                          key={attendeeId}
                          className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {displayName}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddEventModal(false);
                  setEditingEvent(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={!newEvent.title.trim() || !newEvent.date || isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (editingEvent ? '更新中...' : '追加中...') : (editingEvent ? '更新' : '追加')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日付の予定一覧モーダル */}
      {showDateEventsModal && selectedDateForEvents && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={() => {
            setShowDateEventsModal(false);
            setSelectedDateForEvents(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDateForEvents.getFullYear()}年{selectedDateForEvents.getMonth() + 1}月{selectedDateForEvents.getDate()}日の予定
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {dayNames[selectedDateForEvents.getDay() === 0 ? 6 : selectedDateForEvents.getDay() - 1]}曜日
                </p>
              </div>
              <button
                onClick={() => setShowDateEventsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {(() => {
                const year = selectedDateForEvents.getFullYear();
                const month = String(selectedDateForEvents.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDateForEvents.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                const dayEvents = teamEvents.filter(event => event.date === dateStr);

                if (dayEvents.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📅</div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">予定がありません</h4>
                      <p className="text-gray-500 mb-6">この日に予定を追加してみましょう</p>
                      <button
                        onClick={() => {
                          openAddEventModal(selectedDateForEvents);
                          setShowDateEventsModal(false);
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        予定を追加
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {dayEvents
                      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      .map((event) => (
                        <div
                          key={event.id}
                          className="border border-gray-200 rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold text-gray-900">{event.title}</h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  openEditEventModal(event);
                                  setShowDateEventsModal(false);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="編集"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('この予定を削除しますか？')) {
                                    handleDeleteEvent(event.id);
                                  }
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{event.time}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.attendees && Array.isArray(event.attendees) && event.attendees.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>参加者</span>
                              </div>
                              <div className="flex flex-wrap gap-2 ml-6">
                                {event.attendees.map((attendeeId: string) => {
                                  const member = teamMembers.find(m => m.id === attendeeId);
                                  const displayName = member?.displayName || attendeeId;
                                  return (
                                    <span
                                      key={attendeeId}
                                      className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                                    >
                                      {displayName}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {event.description && (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700">説明</div>
                              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 ml-6 whitespace-pre-wrap leading-relaxed">
                                {renderDescription(event.description)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 予定詳細モーダル（右側からスライドイン） */}
      {showEventDetailModal && selectedEventDetail && (
        <>
          <style jsx>{`
            @keyframes slideInFromRight {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
            .slide-in-right {
              animation: slideInFromRight 0.3s ease-out;
            }
          `}</style>
          <div 
            className="fixed inset-0 z-50 flex items-end justify-end"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
            onClick={() => {
              setShowEventDetailModal(false);
              setSelectedEventDetail(null);
            }}
          >
            <div 
              className="bg-white w-full max-w-md h-full shadow-2xl slide-in-right overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <h3 className="text-xl font-bold text-gray-900">予定の詳細</h3>
                <button
                  onClick={() => {
                    setShowEventDetailModal(false);
                    setSelectedEventDetail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* タイトル */}
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedEventDetail.title}</h4>
                </div>

                {/* 時間 */}
                {selectedEventDetail.time && (
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-base">{selectedEventDetail.time}</span>
                  </div>
                )}

                {/* 日付 */}
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-base">
                    {selectedEventDetail.date.split('-').join('/')}
                  </span>
                </div>

                {/* 場所 */}
                {selectedEventDetail.location && (
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-base">{selectedEventDetail.location}</span>
                  </div>
                )}

                {/* 参加者 */}
                {selectedEventDetail.attendees && Array.isArray(selectedEventDetail.attendees) && selectedEventDetail.attendees.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>参加者</span>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-8">
                      {selectedEventDetail.attendees.map((attendeeId: string) => {
                        const member = teamMembers.find(m => m.id === attendeeId);
                        const displayName = member?.displayName || attendeeId;
                        return (
                          <span
                            key={attendeeId}
                            className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                          >
                            {displayName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 説明 */}
                {selectedEventDetail.description && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700">説明</div>
                    <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
                      {renderDescription(selectedEventDetail.description)}
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      openEditEventModal(selectedEventDetail);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('この予定を削除しますか？')) {
                        handleDeleteEvent(selectedEventDetail.id);
                        setShowEventDetailModal(false);
                        setSelectedEventDetail(null);
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <SimpleCalendarView />
      </Layout>
    </ProtectedRoute>
  );
}

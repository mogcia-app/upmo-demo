"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Layout from "../components/Layout";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";
import { fetchChatSession, updateChatSession, saveChatSession } from "../utils/chatHistory";


// シンプルなカレンダーコンポーネント（右側用）
const SimpleCalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
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
  }>>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [showDateEventsModal, setShowDateEventsModal] = useState(false);
  const [selectedDateForEvents, setSelectedDateForEvents] = useState<Date | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<{
    id: string;
    title: string;
    date: string;
    time?: string;
    member: string;
    color: string;
    description?: string;
    location?: string;
    attendees?: string[];
  } | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    id: string;
    title: string;
    date: string;
    time: string;
    description: string;
    location: string;
    color: string;
  } | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    location: '',
    color: '#3B82F6',
    attendees: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
  }>>([]);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);

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
          // 現在のユーザーのcompanyNameを取得
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
      if (!user || teamMembers.length === 0) return; // teamMembersが読み込まれるまで待つ

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
              // userIdからユーザー名を取得
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
              attendees: event.attendees || []
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
      attendees: []
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
          color: newEvent.color,
          attendees: newEvent.attendees || []
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
              setTeamEvents(loadData.events.map((event: any) => {
                // userIdからユーザー名を取得
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
                attendees: event.attendees || []
                };
              }));
            }
          }
          setShowAddEventModal(false);
          setNewEvent({
            title: '',
            date: '',
            time: '',
            description: '',
            location: '',
            color: '#3B82F6',
            attendees: []
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

  // 予定の詳細を表示するモーダルを開く
  const openEventDetailModal = (event: typeof teamEvents[0]) => {
    setSelectedEventForDetail(event);
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
      color: event.color || '#3B82F6'
    });
    setNewEvent({
      title: event.title,
      date: event.date,
      time: event.time || '',
      description: event.description || '',
      location: event.location || '',
      color: event.color || '#3B82F6',
      attendees: event.attendees || []
    });
    setShowAddEventModal(true);
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
            // userIdからユーザー名を取得
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
          attendees: event.attendees || []
            };
          }));
      }
    }
  };

  // 予定を保存（追加または更新）
  const handleSaveEvent = async () => {
    if (!user || !newEvent.title.trim() || !newEvent.date) return;

    setIsSubmitting(true);
    try {
      const token = await user.getIdToken();
      
      if (editingEvent) {
        // 更新
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
            attendees: newEvent.attendees || []
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
              attendees: []
            });
          }
        } else {
          const error = await response.json();
          alert(error.error || '予定の更新に失敗しました');
        }
      } else {
        // 追加
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
            await reloadEvents(token);
            setShowAddEventModal(false);
            setNewEvent({
              title: '',
              date: '',
              time: '',
              description: '',
              location: '',
              color: '#3B82F6',
              attendees: []
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

  const days = generateMonthDays();
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"]; // getDay()の戻り値に合わせて日曜日を最初に

  return (
    <div>
      {/* 月ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {currentDate.getFullYear()}年{monthNames[currentDate.getMonth()]}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth('prev')}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => changeMonth('next')}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="mb-6">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {day}
            </div>
          ))}
        </div>
        
        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={index} className="min-h-[70px]"></div>;
            }
            
            const today = isToday(date);
            const dayEvents = getEventsForDate(date);
            const hasEvents = dayEvents.length > 0;
            
            return (
              <button
                key={date.toISOString()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDateEventsModal(date);
                }}
                className={`min-h-[70px] p-1 flex flex-col rounded-lg text-sm transition-all ${
                  today 
                    ? 'bg-[#005eb2] text-white font-semibold' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className={`text-center mb-1 font-medium ${today ? 'text-white' : 'text-gray-900'}`}>{date.getDate()}</span>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                {hasEvents && (
                    <>
                      {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                          className={`text-xs leading-tight px-1.5 py-0.5 rounded truncate border-l-2 ${
                            today 
                              ? 'bg-white/20 text-white' 
                              : 'bg-gray-50 text-gray-900'
                          }`}
                          style={{
                            borderLeftColor: event.color || '#3B82F6'
                          }}
                          title={event.title}
                        >
                          {event.title}
                    </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className={`text-[10px] px-1.5 py-0.5 truncate ${today ? 'text-white/90' : 'text-gray-500'}`}>
                          その他{dayEvents.length - 3}件
                      </div>
                      )}
                    </>
                    )}
                  </div>
                  </button>
              );
            })}
          </div>
        </div>


      {/* 予定詳細モーダル */}
      {showEventDetailModal && selectedEventForDetail && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEventDetailModal(false);
            setSelectedEventForDetail(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">予定の詳細</h3>
              <button
                onClick={() => {
                  setShowEventDetailModal(false);
                  setSelectedEventForDetail(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{selectedEventForDetail.title}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">
                    {(() => {
                      const eventDate = new Date(selectedEventForDetail.date);
                      return `${eventDate.getFullYear()}年${eventDate.getMonth() + 1}月${eventDate.getDate()}日`;
                    })()}
                  </div>
                </div>
                {selectedEventForDetail.time && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">時間</label>
                    <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{selectedEventForDetail.time}</div>
                  </div>
                )}
              </div>

              {selectedEventForDetail.attendees && selectedEventForDetail.attendees.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">参加者</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedEventForDetail.attendees.map((attendeeId) => {
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

              {selectedEventForDetail.location && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900">{selectedEventForDetail.location}</div>
                </div>
              )}

              {selectedEventForDetail.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-900 whitespace-pre-wrap">{selectedEventForDetail.description}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEventDetailModal(false);
                  setSelectedEventForDetail(null);
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  setShowEventDetailModal(false);
                  setSelectedEventForDetail(null);
                  openEditEventModal(selectedEventForDetail);
                }}
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors"
              >
                編集
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予定追加ボタン */}
      <button
        onClick={() => openAddEventModal()}
        className="w-full mt-4 px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] transition-colors text-sm font-medium flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        予定を追加
      </button>

      {/* 予定追加モーダル */}
      {showAddEventModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddEventModal(false);
            setEditingEvent(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {editingEvent ? '予定を編集' : '予定を追加'}
              </h3>
              <div className="flex items-center gap-2">
                {editingEvent && (
                  <button
                    onClick={() => handleDeleteEvent(editingEvent.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="削除"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowAddEventModal(false);
                    setEditingEvent(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
                  参加者
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between bg-white"
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
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-gray-500">利用者がいません</div>
                      ) : (
                        teamMembers.map((member) => (
                          <label
                            key={member.id}
                            className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newEvent.attendees.includes(member.id)}
                              onChange={() => toggleAttendee(member.id)}
                              className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700">{member.displayName}</span>
                          </label>
                        ))
                      )}
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
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                        >
                          {displayName}
                          <button
                            type="button"
                            onClick={() => toggleAttendee(attendeeId)}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
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
                className="px-4 py-2 bg-[#005eb2] text-white rounded-lg hover:bg-[#004a96] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-4 sm:p-6 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDateForEvents.getFullYear()}年{selectedDateForEvents.getMonth() + 1}月{selectedDateForEvents.getDate()}日の予定
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {dayNames[selectedDateForEvents.getDay()]}曜日
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
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {dayEvents
                      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      .map((event) => {
                        return (
                          <div
                            key={event.id}
                            className="border border-gray-200 rounded-lg p-4 space-y-3 relative"
                          >
                            {/* 編集・削除ボタン */}
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  openEditEventModal(event);
                                  setShowDateEventsModal(false);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
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
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* タイトル */}
                            <div className="pr-20">
                              <h4 className="text-lg font-semibold text-gray-900">{event.title}</h4>
                            </div>
                            
                            {/* 時間 */}
                            {event.time && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{event.time}</span>
                              </div>
                            )}
                            
                            {/* 場所 */}
                            {event.location && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{event.location}</span>
                              </div>
                            )}
                            
                            {/* 参加者 */}
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
                            
                            {/* 説明 */}
                            {event.description && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700">説明</div>
                                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 ml-6 whitespace-pre-wrap leading-relaxed">
                                  {event.description.split('\n').map((line: string, index: number) => {
                                    // 箇条書きの検出（-、•、*、数字で始まる行）
                                    const isBullet = /^[\s]*[-•*]\s/.test(line) || /^[\s]*\d+[\.\)]\s/.test(line);
                                    if (isBullet) {
                                      return (
                                        <div key={index} className="flex items-start gap-2 my-1">
                                          <span className="text-gray-400 mt-1">•</span>
                                          <span className="flex-1">{line.replace(/^[\s]*[-•*]\s/, '').replace(/^[\s]*\d+[\.\)]\s/, '')}</span>
                                        </div>
                                      );
                                    }
                                    // 空行の処理
                                    if (line.trim() === '') {
                                      return <div key={index} className="h-2" />;
                                    }
                                    // 通常の行
                                    return (
                                      <div key={index} className="my-1">
                                        {line}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// リアルタイムカレンダーコンポーネント（既存のもの、後で削除する可能性あり）
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
    description?: string;
    location?: string;
    attendees?: string[];
  }>>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    location: '',
    color: '#3B82F6',
    attendees: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
  }>>([]);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [showDateEventsModal, setShowDateEventsModal] = useState(false);
  const [selectedDateForEvents, setSelectedDateForEvents] = useState<Date | null>(null);

  // 日付をクリックしてその日の予定一覧を表示
  const openDateEventsModal = (date: Date) => {
    const dateForState = new Date(date.getTime());
    setSelectedDateForEvents(dateForState);
    setShowDateEventsModal(true);
  };

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
          if (data.success && data.users) {
            const members = data.users.map((u: any) => ({
              id: u.uid,
              displayName: u.displayName || u.email,
              email: u.email
            }));
            setTeamMembers(members);
          }
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
      if (!user || teamMembers.length === 0) return; // teamMembersが読み込まれるまで待つ

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
              // userIdからユーザー名を取得
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
              attendees: event.attendees || []
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
      color: '#3B82F6',
      attendees: []
    });
    setShowAddEventModal(true);
  };

  // 予定を編集するモーダルを開く
  const openEditEventModal = (event: typeof teamEvents[0]) => {
    const year = event.date.split('-')[0];
    const month = event.date.split('-')[1];
    const day = event.date.split('-')[2];
    const targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    setSelectedDate(targetDate);
    setNewEvent({
      title: event.title,
      date: event.date,
      time: event.time || '',
      description: '',
      location: '',
      color: event.color || '#3B82F6',
      attendees: []
    });
    setShowAddEventModal(true);
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
      } else {
        const error = await response.json();
        alert(error.error || '予定の削除に失敗しました');
      }
    } catch (error) {
      console.error('予定削除エラー:', error);
      alert('予定の削除に失敗しました');
    }
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
              setTeamEvents(loadData.events.map((event: any) => {
                // userIdからユーザー名を取得
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
                  attendees: event.attendees || []
                };
              }));
            }
          }
          setShowAddEventModal(false);
          setNewEvent({
            title: '',
            date: '',
            time: '',
            description: '',
            location: '',
            color: '#3B82F6',
            attendees: []
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
                        className="text-sm px-2 py-1.5 rounded flex items-center justify-between group cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ 
                          backgroundColor: event.color + '20',
                          borderLeft: `3px solid ${event.color}`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditEventModal(event);
                        }}
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{event.title}</div>
                          {event.time && (
                            <div className="text-xs text-gray-500">{event.time} - {event.member}</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 ml-2"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDateEventsModal(date);
                }}
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
                      <div className="truncate">{event.title}</div>
                      <div className="text-[9px] opacity-90 truncate">{event.member}</div>
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
            className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
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
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-4 sm:p-6 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedDateForEvents.getFullYear()}年{selectedDateForEvents.getMonth() + 1}月{selectedDateForEvents.getDate()}日の予定
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {dayNames[selectedDateForEvents.getDay()]}曜日
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
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {dayEvents
                      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      .map((event) => {
                        return (
                          <div
                            key={event.id}
                            className="border border-gray-200 rounded-lg p-4 space-y-3 relative"
                          >
                            {/* 編集・削除ボタン */}
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                              <button
                                onClick={() => {
                                  openEditEventModal(event);
                                  setShowDateEventsModal(false);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
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
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="削除"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            
                            {/* タイトル */}
                            <div className="pr-20">
                              <h4 className="text-lg font-semibold text-gray-900">{event.title}</h4>
                            </div>
                            
                            {/* 時間 */}
                            {event.time && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{event.time}</span>
                              </div>
                            )}
                            
                            {/* 場所 */}
                            {event.location && (
                              <div className="flex items-center gap-2 text-sm text-gray-700">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>{event.location}</span>
                              </div>
                            )}
                            
                            {/* 参加者 */}
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
                            
                            {/* 説明 */}
                            {event.description && (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-700">説明</div>
                                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 ml-6 whitespace-pre-wrap leading-relaxed">
                                  {event.description.split('\n').map((line: string, index: number) => {
                                    // 箇条書きの検出（-、•、*、数字で始まる行）
                                    const isBullet = /^[\s]*[-•*]\s/.test(line) || /^[\s]*\d+[\.\)]\s/.test(line);
                                    if (isBullet) {
                                      return (
                                        <div key={index} className="flex items-start gap-2 my-1">
                                          <span className="text-gray-400 mt-1">•</span>
                                          <span className="flex-1">{line.replace(/^[\s]*[-•*]\s/, '').replace(/^[\s]*\d+[\.\)]\s/, '')}</span>
                                        </div>
                                      );
                                    }
                                    // 空行の処理
                                    if (line.trim() === '') {
                                      return <div key={index} className="h-2" />;
                                    }
                                    // 通常の行
                                    return (
                                      <div key={index} className="my-1">
                                        {line}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
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
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    displayName: string;
    email: string;
  }>>([]);

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
          if (data.success && data.users) {
            const members = data.users.map((u: any) => ({
              id: u.uid,
              displayName: u.displayName || u.email,
              email: u.email
            }));
            setTeamMembers(members);
          }
        }
      } catch (error) {
        console.error('チームメンバーの読み込みエラー:', error);
      }
    };

    loadTeamMembers();
  }, [user]);

  useEffect(() => {
    const loadTodayEvents = async () => {
      if (!user || teamMembers.length === 0) return; // teamMembersが読み込まれるまで待つ
      
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
            setTodayEvents(data.events.map((event: any) => {
              // userIdからユーザー名を取得
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
              location: event.location || ''
              };
            }));
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
  const router = useRouter();

  // Markdownリンクをレンダリングする関数
  const renderMessageWithLinks = (text: string) => {
    // Markdownリンクのパターン: [テキスト](URL) - 改行を含む場合も考慮
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | React.ReactElement)[] = [];
    let match;
    let key = 0;

    // テキストを行ごとに分割して処理
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        // 改行を追加
        parts.push('\n');
      }
      
      let lineLastIndex = 0;
      linkPattern.lastIndex = 0; // 正規表現をリセット
      
      while ((match = linkPattern.exec(line)) !== null) {
        // リンクの前のテキスト
        if (match.index > lineLastIndex) {
          parts.push(line.substring(lineLastIndex, match.index));
        }
        
        // リンク
        const linkText = match[1];
        const linkUrl = match[2];
        parts.push(
          <a
            key={`link-${key++}`}
            href={linkUrl}
            onClick={(e) => {
              e.preventDefault();
              router.push(linkUrl);
            }}
            className="text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
          >
            {linkText}
          </a>
        );
        
        lineLastIndex = linkPattern.lastIndex;
      }
      
      // 残りのテキスト
      if (lineLastIndex < line.length) {
        parts.push(line.substring(lineLastIndex));
      }
    });
    
    return parts.length > 0 ? <>{parts}</> : text;
  };

  // 通常のダッシュボード表示用のstate（すべてのHooksを早期リターンの前に配置）
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [taskStats, setTaskStats] = useState({ completed: 0, pending: 0, today: 0 });
  const [contractCount, setContractCount] = useState(0);
  const [teamMembersCount, setTeamMembersCount] = useState(0);
  const [recentDocuments, setRecentDocuments] = useState<Array<{
    id: string;
    title: string;
    lastUpdated: Date;
    type: string;
    href: string;
  }>>([]);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
  }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [favoriteQuestions, setFavoriteQuestions] = useState<Array<{ id: string; text: string; icon: string }>>([
    { id: '1', text: '使い方を教えて', icon: '💡' },
    { id: '2', text: 'よくある質問を教えて', icon: '❓' },
    { id: '3', text: 'TODOリストについて教えて', icon: '📋' },
    { id: '4', text: '契約書について教えて', icon: '📄' },
    { id: '5', text: '今日のタスクは？', icon: '✅' },
    { id: '6', text: '利用者について教えて', icon: '👥' },
  ]);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');

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
            setTeamMembersCount(data.stats.teamMembersCount || 0);
          }
        } else {
          console.error('統計情報の取得に失敗:', await response.text());
        }
      } catch (error) {
        console.error('統計情報の読み込みエラー:', error);
      }
    };

    loadStats();
  }, [user]);

  // 最近の更新を取得（14日以内）
  useEffect(() => {
    const loadRecentUpdates = async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken();
        const now = new Date();
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        
        const updates: Array<{
          id: string;
          title: string;
          lastUpdated: Date;
          type: string;
          href: string;
        }> = [];

        // 契約書を取得
        try {
          const contractsResponse = await fetch('/api/admin/get-manual-documents', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

          if (contractsResponse.ok) {
            const contractsData = await contractsResponse.json();
            if (contractsData.success && contractsData.documents) {
              contractsData.documents.forEach((doc: any) => {
                const updatedAt = doc.updatedAt ? new Date(doc.updatedAt.seconds * 1000) : 
                                 doc.createdAt ? new Date(doc.createdAt.seconds * 1000) : 
                                 doc.lastUpdated ? new Date(doc.lastUpdated) : new Date();
                if (updatedAt >= fourteenDaysAgo) {
                  updates.push({
                id: doc.id,
                    title: doc.title || '無題',
                    lastUpdated: updatedAt,
                    type: '契約書',
                    href: `/admin/contracts?doc=${doc.id}`
                  });
                }
              });
          }
        }
      } catch (error) {
          console.error('契約書の取得エラー:', error);
        }

        // TODOを取得
        try {
          const todosResponse = await fetch('/api/todos', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (todosResponse.ok) {
            const todosData = await todosResponse.json();
            if (todosData.success && todosData.todos) {
              todosData.todos.forEach((todo: any) => {
                const updatedAt = todo.updatedAt ? new Date(todo.updatedAt.seconds * 1000) : 
                                 todo.createdAt ? new Date(todo.createdAt.seconds * 1000) : new Date();
                if (updatedAt >= fourteenDaysAgo) {
                  updates.push({
                    id: todo.id,
                    title: todo.text || '無題のタスク',
                    lastUpdated: updatedAt,
                    type: 'TODO',
                    href: '/todo'
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('TODOの取得エラー:', error);
        }

        // 顧客を取得
        try {
          const customersResponse = await fetch('/api/customers', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (customersResponse.ok) {
            const customersData = await customersResponse.json();
            if (customersData.success && customersData.customers) {
              customersData.customers.forEach((customer: any) => {
                const updatedAt = customer.updatedAt ? new Date(customer.updatedAt.seconds * 1000) : 
                                 customer.createdAt ? new Date(customer.createdAt.seconds * 1000) : new Date();
                if (updatedAt >= fourteenDaysAgo) {
                  updates.push({
                    id: customer.id,
                    title: customer.name || '無題の顧客',
                    lastUpdated: updatedAt,
                    type: '顧客',
                    href: `/customers?customer=${customer.id}`
                  });
                }
              });
            }
          }
        } catch (error) {
          console.error('顧客の取得エラー:', error);
        }

        // 更新日時でソートして最新5件を取得
        updates.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        setRecentDocuments(updates.slice(0, 5));
      } catch (error) {
        console.error('最近の更新の読み込みエラー:', error);
      }
    };

    loadRecentUpdates();
    // 30秒ごとに更新
    const interval = setInterval(loadRecentUpdates, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // 初期AIメッセージを表示
  useEffect(() => {
    if (chatMessages.length === 0 && user) {
      // 最初に「入力中...」を表示
      const typingMessage = {
        id: 'initial-typing',
        text: '入力中...',
        sender: 'ai' as const,
        timestamp: new Date()
      };
      setChatMessages([typingMessage]);

      // 3秒後に挨拶メッセージに変更
      const timer = setTimeout(() => {
        const greetingMessage = {
          id: 'initial-greeting',
          text: 'こんにちは！なんでも聞いてくださいね。',
          sender: 'ai' as const,
          timestamp: new Date()
        };
        setChatMessages([greetingMessage]);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [user]); // userが変更された時のみ実行

  // チャットメッセージが更新されたら自動スクロール
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // AIチャットで回答を生成
  const generateAIResponse = async (query: string): Promise<string> => {
    if (!user) return "ユーザーが認証されていません。";

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: query
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.response || '申し訳ございません。回答を生成できませんでした。';
      } else {
        const errorData = await response.json();
        return errorData.response || 'エラーが発生しました。もう一度お試しください。';
      }
    } catch (error) {
      console.error('AI回答生成エラー:', error);
      return 'エラーが発生しました。もう一度お試しください。';
    }
  };

  // チャットメッセージをFirestoreに保存
  const saveChatMessagesToFirestore = async (messages: Array<{
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
  }>) => {
    if (!user) return;
    
    try {
      const chatMessagesForFirestore = messages.map(msg => ({
        id: msg.id,
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.timestamp
      }));
      
      if (currentSessionId) {
        // 既存のセッションを更新
        await updateChatSession(currentSessionId, chatMessagesForFirestore, companyName || undefined);
      } else {
        // 新しいセッションを作成
        const sessionId = await saveChatSession({
          userId: user.uid,
          chatId: 'ai-assistant',
          messages: chatMessagesForFirestore,
          lastUpdated: new Date(),
          companyName: companyName || undefined
        });
        setCurrentSessionId(sessionId);
      }
    } catch (error) {
      console.error('チャット履歴の保存エラー:', error);
    }
  };

  // よく使う質問を追加
  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) return;
    
    const newQuestion = {
      id: Date.now().toString(),
      text: newQuestionText.trim(),
      icon: '' // アイコンは不要
    };
    
    setFavoriteQuestions(prev => [...prev, newQuestion]);
    setShowAddQuestionModal(false);
    setNewQuestionText('');
  };

  // チャットメッセージ送信
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading || !user) return;

    const userMessage = {
      id: Date.now().toString(),
      text: chatInput.trim(),
      sender: 'user' as const,
      timestamp: new Date()
    };

    const updatedMessages = [...chatMessages, userMessage];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsChatLoading(true);
    
    // ユーザーメッセージを保存
    saveChatMessagesToFirestore(updatedMessages);

    // ローディングメッセージを追加
    const loadingMessage = {
      id: "loading",
      text: "考え中...",
      sender: 'ai' as const,
      timestamp: new Date()
    };
    setChatMessages(prev => [...prev, loadingMessage]);

    try {
      // AIで回答を生成
      const aiResponse = await generateAIResponse(userMessage.text);
      
      // ローディングメッセージを削除してAI回答を追加
      setChatMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== "loading");
        const updatedMessages = [...withoutLoading, {
          id: (Date.now() + 1).toString(),
          text: aiResponse,
          sender: 'ai' as const,
          timestamp: new Date()
        }];
        
        // Firestoreに保存
        saveChatMessagesToFirestore(updatedMessages);
        
        return updatedMessages;
      });
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      setChatMessages(prev => {
        const withoutLoading = prev.filter(msg => msg.id !== "loading");
        return [...withoutLoading, {
          id: (Date.now() + 1).toString(),
          text: "申し訳ございません。エラーが発生しました。",
          sender: 'ai' as const,
          timestamp: new Date()
        }];
      });
    } finally {
      setIsChatLoading(false);
    }
  };

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
  
  // 現在の日付と時刻を取得
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('ja-JP', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });
  const formattedTime = currentDate.toLocaleTimeString('ja-JP', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  return (
    <ProtectedRoute>
      <Layout>
        <div className="h-full flex flex-col">
          {/* メインコンテンツエリア - 2カラムレイアウト */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
            {/* 左側: AIチャット */}
            <div className="flex-1 bg-white rounded-xl shadow-md border border-gray-200 flex flex-col h-full overflow-hidden">
              {/* ヘッダー */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-gray-200 overflow-hidden relative">
                  <Image 
                    src="/upmoicon.png" 
                    alt="AIアシスタント" 
                    width={40}
                    height={40}
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">AIアシスタント</h2>
                </div>
              </div>

              {/* チャットメッセージエリア */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
                <div 
                  className="p-4 space-y-3 overflow-y-auto flex-1"
                  style={{ 
                    maxHeight: '100%',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-400 py-12">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-sm">メッセージを入力して会話を始めましょう</p>
                      </div>
                    ) : (
                      chatMessages.map((message, index) => {
                        const showTimestamp = index === 0 || 
                          chatMessages[index - 1].sender !== message.sender ||
                          new Date(message.timestamp).getTime() - new Date(chatMessages[index - 1].timestamp).getTime() > 300000; // 5分以上経過
                        
                        return (
                          <div key={message.id}>
                            {showTimestamp && (
                              <div className="text-center my-2">
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                  {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            )}
                            <div
                              className={`flex items-end gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.sender === 'ai' && (
                                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 mb-1 border border-gray-200 overflow-hidden relative">
                                  <Image 
                                    src="/upmoicon.png" 
                                    alt="AI" 
                                    width={32}
                                    height={32}
                                    className="object-cover"
                                    unoptimized
                                  />
                            </div>
                          )}
                              <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%]`}>
                            <div
                                  className={`rounded-2xl px-4 py-2.5 ${
                                message.sender === 'user'
                                      ? 'bg-[#1958ec] text-white rounded-br-sm'
                                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                              }`}
                            >
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {message.sender === 'ai' 
                                      ? renderMessageWithLinks(message.text)
                                      : message.text
                                    }
                                  </p>
                              {message.id === "loading" && (
                                <div className="flex gap-1 mt-2">
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                              )}
                            </div>
                          </div>
                          {message.sender === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mb-1">
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                          </div>
                        );
                      })
                    )}
                  <div ref={chatMessagesEndRef} />
                </div>
              </div>

              {/* チャット入力エリア */}
              <div className="border-t border-gray-200 bg-white px-4 py-3">
                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                    placeholder="メッセージを入力..."
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={isChatLoading}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={isChatLoading || !chatInput.trim()}
                    className="w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
                  >
                    {isChatLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              </div>
              
            {/* 右側: サイドバー */}
            <div className="hidden lg:flex w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* よく使う質問 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">よく使う質問</h3>
                  <button
                      onClick={() => setShowAddQuestionModal(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                      + 追加
                  </button>
                  </div>
                  <div className="space-y-2">
                    {favoriteQuestions.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center gap-2"
                      >
                  <button
                    onClick={() => {
                            setChatInput(item.text);
                      setTimeout(() => handleChatSend(), 100);
                    }}
                    disabled={isChatLoading}
                          className="flex-1 text-left px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                          {item.text}
                  </button>
                  <button
                    onClick={() => {
                            setFavoriteQuestions(prev => prev.filter(q => q.id !== item.id));
                    }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:text-red-800 transition-opacity"
                          title="削除"
                  >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                  </button>
                      </div>
                    ))}
              </div>
            </div>

                 {/* 今日のタスク */}
                 <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">今日のタスク</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-gray-900">{taskStats.today}</div>
                    <div className="text-xs text-gray-500 mt-1">件のタスクがあります</div>
                    <Link
                      href="/todo"
                      className="mt-3 inline-block text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      タスク一覧を見る →
                    </Link>
            </div>
          </div>

                {/* 最近の更新 */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">最近の更新</h3>
                  {recentDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {recentDocuments.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="block px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.title}</div>
                              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {item.type}
                                </span>
                                <span>{item.lastUpdated.toLocaleDateString('ja-JP')}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-sm text-gray-500 bg-gray-50 rounded-lg">
                      ここに最近の更新情報が表示されます
                    </div>
                  )}
                </div>

               

              </div>
            </div>
          </div>

          {/* よく使う質問追加モーダル */}
          {showAddQuestionModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => {
                setShowAddQuestionModal(false);
                setNewQuestionText('');
              }}
            >
              <div 
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">よく使う質問を追加</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      質問文 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      placeholder="例: 使い方を教えて"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newQuestionText.trim()) {
                          handleAddQuestion();
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowAddQuestionModal(false);
                      setNewQuestionText('');
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleAddQuestion}
                    disabled={!newQuestionText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    追加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

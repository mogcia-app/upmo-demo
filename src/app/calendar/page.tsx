'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, currentDate]);

  const loadEvents = async () => {
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
          setEvents(data.events);
        }
      }
    } catch (error) {
      console.error('イベントの読み込みエラー:', error);
    }
  };

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  const generateMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return events.filter(event => event.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const days = generateMonthDays();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">カレンダー</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                {currentDate.getFullYear()}年{monthNames[currentDate.getMonth()]}
              </h2>
              <button
                onClick={() => changeMonth('next')}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
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
            <div className="grid grid-cols-7 gap-2">
              {days.map((date, index) => {
                if (!date) {
                  return <div key={index} className="aspect-square"></div>;
                }
                const today = isToday(date);
                const dayEvents = getEventsForDate(date);
                return (
                  <div
                    key={date.toISOString()}
                    className={`aspect-square p-2 border-2 rounded-lg ${
                      today
                        ? 'bg-[#005eb2] text-white border-[#005eb2]'
                        : dayEvents.length > 0
                        ? 'bg-sky-50 border-sky-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${today ? 'text-white' : 'text-gray-900'}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs px-1 py-0.5 rounded truncate"
                          style={{
                            backgroundColor: event.color || '#3B82F6',
                            color: 'white'
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}



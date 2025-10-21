"use client";

import React, { useState } from "react";
import { CalendarComponent as CalendarComponentType } from "../types/components";

interface CalendarComponentProps {
  component: CalendarComponentType;
  onUpdate?: (component: CalendarComponentType) => void;
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({ component, onUpdate }) => {
  const [events, setEvents] = useState(component.config.events || []);
  const [view, setView] = useState(component.config.view || 'month');
  const [showWeekends, setShowWeekends] = useState<boolean>(component.config.showWeekends || true);

  // 現在の日付を取得
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);

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

  // 日表示の時間スロットを生成
  const generateDayTimeSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
      slots.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        events: getEventsForHour(hour)
      });
    }
    return slots;
  };

  // 指定された時間のイベントを取得
  const getEventsForHour = (hour: number) => {
    const dateStr = currentDate.toISOString().split('T')[0];
    return events.filter(event => {
      if (event.date !== dateStr) return false;
      if (!event.time) return false;
      const eventHour = parseInt(event.time.split(':')[0]);
      return eventHour === hour;
    });
  };

  // 指定された日付のイベントを取得
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  // 新しいイベントを追加
  const addEvent = () => {
    const newEvent = {
      id: `event_${Date.now()}`,
      title: "新しいイベント",
      date: today.toISOString().split('T')[0],
      time: "10:00",
      description: "",
      color: "#3B82F6"
    };
    
    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);
    
    if (onUpdate) {
      onUpdate({
        ...component,
        config: {
          ...component.config,
          events: updatedEvents
        }
      });
    }
  };

  // イベントを削除
  const deleteEvent = (eventId: string) => {
    const updatedEvents = events.filter(event => event.id !== eventId);
    setEvents(updatedEvents);
    
    if (onUpdate) {
      onUpdate({
        ...component,
        config: {
          ...component.config,
          events: updatedEvents
        }
      });
    }
  };

  // イベントを更新
  const updateEvent = (eventId: string, field: string, value: string) => {
    const updatedEvents = events.map(event => 
      event.id === eventId ? { ...event, [field]: value } : event
    );
    setEvents(updatedEvents);
    
    if (onUpdate) {
      onUpdate({
        ...component,
        config: {
          ...component.config,
          events: updatedEvents
        }
      });
    }
  };

  // 期間を変更
  const changePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    if (view === 'month') {
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
    } else if (view === 'week') {
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
    } else if (view === 'day') {
      if (direction === 'prev') {
        newDate.setDate(newDate.getDate() - 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
    }
    
    setCurrentDate(newDate);
  };

  const days = generateMonthDays();
  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ];
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{component.title}</h3>
          <div className="flex space-x-2">
            <button
              onClick={addEvent}
              className="px-3 py-1 bg-[#005eb2] text-white text-sm rounded hover:bg-[#004a96] transition-colors"
            >
              + イベント追加
            </button>
          </div>
        </div>

        {/* ビュー切り替え */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex space-x-1">
            {(['month', 'week', 'day'] as const).map((viewType) => (
              <button
                key={viewType}
                onClick={() => setView(viewType)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  view === viewType
                    ? 'bg-[#005eb2] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {viewType === 'month' ? '月' : viewType === 'week' ? '週' : '日'}
              </button>
            ))}
          </div>
          
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => setShowWeekends(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">週末を表示</span>
          </label>
        </div>

        {/* 期間ナビゲーション */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changePeriod('prev')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h4 className="text-lg font-medium text-gray-900">
            {view === 'month' && `${currentDate.getFullYear()}年${monthNames[currentDate.getMonth()]}`}
            {view === 'week' && (() => {
              const weekDays = generateWeekDays();
              const startDate = weekDays[0];
              const endDate = weekDays[6];
              return `${startDate.getMonth() + 1}月${startDate.getDate()}日 - ${endDate.getMonth() + 1}月${endDate.getDate()}日`;
            })()}
            {view === 'day' && `${currentDate.getMonth() + 1}月${currentDate.getDate()}日 (${dayNames[currentDate.getDay()]})`}
          </h4>
          
          <button
            onClick={() => changePeriod('next')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="p-4">
        {view === 'month' && (
          <div className="grid grid-cols-7 gap-1">
            {/* 曜日ヘッダー */}
            {dayNames.map((day, index) => (
              <div
                key={day}
                className={`p-2 text-center text-sm font-medium ${
                  index === 0 || index === 6 ? 'text-red-500' : 'text-gray-700'
                }`}
              >
                {day}
              </div>
            ))}
            
            {/* 日付 */}
            {days.map((date, index) => {
              if (!date) {
                return <div key={index} className="p-2 h-16"></div>;
              }
              
              const dayEvents = getEventsForDate(date);
              const isToday = date.toDateString() === today.toDateString();
              
              return (
                <div
                  key={date.toISOString()}
                  className={`p-1 h-16 border border-gray-100 ${
                    isToday ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded truncate"
                        style={{ backgroundColor: event.color || '#3B82F6', color: 'white' }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{dayEvents.length - 2} 件
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {view === 'week' && (() => {
          const weekDays = generateWeekDays();
          return (
            <div className="grid grid-cols-7 gap-1">
              {/* 曜日ヘッダー */}
              {dayNames.map((day, index) => (
                <div
                  key={day}
                  className={`p-2 text-center text-sm font-medium ${
                    index === 0 || index === 6 ? 'text-red-500' : 'text-gray-700'
                  }`}
                >
                  {day}
                </div>
              ))}
              
              {/* 週の日付 */}
              {weekDays.map((date) => {
                const dayEvents = getEventsForDate(date);
                const isToday = date.toDateString() === today.toDateString();
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`p-1 h-24 border border-gray-100 ${
                      isToday ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-sm font-medium ${
                      isToday ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-1 rounded truncate"
                          style={{ backgroundColor: event.color || '#3B82F6', color: 'white' }}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{dayEvents.length - 3} 件
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
        
        {view === 'day' && (() => {
          const timeSlots = generateDayTimeSlots();
          return (
            <div className="space-y-1">
              {timeSlots.map((slot) => (
                <div key={slot.hour} className="flex border-b border-gray-100">
                  <div className="w-20 p-2 text-sm text-gray-600 border-r border-gray-200">
                    {slot.time}
                  </div>
                  <div className="flex-1 p-2 min-h-12">
                    {slot.events.map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-2 rounded mb-1"
                        style={{ backgroundColor: event.color || '#3B82F6', color: 'white' }}
                      >
                        <div className="font-medium">{event.title}</div>
                        {event.time && (
                          <div className="text-xs opacity-75">{event.time}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* イベント一覧 */}
      {events.length > 0 && (
        <div className="p-4 border-t border-gray-200">
          <h5 className="text-sm font-medium text-gray-900 mb-3">イベント一覧</h5>
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: event.color || '#3B82F6' }}
                ></div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={event.title}
                    onChange={(e) => updateEvent(event.id, 'title', e.target.value)}
                    className="w-full text-sm font-medium bg-transparent border-none outline-none"
                  />
                  <div className="flex space-x-2 text-xs text-gray-500">
                    <input
                      type="date"
                      value={event.date}
                      onChange={(e) => updateEvent(event.id, 'date', e.target.value)}
                      className="bg-transparent border-none outline-none"
                    />
                    <input
                      type="time"
                      value={event.time || ''}
                      onChange={(e) => updateEvent(event.id, 'time', e.target.value)}
                      className="bg-transparent border-none outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarComponent;

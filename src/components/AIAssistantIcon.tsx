import React from 'react';

interface AIAssistantIconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const AIAssistantIcon: React.FC<AIAssistantIconProps> = ({ 
  className = "w-6 h-6", 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  return (
    <svg 
      className={`${sizeClasses[size]} ${className}`} 
      fill="currentColor" 
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Robot Icon with Blue Theme */}
      <defs>
        <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="robotAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      
      {/* Robot head */}
      <rect 
        x="6" 
        y="4" 
        width="12" 
        height="10" 
        rx="2" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      
      {/* Robot eyes */}
      <circle cx="9" cy="8" r="1.5" fill="#1E40AF" />
      <circle cx="15" cy="8" r="1.5" fill="#1E40AF" />
      
      {/* Eye highlights */}
      <circle cx="9.3" cy="7.7" r="0.4" fill="white" opacity="0.8" />
      <circle cx="15.3" cy="7.7" r="0.4" fill="white" opacity="0.8" />
      
      {/* Robot mouth */}
      <rect 
        x="10" 
        y="10" 
        width="4" 
        height="1.5" 
        rx="0.5" 
        fill="#1E40AF"
      />
      
      {/* Robot antenna */}
      <line 
        x1="12" 
        y1="4" 
        x2="12" 
        y2="2" 
        stroke="url(#robotAccent)" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      <circle cx="12" cy="1.5" r="0.8" fill="url(#robotAccent)" />
      
      {/* Robot body */}
      <rect 
        x="7" 
        y="14" 
        width="10" 
        height="8" 
        rx="1" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      
      {/* Robot chest panel */}
      <rect 
        x="9" 
        y="16" 
        width="6" 
        height="4" 
        rx="0.5" 
        fill="url(#robotAccent)" 
        opacity="0.3"
      />
      
      {/* Robot arms */}
      <rect 
        x="4" 
        y="15" 
        width="3" 
        height="6" 
        rx="1" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      <rect 
        x="17" 
        y="15" 
        width="3" 
        height="6" 
        rx="1" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      
      {/* Robot hands */}
      <circle cx="5.5" cy="21" r="1" fill="#1E40AF" />
      <circle cx="18.5" cy="21" r="1" fill="#1E40AF" />
      
      {/* Robot legs */}
      <rect 
        x="8" 
        y="22" 
        width="2.5" 
        height="2" 
        rx="0.5" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      <rect 
        x="13.5" 
        y="22" 
        width="2.5" 
        height="2" 
        rx="0.5" 
        fill="url(#robotGradient)" 
        stroke="#1E40AF" 
        strokeWidth="0.5"
      />
      
      {/* Decorative elements */}
      <circle cx="10" cy="18" r="0.5" fill="#60A5FA" opacity="0.6" />
      <circle cx="14" cy="18" r="0.5" fill="#60A5FA" opacity="0.6" />
    </svg>
  );
};

export default AIAssistantIcon;

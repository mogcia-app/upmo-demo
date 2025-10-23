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
      {/* AI Brain/Neural Network Icon */}
      <defs>
        <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      
      {/* Main circle */}
      <circle 
        cx="12" 
        cy="12" 
        r="10" 
        fill="url(#aiGradient)" 
        opacity="0.1"
      />
      
      {/* Neural network nodes */}
      <circle cx="8" cy="8" r="2" fill="url(#aiGradient)" />
      <circle cx="16" cy="8" r="2" fill="url(#aiGradient)" />
      <circle cx="12" cy="12" r="2.5" fill="url(#aiGradient)" />
      <circle cx="8" cy="16" r="2" fill="url(#aiGradient)" />
      <circle cx="16" cy="16" r="2" fill="url(#aiGradient)" />
      
      {/* Connection lines */}
      <path 
        d="M8 8 L12 12 L16 8" 
        stroke="url(#aiGradient)" 
        strokeWidth="1.5" 
        fill="none"
        opacity="0.6"
      />
      <path 
        d="M8 8 L12 12 L8 16" 
        stroke="url(#aiGradient)" 
        strokeWidth="1.5" 
        fill="none"
        opacity="0.6"
      />
      <path 
        d="M16 8 L12 12 L16 16" 
        stroke="url(#aiGradient)" 
        strokeWidth="1.5" 
        fill="none"
        opacity="0.6"
      />
      <path 
        d="M8 16 L12 12 L16 16" 
        stroke="url(#aiGradient)" 
        strokeWidth="1.5" 
        fill="none"
        opacity="0.6"
      />
      
      {/* Central AI symbol */}
      <path 
        d="M10 10 L14 10 L14 14 L10 14 Z" 
        fill="url(#aiGradient)" 
        opacity="0.8"
      />
      <path 
        d="M11 11 L13 11 L13 13 L11 13 Z" 
        fill="white" 
        opacity="0.9"
      />
    </svg>
  );
};

export default AIAssistantIcon;

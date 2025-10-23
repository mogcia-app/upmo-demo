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
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  );
};

export default AIAssistantIcon;

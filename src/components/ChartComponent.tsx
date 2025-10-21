"use client";

import React from "react";
import { ChartComponent as ChartComponentType } from "../types/components";

interface ChartComponentProps {
  component: ChartComponentType;
}

const ChartComponent: React.FC<ChartComponentProps> = ({ component }) => {
  const { config } = component;
  const data = config.data || [];

  const renderBarChart = () => {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-3">
            <div className="w-20 text-sm text-gray-600 truncate">{item.label}</div>
            <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
              <div
                className="bg-[#005eb2] h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              >
                <span className="text-white text-xs font-medium">{item.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLineChart = () => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;
    
    return (
      <div className="relative h-64">
        <svg className="w-full h-full">
          <polyline
            fill="none"
            stroke="#005eb2"
            strokeWidth="2"
            points={data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100;
              const y = 100 - ((item.value - minValue) / range) * 80;
              return `${x},${y}`;
            }).join(' ')}
          />
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((item.value - minValue) / range) * 80;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="#005eb2"
                className="cursor-pointer"
              />
            );
          })}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
          {data.map((item, index) => (
            <div key={index} className="text-center">
              <div className="font-medium">{item.value}</div>
              <div>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPieChart = () => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;
    
    return (
      <div className="relative w-64 h-64 mx-auto">
        <svg className="w-full h-full transform -rotate-90">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const startAngle = cumulativePercentage * 3.6;
            const endAngle = (cumulativePercentage + percentage) * 3.6;
            cumulativePercentage += percentage;
            
            const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
            const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
            const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
            const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
            
            const largeArcFlag = percentage > 50 ? 1 : 0;
            
            const pathData = [
              `M 50 50`,
              `L ${x1} ${y1}`,
              `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              `Z`
            ].join(' ');
            
            return (
              <path
                key={index}
                d={pathData}
                fill={item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`}
                className="cursor-pointer"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-500">合計</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAreaChart = () => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;
    
    return (
      <div className="relative h-64">
        <svg className="w-full h-full">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#005eb2" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#005eb2" stopOpacity="0.1"/>
            </linearGradient>
          </defs>
          <polygon
            fill="url(#areaGradient)"
            points={`0,100 ${data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100;
              const y = 100 - ((item.value - minValue) / range) * 80;
              return `${x},${y}`;
            }).join(' ')} 100,100`}
          />
          <polyline
            fill="none"
            stroke="#005eb2"
            strokeWidth="2"
            points={data.map((item, index) => {
              const x = (index / (data.length - 1)) * 100;
              const y = 100 - ((item.value - minValue) / range) * 80;
              return `${x},${y}`;
            }).join(' ')}
          />
        </svg>
      </div>
    );
  };

  const renderChart = () => {
    switch (config.chartType) {
      case 'bar':
        return renderBarChart();
      case 'line':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'area':
        return renderAreaChart();
      default:
        return renderBarChart();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{component.title}</h3>
        {config.title && (
          <p className="text-sm text-gray-600 mt-1">{config.title}</p>
        )}
      </div>
      
      <div className="p-6">
        {data.length > 0 ? (
          <div>
            {renderChart()}
            {config.xAxisLabel && (
              <div className="text-center text-sm text-gray-500 mt-4">
                {config.xAxisLabel}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            データがありません。コンポーネントを編集してデータを追加してください。
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartComponent;

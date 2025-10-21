export interface BaseComponent {
  id: string;
  type: ComponentType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, unknown>;
}

export enum ComponentType {
  DATA_TABLE = 'data_table',
  CHART = 'chart',
  FORM = 'form',
  TEXT = 'text',
  IMAGE = 'image',
  CALENDAR = 'calendar',
}

export interface DataTableComponent extends BaseComponent {
  type: ComponentType.DATA_TABLE;
  config: {
    columns: Array<{
      id: string;
      name: string;
      type: 'text' | 'number' | 'date' | 'select';
      options?: string[];
    }>;
    data: Record<string, string | number | Date>[];
  };
}

export interface ChartComponent extends BaseComponent {
  type: ComponentType.CHART;
  config: {
    chartType: 'bar' | 'line' | 'pie' | 'area';
    data: Array<{
      label: string;
      value: number;
      color?: string;
    }>;
    title: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
  };
}

export interface FormComponent extends BaseComponent {
  type: ComponentType.FORM;
  config: {
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'date';
      required: boolean;
      options?: string[];
    }>;
    submitAction: string;
  };
}

export interface TextComponent extends BaseComponent {
  type: ComponentType.TEXT;
  config: {
    content: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    color: string;
    alignment: 'left' | 'center' | 'right';
  };
}

export type CustomComponent = 
  | DataTableComponent 
  | ChartComponent 
  | FormComponent 
  | TextComponent;

export interface CustomTab {
  id: string;
  title: string;
  icon: string;
  route: string;
  userId: string;
  components: CustomComponent[];
  createdAt: Date;
  updatedAt: Date;
}

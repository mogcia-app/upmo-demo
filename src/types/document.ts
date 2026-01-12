export interface Document {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  fileSize: number; // bytes
  fileType: string; // 'application/pdf' etc.
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByName?: string;
  companyName: string;
  description?: string;
  tags?: string[];
  downloadCount?: number;
  isFavorite?: boolean;
}


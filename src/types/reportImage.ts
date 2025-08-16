import { TagValue } from '../hooks/tagConfig';

export interface ReportImage {
  id: string;
  report_id: string;
  url: string;
  description: string;
  tag: TagValue;
  user_id?: string;
  group?: string[];
  number?: number;
  rotation?: number;
  signedUrl?: string;
  storage_path?: string;
}

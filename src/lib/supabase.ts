import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { TagValue } from './tagConfig';

// These environment variables need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a browser-compatible Supabase client with proper cookie handling
// This uses the automatic Next.js helpers that handle auth correctly
export const supabase = createClientComponentClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey
});

// Standard client as fallback or for server functions
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application-name': 'pretium',
    },
  },
});

// Types for our database tables
export type Project = {
  id: string;
  project_name: string;
  date?: string;
  created_at: string;
  user_id: string;
  "Name"?: string;
  "Title"?: string;
  "Office"?: string;
  "Tel"?: string;
  "Cell"?: string;
  "Email"?: string;
  "Fax"?: string;
  "Project No."?: string;
  "Client Contact Name"?: string;
  "Client Company Name"?: string;
  "Client Address 1"?: string;
  "Client Address 2"?: string;
  "Client Email"?: string;
  "Client Tel"?: string;
  "Client Fax"?: string;
  "Project Title"?: string;
  "Project Address 1"?: string;
  "Project Address 2"?: string;
  "Tender Meeting Date & Time"?: string;
  "Tender Closing Date & Time"?: string;
  "Project Type"?: string;
  "Owner / Condo Corp / Building Name"?: string;
  "Owner Address 1 (if applicable)"?: string;
  "Owner Address 2 (if applicable)"?: string;
  "Owner Contact Name (if applicable)"?: string;
  "Contractor Name 1"?: string;
  "Contractor Contact Name 1"?: string;
  "Contractor Name 2"?: string;
  "Contractor Contact Name 2"?: string;
  "Contractor Name 3"?: string;
  "Contractor Contact Name 3"?: string;
  "Contractor Name 4"?: string;
  "Contractor Contact Name 4"?: string;
  "Contractor Name 5"?: string;
  "Contractor Contact Name 5"?: string;
  "Contractor Name 6"?: string;
  "Contractor Contact Name 6"?: string;
  "Contractor Name 7"?: string;
  "Contractor Contact Name 7"?: string;
  "Contractor Name 8"?: string;
  "Contractor Contact Name 8"?: string;
  "Contractor Name"?: string;
  "Total Stipulated Price (Excluding HST)"?: string;
  "Specification Date"?: string;
  "Tender Date"?: string;
  "Contractor Contact Name"?: string;
  "Contractor Company Name"?: string;
  "Contractor Address 1"?: string;
  "Contractor Address 2"?: string;
  "Contractor Email"?: string;
  "Contractor Tel"?: string;
  "Project Date"?: string;
  "Drafted By {Initials}"?: string;
  "Reviewed By {Initials}"?: string;
  "Revision No."?: string;
  [key: string]: any;
};

export type Report = {
  id: string;
  title?: string;
  project_id: string;
  bullet_points: string;
  generated_content: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
};

export type ReportImage = {
  id: string;
  report_id: string
  url: string;
  description: string;
  tag: TagValue;
  user_id?: string;
};

export type ProjectImage = {
  id: string;
  url: string;
  description: string;
  tag: TagValue;
  created_at: string;
  project_id: string;
  user_id?: string;
};

export type ChatMessage = {
  id: string;
  report_id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
};

export type ReportDocument = {
  id: string;
  report_id: string;
  filename: string;
  content: string;
  created_at: string;
}; 

export type Reference = {
  id: string;
  name: string;
  description: string;
  url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}
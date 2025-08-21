import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js';

import { TagValue } from '@/hooks/tagConfig';
import { Database, Tables } from '@/types/database.types';

// These environment variables need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Singleton pattern to ensure only one client instance for the browser
let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

// Standard client for browser-side operations (uses ANON key, respects RLS)
export const supabase = (() => {
  try {
    if (typeof window !== 'undefined') {
      // Browser environment - use singleton pattern
      if (!clientInstance) {
        clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
      }
      return clientInstance;
    }
    
    // Server environment (e.g., API routes) - create a fresh anon client
    // Note: This client is still subject to RLS and expects a user session.
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    throw new Error('Could not create Supabase client.');
  }
})();

// Admin client for server-side operations that need to bypass RLS (uses SERVICE_ROLE key)
export const createServiceRoleClient = () => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable for admin operations.');
    }
    // For server-side admin tasks, we use the core `createClient` from `@supabase/supabase-js`
    // This correctly uses the service_role key to bypass RLS without needing a user session.
    return createClient<Database>(
        supabaseUrl,
        serviceKey,
        { 
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        }
    );
};

// Types for our database tables
export type Project = Tables<'projects'>;
export type Report = Tables<'reports'>;
export type ChatMessage = Tables<'chat_messages'>;
export type ReportImage = Tables<'report_images'>;

export type ProjectImage = {
  id: string;
  url: string;
  description: string;
  tag: TagValue;
  created_at: string;
  project_id: string;
  user_id?: string;
  group?: string[];
  number?: number | null;
  rotation?: number;
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
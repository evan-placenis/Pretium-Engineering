import { supabase } from '../lib/supabase';

/**
 * Utility functions for cleaning up storage buckets
 * Use with caution - these operations cannot be undone!
 */


//TODO IN FUTURE: make fucntions for deleteing from tables/storage buckets here so they can be called throughout the code - this way we can modify the database easily (todo during capstone)
export interface StorageCleanupResult {
  bucketName: string;
  filesDeleted: number;
  errors: string[];
  success: boolean;
}

/**
 * Recursively list all files in a storage bucket (including subfolders)
 */
export async function listBucketFiles(bucketName: string, folderPath: string = ''): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(folderPath, { limit: 1000, offset: 0 });

    if (error) {
      console.error(`Error listing files in ${bucketName}/${folderPath}:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    const files: string[] = [];
    
    for (const item of data) {
      const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      
      if (item.metadata) {
        // This is a file
        files.push(fullPath);
      } else {
        // This is a folder, recursively list its contents
        const subFiles = await listBucketFiles(bucketName, fullPath);
        files.push(...subFiles);
      }
    }

    return files;
  } catch (error) {
    console.error(`Failed to list files in ${bucketName}/${folderPath}:`, error);
    throw error;
  }
}

/**
 * Delete all files from a specific storage bucket (including subfolders)
 */
export async function wipeStorageBucket(bucketName: string): Promise<StorageCleanupResult> {
  const result: StorageCleanupResult = {
    bucketName,
    filesDeleted: 0,
    errors: [],
    success: false
  };

  try {
    console.log(`Starting cleanup of ${bucketName} bucket...`);
    
    // List all files in the bucket (including subfolders)
    const files = await listBucketFiles(bucketName);
    
    if (files.length === 0) {
      console.log(`${bucketName} bucket is already empty`);
      result.success = true;
      return result;
    }

    console.log(`Found ${files.length} files in ${bucketName} bucket (including subfolders)`);

    // Delete files in batches to avoid hitting limits
    const batchSize = 100;
    const batches: string[][] = [];
    
    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    console.log(`Deleting files in ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Deleting batch ${i + 1}/${batches.length} (${batch.length} files)...`);
      
      const { error } = await supabase.storage
        .from(bucketName)
        .remove(batch);

      if (error) {
        console.error(`Error deleting batch ${i + 1} from ${bucketName}:`, error);
        result.errors.push(`Batch ${i + 1}: ${error.message}`);
      } else {
        result.filesDeleted += batch.length;
      }
    }

    result.success = result.errors.length === 0;
    console.log(`Successfully deleted ${result.filesDeleted} files from ${bucketName} bucket`);
    
  } catch (error: any) {
    console.error(`Failed to wipe ${bucketName} bucket:`, error);
    result.errors.push(error.message);
  }

  return result;
}

/**
 * Wipe all image storage buckets (project-images only)
 */
export async function wipeAllImageBuckets(): Promise<StorageCleanupResult[]> {
  const buckets = ['project-images'];
  const results: StorageCleanupResult[] = [];

  console.log('Starting cleanup of all image storage buckets...');

  for (const bucket of buckets) {
    try {
      const result = await wipeStorageBucket(bucket);
      results.push(result);
    } catch (error: any) {
      results.push({
        bucketName: bucket,
        filesDeleted: 0,
        errors: [error.message],
        success: false
      });
    }
  }

  // Log summary
  const totalDeleted = results.reduce((sum, result) => sum + result.filesDeleted, 0);
  const successfulBuckets = results.filter(r => r.success).length;
  
  console.log(`Cleanup complete: ${totalDeleted} files deleted from ${successfulBuckets}/${buckets.length} buckets`);
  
  return results;
}

/**
 * Wipe all storage buckets (including knowledge documents)
 */
export async function wipeAllStorageBuckets(): Promise<StorageCleanupResult[]> {
  const buckets = ['project-images', 'project-knowledge'];
  const results: StorageCleanupResult[] = [];

  console.log('Starting cleanup of ALL storage buckets...');

  for (const bucket of buckets) {
    try {
      const result = await wipeStorageBucket(bucket);
      results.push(result);
    } catch (error: any) {
      results.push({
        bucketName: bucket,
        filesDeleted: 0,
        errors: [error.message],
        success: false
      });
    }
  }

  // Log summary
  const totalDeleted = results.reduce((sum, result) => sum + result.filesDeleted, 0);
  const successfulBuckets = results.filter(r => r.success).length;
  
  console.log(`Complete cleanup: ${totalDeleted} files deleted from ${successfulBuckets}/${buckets.length} buckets`);
  
  return results;
}

/**
 * Get storage bucket statistics (including subfolders)
 */
export async function getStorageStats(): Promise<{ [bucketName: string]: { fileCount: number; totalSize?: number } }> {
  const buckets = ['project-images', 'project-knowledge'];
  const stats: { [bucketName: string]: { fileCount: number; totalSize?: number } } = {};

  for (const bucket of buckets) {
    try {
      const files = await listBucketFiles(bucket);
      stats[bucket] = { fileCount: files.length };
    } catch (error) {
      stats[bucket] = { fileCount: 0 };
      console.error(`Failed to get stats for ${bucket}:`, error);
    }
  }

  return stats;
} 
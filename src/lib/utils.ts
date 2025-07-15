import * as XLSX from 'xlsx';

export interface ExcelUploadResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

/**
 * Extracts the relative file path from a full Supabase storage URL
 * This is useful when you need to call createSignedUrl which expects relative paths
 * 
 * @param fullUrl - The full URL from Supabase storage (e.g., https://xxx.supabase.co/storage/v1/object/public/bucket/path)
 * @returns The relative path (e.g., "bucket/path") or null if extraction fails
 */
export const extractStorageRelativePath = (fullUrl: string): string | null => {
  try {
    // Check if it's already a relative path
    if (!fullUrl.startsWith('http')) {
      return fullUrl;
    }
    
    // Extract path after '/storage/v1/object/public/'
    const publicPathMatch = fullUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
    if (publicPathMatch) {
      return publicPathMatch[1];
    }
    
    // Fallback: extract everything after the bucket name
    const bucketMatch = fullUrl.match(/(?:reports-images|project-images|images)\/(.+)$/);
    if (bucketMatch) {
      return bucketMatch[1]; // Exclude the bucket name from the path
    }
    
    console.warn('Could not extract relative path from URL:', fullUrl);
    return null;
  } catch (error) {
    console.error('Error extracting relative path:', error);
    return null;
  }
};

/**
 * Determines the appropriate Supabase storage bucket name from a URL
 * 
 * @param url - The storage URL
 * @returns The bucket name or 'project-images' as default
 */
export const extractStorageBucketName = (url: string): string => {
  if (url.includes('reports-images')) return 'reports-images';
  if (url.includes('project-images')) return 'project-images';
  if (url.includes('/images/')) return 'images';
  return 'project-images'; // Default fallback
};

export const handleExcelUpload = (file: File): Promise<ExcelUploadResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Build a key-value object from the first two columns
        const projectFields: Record<string, any> = {};
        for (const [i, row] of (jsonData as any[][]).entries()) {
          // Skip empty rows, rows with empty first/second cell, or rows that are just titles
          if (!row[1] || !row[2]) continue;
          projectFields[row[1].trim()] = row[2];
        }
        
        resolve({ success: true, data: projectFields });
      } catch (error) {
        console.error('Error reading Excel file:', error);
        resolve({ 
          success: false, 
          error: 'Error reading Excel file. Please check the file format.' 
        });
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      resolve({ 
        success: false, 
        error: 'Error reading file' 
      });
    };
    
    reader.readAsBinaryString(file);
  });
}; 
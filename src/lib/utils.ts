import * as XLSX from 'xlsx';

export interface ExcelUploadResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

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
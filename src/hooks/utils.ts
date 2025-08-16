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
      const fullPath = publicPathMatch[1];
      // Split to remove bucket name (first part)
      const parts = fullPath.split('/');
      return parts.slice(1).join('/'); // Return path after bucket
    }
    
    // Fallback: extract everything after the bucket name
    const bucketMatch = fullUrl.match(/(?:reports-images|project-images|report_images|images)\/(.+)$/);
    if (bucketMatch) {
      return bucketMatch[1];
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

/**
 * Validates project data against the database schema and filters out invalid fields
 * This ensures only valid database columns are included in project updates/inserts
 * 
 * @param data - The project data to validate
 * @returns Object with sanitized data and information about filtered fields
 */
export const validateProjectData = (data: Record<string, any>) => {
  // Define valid database columns (same as in handleExcelUpload)
  const validColumns = [
    'project_name', 'date', 'Name', 'Title', 'Office', 'Tel', 'Cell', 'Email', 'Fax', 'Project No.',
    'Client Contact Name', 'Client Company Name', 'Client Address 1', 'Client Address 2', 
    'Client Email', 'Client Tel', 'Client Fax', 'Project Title', 'Project Address 1', 
    'Project Address 2', 'Tender Meeting Date & Time', 'Tender Closing Date & Time', 
    'Project Type', 'Project Date', 'Owner / Condo Corp / Building Name', 
    'Owner Address 1 (if applicable)', 'Owner Address 2 (if applicable)', 
    'Owner Contact Name (if applicable)', 'Contractor Name 1', 'Contractor Contact Name 1',
    'Contractor Name 2', 'Contractor Contact Name 2', 'Contractor Name 3', 
    'Contractor Contact Name 3', 'Contractor Name 4', 'Contractor Contact Name 4',
    'Contractor Name 5', 'Contractor Contact Name 5', 'Contractor Name 6', 
    'Contractor Contact Name 6', 'Contractor Name 7', 'Contractor Contact Name 7',
    'Contractor Name 8', 'Contractor Contact Name 8', 'Contractor Name', 
    'Total Stipulated Price (Excluding HST)', 'Specification Date', 'Tender Date',
    'Contractor Contact Name', 'Contractor Company Name', 'Contractor Address 1', 
    'Contractor Address 2', 'Contractor Email', 'Contractor Tel',
    'Drafted By {Initials}', 'Reviewed By {Initials}', 'Revision No.',
    'Client', 'Owner', 'Awarded Contract Amount'
  ];

  const sanitizedData: Record<string, any> = {};
  const invalidFields: string[] = [];
  
  Object.entries(data).forEach(([key, value]) => {
    if (validColumns.includes(key)) {
      sanitizedData[key] = value;
    } else {
      invalidFields.push(key);
    }
  });

  // Check for invalid contractor numbers specifically
  const invalidContractors = invalidFields.filter(field => 
    field.match(/Contractor (?:Name|Contact Name) (\d+)/) && 
    parseInt(field.match(/Contractor (?:Name|Contact Name) (\d+)/)?.[1] || '0') > 8
  );

  return {
    sanitizedData,
    invalidFields,
    invalidContractors,
    hasValidData: Object.keys(sanitizedData).length > 0
  };
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
        
        // Define all valid database column names (exact match with Project type in supabase.ts)
        const validColumns = [
          // Core fields
          'project_name', 'date',
          // Pretium Information
          'Name', 'Title', 'Office', 'Tel', 'Cell', 'Email', 'Fax', 'Project No.',
          // Client Information  
          'Client Contact Name', 'Client Company Name', 'Client Address 1', 'Client Address 2', 
          'Client Email', 'Client Tel', 'Client Fax',
          // Project Information
          'Project Title', 'Project Address 1', 'Project Address 2', 'Tender Meeting Date & Time',
          'Tender Closing Date & Time', 'Project Type', 'Project Date',
          // Owner Information
          'Owner / Condo Corp / Building Name', 'Owner Address 1 (if applicable)', 
          'Owner Address 2 (if applicable)', 'Owner Contact Name (if applicable)',
          // Contractor Invite (numbered 1-8 only)
          'Contractor Name 1', 'Contractor Contact Name 1',
          'Contractor Name 2', 'Contractor Contact Name 2', 
          'Contractor Name 3', 'Contractor Contact Name 3',
          'Contractor Name 4', 'Contractor Contact Name 4',
          'Contractor Name 5', 'Contractor Contact Name 5',
          'Contractor Name 6', 'Contractor Contact Name 6',
          'Contractor Name 7', 'Contractor Contact Name 7',
          'Contractor Name 8', 'Contractor Contact Name 8',
          // Tender Summary
          'Contractor Name', 'Total Stipulated Price (Excluding HST)', 'Specification Date', 'Tender Date',
          // Contractor Award Information
          'Contractor Contact Name', 'Contractor Company Name', 'Contractor Address 1', 
          'Contractor Address 2', 'Contractor Email', 'Contractor Tel',
          // Autocad TitleBlock Information
          'Drafted By {Initials}', 'Reviewed By {Initials}', 'Revision No.',
          // Additional fields
          'Client', 'Owner', 'Awarded Contract Amount'
        ];
        
        // Create a flexible mapping function that handles common variations
        const normalizeKey = (key: string): string => {
          return key.trim().toLowerCase()
            .replace(/[{}]/g, '') // Remove curly braces
            .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical content
            .replace(/[\s\-_\.]/g, '') // Remove spaces, hyphens, underscores, dots
        };
        
        // Create a mapping of normalized keys to exact database columns
        const columnMapping = new Map<string, string>();
        validColumns.forEach(col => {
          columnMapping.set(normalizeKey(col), col);
        });
        
        // Add common alternative names and abbreviations
        const commonMappings = {
          'projectname': 'project_name',
          'clientname': 'Client Contact Name',
          'clientcompany': 'Client Company Name',
          'contractorname': 'Contractor Name',
          'contractorcompany': 'Contractor Company Name',
          'projecttitle': 'Project Title',
          'projectaddress': 'Project Address 1',
          'clientaddress': 'Client Address 1',
          'contractoraddress': 'Contractor Address 1',
          'ownername': 'Owner / Condo Corp / Building Name',
          'owneraddress': 'Owner Address 1 (if applicable)',
          'tenderclosingdate': 'Tender Closing Date & Time',
          'tendermeetingdate': 'Tender Meeting Date & Time',
          'contractamount': 'Total Stipulated Price (Excluding HST)',
          'awardedamount': 'Awarded Contract Amount',
          'draftedby': 'Drafted By {Initials}',
          'reviewedby': 'Reviewed By {Initials}',
          'revisionno': 'Revision No.',
          'revisionnumber': 'Revision No.',
          'specificationdate': 'Specification Date',
          'tenderdate': 'Tender Date',
          'projectdate': 'Project Date',
          'projectno': 'Project No.',
          'projectnumber': 'Project No.'
        };
        
        // Add common mappings to the main mapping
        Object.entries(commonMappings).forEach(([key, value]) => {
          columnMapping.set(key, value);
        });
        
        const projectFields: Record<string, any> = {};
        let foundValidData = false;
        const matchingLog: Array<{type: string, excelKey: string, dbColumn?: string, value?: string}> = [];
        
        console.log('Processing Excel file with', jsonData.length, 'rows');
        console.log('Available database columns:', validColumns.length, 'columns');
        
        // Process each row to find key-value pairs
        // Try different column combinations in case data isn't in columns A&B
        const columnCombinations = [
          [0, 1], // Columns A & B
          [1, 2], // Columns B & C  
          [2, 3], // Columns C & D
        ];
        
        for (const [rowIndex, row] of (jsonData as any[][]).entries()) {
          if (!row || !Array.isArray(row)) continue;
          
          // Try each column combination to find valid data
          for (const [keyCol, valueCol] of columnCombinations) {
            if (row.length <= Math.max(keyCol, valueCol)) continue;
            
            const excelKey = row[keyCol] ? String(row[keyCol]).trim() : '';
            const value = row[valueCol] ? String(row[valueCol]).trim() : '';
            
            // Skip if key or value is empty
            if (!excelKey || !value) continue;
            
            // Check for invalid contractor numbers (9, 10, 11, etc.)
            const contractorNumberMatch = excelKey.match(/Contractor (?:Name|Contact Name) (\d+)/i);
            if (contractorNumberMatch) {
              const contractorNum = parseInt(contractorNumberMatch[1]);
              if (contractorNum > 8) {
                matchingLog.push({
                  type: 'invalid', 
                  excelKey,
                  value: `Invalid contractor number ${contractorNum}. Database only supports contractors 1-8.`
                });
                continue;
              }
            }
            
            // First try exact match
            if (validColumns.includes(excelKey)) {
              projectFields[excelKey] = value;
              foundValidData = true;
              matchingLog.push({
                type: 'exact', 
                excelKey, 
                dbColumn: excelKey, 
                value: value.substring(0, 50) + (value.length > 50 ? '...' : '')
              });
              break; // Found valid data in this row, move to next row
            }
            
            // Then try flexible matching
            const normalizedKey = normalizeKey(excelKey);
            const mappedColumn = columnMapping.get(normalizedKey);
            
            if (mappedColumn) {
              // Double-check that the mapped column actually exists in our valid columns
              if (validColumns.includes(mappedColumn)) {
                projectFields[mappedColumn] = value;
                foundValidData = true;
                matchingLog.push({
                  type: 'flexible', 
                  excelKey, 
                  dbColumn: mappedColumn, 
                  value: value.substring(0, 50) + (value.length > 50 ? '...' : '')
                });
                break; // Found valid data in this row, move to next row
              } else {
                matchingLog.push({
                  type: 'invalid_mapping', 
                  excelKey,
                  value: `Mapping target "${mappedColumn}" not found in database schema`
                });
              }
            } else {
              // Only log as skipped if we tried all column combinations for this row
              if (keyCol === columnCombinations[columnCombinations.length - 1][0]) {
                matchingLog.push({type: 'skipped', excelKey});
              }
            }
          }
        }
        
        // Log results in a organized way
        console.log('\n📊 Excel Processing Results:');
        console.log('Total rows processed:', jsonData.length);
        
        const exactMatches = matchingLog.filter(m => m.type === 'exact');
        const flexibleMatches = matchingLog.filter(m => m.type === 'flexible');
        const skipped = matchingLog.filter(m => m.type === 'skipped');
        const invalid = matchingLog.filter(m => m.type === 'invalid');
        const invalidMappings = matchingLog.filter(m => m.type === 'invalid_mapping');
        
        if (exactMatches.length > 0) {
          console.log('\n✅ Exact matches:', exactMatches.length);
          exactMatches.forEach(m => console.log(`  "${m.excelKey}" → "${m.dbColumn}" = "${m.value}"`));
        }
        
        if (flexibleMatches.length > 0) {
          console.log('\n🔄 Flexible matches:', flexibleMatches.length);
          flexibleMatches.forEach(m => console.log(`  "${m.excelKey}" → "${m.dbColumn}" = "${m.value}"`));
        }
        
        if (invalid.length > 0) {
          console.log('\n❌ Invalid fields:', invalid.length);
          invalid.forEach(m => console.log(`  "${m.excelKey}" - ${m.value}`));
        }
        
        if (invalidMappings.length > 0) {
          console.log('\n⚠️ Invalid mappings:', invalidMappings.length);
          invalidMappings.forEach(m => console.log(`  "${m.excelKey}" - ${m.value}`));
        }
        
        if (skipped.length > 0) {
          console.log('\n⚠️ Skipped (no match):', skipped.length);
          skipped.slice(0, 10).forEach(m => console.log(`  "${m.excelKey}"`));
          if (skipped.length > 10) {
            console.log(`  ... and ${skipped.length - 10} more`);
          }
        }
        
        if (!foundValidData) {
          console.warn('No valid database columns found in Excel file');
          
          // Provide helpful suggestions
          const suggestions: string[] = [];
          if (invalid.length > 0) {
            suggestions.push(`❌ Found ${invalid.length} invalid field(s):`);
            invalid.forEach(m => suggestions.push(`  • "${m.excelKey}" - ${m.value}`));
            suggestions.push('');
          }
          if (invalidMappings.length > 0) {
            suggestions.push(`⚠️ Found ${invalidMappings.length} invalid mapping(s):`);
            invalidMappings.forEach(m => suggestions.push(`  • "${m.excelKey}" - ${m.value}`));
            suggestions.push('');
          }
          if (skipped.length > 0) {
            const firstFewSkipped = skipped.slice(0, 5).map(m => m.excelKey);
            suggestions.push(`Found these unrecognized columns: ${firstFewSkipped.join(', ')}`);
          }
          suggestions.push('Try using column names like: "Project Name", "Client Company Name", "Project Title", "Contractor Name 1", etc.');
          suggestions.push('Note: Contractor fields only go from 1-8 (not 9, 10, 11, etc.)');
          suggestions.push('Excel format should be: Column A = field name, Column B = value');
          
          resolve({ 
            success: false, 
            error: `No valid database columns found in Excel file.\n\n${suggestions.join('\n')}` 
          });
          return;
        }
        
        // Create a summary of what was processed
        let summary = `✅ Successfully extracted ${Object.keys(projectFields).length} valid fields from Excel file`;
        
        if (invalid.length > 0 || invalidMappings.length > 0 || skipped.length > 0) {
          const skippedCount = invalid.length + invalidMappings.length + skipped.length;
          summary += `\n⚠️ Skipped ${skippedCount} invalid/unrecognized field(s)`;
          
          if (invalid.length > 0) {
            summary += `\n  - ${invalid.length} invalid field(s) (e.g., contractor numbers > 8)`;
          }
          if (skipped.length > 0) {
            summary += `\n  - ${skipped.length} unrecognized field(s)`;
          }
        }
        
        console.log(`\n${summary}`);
        resolve({ success: true, data: projectFields });
        
      } catch (error) {
        console.error('Error reading Excel file:', error);
        resolve({ 
          success: false, 
          error: `Error reading Excel file: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the file format.` 
        });
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      resolve({ 
        success: false, 
        error: 'Error reading file. Please try again or use a different file.' 
      });
    };
    
    reader.readAsBinaryString(file);
  });
}; 
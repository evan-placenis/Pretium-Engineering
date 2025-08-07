import { NextRequest, NextResponse } from 'next/server';

interface SuggestionItem {
  value: string;
  label: string;
  type: 'section' | 'image' | 'group' | 'content';
  description?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { reportContent, query = '' } = await req.json();

    if (!reportContent) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions: SuggestionItem[] = [];

    // Parse the report content to extract available references
    const lines = reportContent.split('\n');
    console.log(`Processing ${lines.length} lines of content`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;

      // Extract section numbers (e.g., "1.1", "2.3", etc.)
      const sectionMatch = line.match(/^(\d+\.\d+)/);
      if (sectionMatch) {
        const sectionNumber = sectionMatch[1];
        const sectionText = line.substring(sectionMatch[0].length).trim();
        console.log(`Found section: ${sectionNumber} - ${sectionText.substring(0, 30)}`);
        suggestions.push({
          value: sectionNumber,
          label: `${sectionNumber} ${sectionText.substring(0, 50)}${sectionText.length > 50 ? '...' : ''}`,
          type: 'section',
          description: sectionNumber
        });
      }
      
      // Also check for section numbers that might have spaces before them
      const sectionMatchWithSpace = line.match(/^\s*(\d+\.\d+)/);
      if (sectionMatchWithSpace && !sectionMatch) {
        const sectionNumber = sectionMatchWithSpace[1];
        const sectionText = line.substring(sectionMatchWithSpace[0].length).trim();
        console.log(`Found section (with space): ${sectionNumber} - ${sectionText.substring(0, 30)}`);
        suggestions.push({
          value: sectionNumber,
          label: `${sectionNumber} ${sectionText.substring(0, 50)}${sectionText.length > 50 ? '...' : ''}`,
          type: 'section',
          description: sectionNumber
        });
      }

      // Extract image references [IMAGE:X] or [IMAGE:X:GROUP]
      const imageMatches = line.match(/\[IMAGE:(\d+)(?::([^\]]+))?\]/g);
      if (imageMatches) {
        imageMatches.forEach(match => {
          const imageMatch = match.match(/\[IMAGE:(\d+)(?::([^\]]+))?\]/);
          if (imageMatch) {
            const imageNumber = imageMatch[1];
            const groupName = imageMatch[2];
            
            suggestions.push({
              value: `image ${imageNumber}`,
              label: `Image ${imageNumber}${groupName ? ` (${groupName})` : ''}`,
              type: 'image',
              description: `image`
            });

            if (groupName) {
              suggestions.push({
                value: `group ${groupName}`,
                label: `${groupName} Group`,
                type: 'group',
                description: `group`
              });
            }
          }
        });
      }

      // Extract section headers (lines that look like headers)
      const headerMatch = line.match(/^([A-Z][A-Z\s]+):/);
      if (headerMatch) {
        const headerName = headerMatch[1].trim();
        suggestions.push({
          value: headerName.toLowerCase(),
          label: `${headerName}:`,
          type: 'content',
          description: `section header`
        });
      }

      // Extract group headers (lines with ===)
      const groupHeaderMatch = line.match(/=== ([^=]+) ===/);
      if (groupHeaderMatch) {
        const groupName = groupHeaderMatch[1].trim();
        suggestions.push({
          value: `group ${groupName}`,
          label: `${groupName} Group`,
          type: 'group',
          description: `group`
        });
      }
    }

    // Add common reference patterns
    suggestions.push(
      {
        value: 'first paragraph',
        label: 'First Paragraph',
        type: 'content',
        description: 'first paragraph'
      },
      {
        value: 'last bullet',
        label: 'Last Bullet Point',
        type: 'content',
        description: 'last bullet'
      },
      {
        value: 'first section',
        label: 'First Section',
        type: 'section',
        description: 'first section'
      },
      {
        value: 'last section',
        label: 'Last Section',
        type: 'section',
        description: 'last section'
      }
    );

    // Filter suggestions based on query if provided
    let filteredSuggestions = suggestions;
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase().trim();
      console.log('Filtering suggestions with query:', lowerQuery);
      filteredSuggestions = suggestions.filter(suggestion => {
        const matches = 
          suggestion.value.toLowerCase().includes(lowerQuery) ||
          suggestion.label.toLowerCase().includes(lowerQuery) ||
          (suggestion.description && suggestion.description.toLowerCase().includes(lowerQuery));
        console.log(`Suggestion ${suggestion.value}: ${matches ? 'MATCHES' : 'no match'}`);
        return matches;
      });
      console.log(`Filtered from ${suggestions.length} to ${filteredSuggestions.length} suggestions`);
    }

    // Remove duplicates based on value
    const uniqueSuggestions = filteredSuggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.value === suggestion.value)
    );

    // Sort suggestions by type and then by label
    const typeOrder = { section: 1, image: 2, group: 3, content: 4 };
    uniqueSuggestions.sort((a, b) => {
      const typeDiff = (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0);
      if (typeDiff !== 0) return typeDiff;
      return a.label.localeCompare(b.label);
    });

    const finalSuggestions = uniqueSuggestions.slice(0, 20); // Limit to 20 suggestions
    console.log(`Returning ${finalSuggestions.length} suggestions:`, finalSuggestions.map(s => s.value));
    
    return NextResponse.json({
      suggestions: finalSuggestions
    });

  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

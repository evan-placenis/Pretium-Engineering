import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

/**
 * Convert plain text to a properly formatted Word document
 * Handles headings, paragraphs, and basic formatting
 */
export const generateWordDocument = async (
  content: string,
  title: string,
  filename: string
): Promise<void> => {
  // Parse content to identify headers, paragraphs, etc.
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim() !== '');
  
  const docElements = paragraphs.map(paragraph => {
    // Check if this paragraph is a heading
    if (paragraph.trim().startsWith('#')) {
      // H1 heading
      const headingText = paragraph.trim().replace(/^#+\s*/g, '');
      return new Paragraph({
        text: headingText,
        heading: HeadingLevel.HEADING_1,
        spacing: {
          after: 200
        }
      });
    } else if (paragraph.trim().match(/^##\s+/)) {
      // H2 heading
      const headingText = paragraph.trim().replace(/^#+\s*/g, '');
      return new Paragraph({
        text: headingText,
        heading: HeadingLevel.HEADING_2,
        spacing: {
          after: 200
        }
      });
    } else if (paragraph.trim().match(/^###\s+/)) {
      // H3 heading
      const headingText = paragraph.trim().replace(/^#+\s*/g, '');
      return new Paragraph({
        text: headingText,
        heading: HeadingLevel.HEADING_3,
        spacing: {
          after: 200
        }
      });
    } else {
      // Regular paragraph
      return new Paragraph({
        text: paragraph,
        spacing: {
          after: 200
        }
      });
    }
  });

  // Create Document with properties
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Add title
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400
            }
          }),
          ...docElements
        ]
      }
    ]
  });

  // Generate the document as a blob
  const blob = await Packer.toBlob(doc);
  
  // Save the blob as a file
  saveAs(blob, filename);
};

/**
 * Simple conversion that just preserves the text formatting
 * but doesn't try to parse headings or special formatting
 */
export const textToSimpleWordDocument = async (
  content: string,
  filename: string
): Promise<void> => {
  // Calculate page breaks based on standard 11-inch pages
  const linesPerPage = 45; // Approximate lines per page
  const lines = content.split(/\n/);
  const paragraphs = [];
  
  let lineCount = 0;
  let pageCount = 1;
  
  // Process each line and add page breaks as needed
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Add the line
    paragraphs.push(new Paragraph({
      children: [new TextRun(line || " ")],
      spacing: {
        after: 120,
        // Add more top margin for first paragraph after a page break
        before: lineCount === 0 && pageCount > 1 ? 720 : 0 // 720 twips = approx 1 inch
      }
    }));
    
    lineCount++;
    
    // Check if we need a page break (this is approximate)
    if (lineCount >= linesPerPage && i < lines.length - 1) {
      paragraphs.push(new Paragraph({
        text: "",
        pageBreakBefore: true
      }));
      
      lineCount = 0;
      pageCount++;
    }
  }

  // Create Document with appropriate section properties to ensure 1-inch margins
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch in twips (1440 twips = 1 inch)
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        children: paragraphs
      }
    ]
  });

  // Generate and save
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}; 
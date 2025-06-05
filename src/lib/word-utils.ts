import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, Header } from 'docx';
import { Project, ReportImage } from '@/lib/supabase';

/**
 * Generate the report header with logo, company info, observation report, and project details
 */
export const generate_report_header = async (project: Project | null, pretiumLogoBuffer: ArrayBuffer | null) => {
  const headerChildren = [];

  if (pretiumLogoBuffer) {
    const logoUint8Array = new Uint8Array(pretiumLogoBuffer);
    
    const headerTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: 'single', size: 12, color: '0E2841' },
        bottom: { style: 'single', size: 12, color: '0E2841' },
        left: { style: 'single', size: 12, color: '0E2841' },
        right: { style: 'single', size: 12, color: '0E2841' },
        insideHorizontal: { style: 'none', size: 0 },
        insideVertical: { style: 'none', size: 0 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              margins: {
                top: 50,
                bottom: 50,
                left: 100,
                right: 100,
              },
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: logoUint8Array,
                      transformation: { width: 200, height: 60 },
                      type: "png",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              margins: {
                top: 0,
                bottom: 0,
                left: 0,
                right: 100,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Pretium Engineering Inc.",
                      color: "0E2841",
                      size: 18,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: project?.["Client Address 1"] || "Client Address 1",
                      color: "0E2841",
                      size: 18,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: project?.["Client Address 2"] || "Client Address 2",
                      color: "0E2841",
                      size: 18,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Tel: ${project?.["Client Tel"] || "Client Tel"}`,
                      color: "0E2841",
                      size: 18,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: project?.website || "www.pretiumengineer.com",
                      color: "0E2841",
                      size: 18,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Create separate Observation Report table
    const observationTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: 'single', size: 12, color: '0E2841' },
        bottom: { style: 'single', size: 12, color: '0E2841' },
        left: { style: 'single', size: 12, color: '0E2841' },
        right: { style: 'single', size: 12, color: '0E2841' },
        insideHorizontal: { style: 'none', size: 0 },
        insideVertical: { style: 'none', size: 0 },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: {
                top: 300,
                bottom: 300,
                left: 150,
                right: 150,
              },
              verticalAlign: "center",
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Observation",
                      bold: true,
                      color: "0E2841",
                      size: 26,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Report ${project?.["Report No."] || "1"}`,
                      bold: true,
                      color: "0E2841",
                      size: 26,
                      font: "Segoe UI",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        }),
      ],
    });
    
    // Create a container table to hold both tables side by side
    const containerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: 'none', size: 0 },
        bottom: { style: 'none', size: 0 },
        left: { style: 'none', size: 0 },
        right: { style: 'none', size: 0 },
        insideHorizontal: { style: 'none', size: 0 },
        insideVertical: { style: 'none', size: 0 },
      },
      rows: [
        new TableRow({
          height: {
            value: 1600, // Set a fixed height for the row
            rule: "exact",
          },
          children: [
            new TableCell({
              width: { size: 80, type: WidthType.PERCENTAGE },
              verticalAlign: "top",
              children: [headerTable],
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              margins: { left: 200 },
              verticalAlign: "top",
              children: [observationTable],
            }),
          ],
        }),
      ],
    });
    
    headerChildren.push(containerTable);

    // Add project details section to header (first two rows)
    const projectHeaderTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: 'none', size: 0 },
        bottom: { style: 'single', size: 4, color: '000000' },
        left: { style: 'none', size: 0 },
        right: { style: 'none', size: 0 },
        insideHorizontal: { style: 'single', size: 4, color: '000000' },
        insideVertical: { style: 'none', size: 0 },
      },
      rows: [
        // First row: Project No, Date of Visit, Time of Visit, Page
        new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 0, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Project No: ${project?.["Project No."] || ''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Date of Visit: ${''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Time of Visit: ${''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 0 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Page _ of _",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
        // Second row: Weather, Temperature, Build Permit, Crew Size
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Weather: ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Temperature: ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Build. Permit: ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
            new TableCell({
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Crew Size: ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
      ],
    });
    
    headerChildren.push(new Paragraph({ text: "" })); // Space
    headerChildren.push(projectHeaderTable);
  }

  return headerChildren;
}; 

/**
 * Create Word document with proper image handling and professional header
 */
export const createWordDocumentWithImages = async (
  content: string, 
  images: ReportImage[], 
  filename: string, 
  project: Project | null
) => {
  try {
    // Load Pretium logo
    let pretiumLogoBuffer: ArrayBuffer | null = null;
    try {
      const logoResponse = await fetch('/pretium.png');
      pretiumLogoBuffer = await logoResponse.arrayBuffer();
    } catch (error) {
      console.error('Could not load Pretium logo:', error);
    }
    
    // Generate header using the utility function
    const headerChildren = await generate_report_header(project, pretiumLogoBuffer);
    const bodyChildren = [];

    // Add remaining project details form to body (only Project Name onwards)
    const projectDetailsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: 'none', size: 0 },
        bottom: { style: 'single', size: 4, color: '000000' },
        left: { style: 'none', size: 0 },
        right: { style: 'none', size: 0 },
        insideHorizontal: { style: 'single', size: 4, color: '000000' },
        insideVertical: { style: 'none', size: 0 },
      },
      rows: [
        // Project Name (spans full width)
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Project Name: ${project?.project_name  || ''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
        // Client/Owner (spans full width)
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Client / Owner: ${project?.["Client Company Name"] || ''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
        // Contractor (spans full width)
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: `Contractor: ${project?.[ "Contractor Name 1"] || ''}`,
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
        // Project Materials (spans full width)
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [new Paragraph({ 
                children: [
                  new TextRun({
                    text: "Project Materials observed onsite:",
                    size: 18,
                    font: "Segoe UI",
                  }),
                ],
                alignment: AlignmentType.LEFT,
              })],
            }),
          ],
        }),
      ],
    });
    
    bodyChildren.push(projectDetailsTable);
    bodyChildren.push(new Paragraph({ text: "" })); // Empty space

    // Split content by lines and process each line
    const lines = content.split('\n');
    let currentParagraphText = '';
    
    for (const line of lines) {
      // Check if line contains an image placeholder
      const imageMatch = line.match(/\[IMAGE:(\d+)\]/);
      
      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1]) - 1;
        const textBeforeImage = line.replace(/\[IMAGE:\d+\]/, '').trim();
        
        // Add any accumulated text as a paragraph
        if (currentParagraphText.trim()) {
          bodyChildren.push(new Paragraph({ 
            children: [
              new TextRun({
                text: currentParagraphText,
                font: "Segoe UI",
                size: 20, // 12pt for body text
              }),
            ],
          }));
          currentParagraphText = '';
        }
        
        // Create two-column table for text and image (without borders)
        if (images[imageIndex]) {
          try {
            // Fetch image data
            const imageResponse = await fetch(images[imageIndex].url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const imageUint8Array = new Uint8Array(imageBuffer);
            
            // Create table with two columns (no borders)
            const table = new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: 'none', size: 0 },
                bottom: { style: 'none', size: 0 },
                left: { style: 'none', size: 0 },
                right: { style: 'none', size: 0 },
                insideHorizontal: { style: 'none', size: 0 },
                insideVertical: { style: 'none', size: 0 },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: {
                        size: 50,
                        type: WidthType.PERCENTAGE,
                      },
                      margins: { top: 200, bottom: 200, left: 0, right: 100 },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: textBeforeImage || "See image for details:",
                              font: "Segoe UI",
                              size: 20,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: {
                        size: 50,
                        type: WidthType.PERCENTAGE,
                      },
                      margins: { top: 200, bottom: 200, left: 100, right: 0 },
                      children: [
                        new Paragraph({
                          children: [
                            new ImageRun({
                              data: imageUint8Array,
                              transformation: {
                                width: 300, // Much larger - nearly full column width
                                height: 250, // Proportionally larger
                              },
                              type: "jpg",
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: `Photo ${imageIndex + 1}: ${images[imageIndex].description || 'No description available'}`,
                              font: "Segoe UI",
                              size: 18, // Slightly smaller for captions
                            }),
                          ],
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            });
            
            bodyChildren.push(table);
            
          } catch (error) {
            console.error('Error processing image:', error);
            // Fallback to text if image fails
            bodyChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${textBeforeImage} [Image ${imageIndex + 1}: ${images[imageIndex]?.description || 'Image not available'}]`,
                    font: "Segoe UI",
                    size: 20,
                  }),
                ],
              })
            );
          }
        } else {
          // Image not found, just add the text
          bodyChildren.push(new Paragraph({ 
            children: [
              new TextRun({
                text: textBeforeImage,
                font: "Segoe UI",
                size: 20,
              }),
            ],
          }));
        }
      } else {
        // Regular text line
        if (line.trim()) {
          currentParagraphText += (currentParagraphText ? '\n' : '') + line;
        } else if (currentParagraphText.trim()) {
          // Empty line, add accumulated text as paragraph
          bodyChildren.push(new Paragraph({ 
            children: [
              new TextRun({
                text: currentParagraphText,
                font: "Segoe UI",
                size: 20, // 12pt for body text
              }),
            ],
          }));
          currentParagraphText = '';
          bodyChildren.push(new Paragraph({ text: "" })); // Empty paragraph for spacing
        }
      }
    }
    
    // Add any remaining text
    if (currentParagraphText.trim()) {
      bodyChildren.push(new Paragraph({ 
        children: [
          new TextRun({
            text: currentParagraphText,
            font: "Segoe UI",
            size: 20, // 12pt for body text
          }),
        ],
      }));
    }

    // Create document with proper header
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 2347,     // 1.63 inches
              bottom: 446,   // 0.31 inches
              left: 1080,    // 0.75 inches
              right: 1080,   // 0.75 inches
            },
          },
        },
        headers: {
          default: new Header({
            children: headerChildren,
          }),
        },
        children: bodyChildren,
      }],
    });

    // Generate and download
    const buffer = await Packer.toBuffer(doc);
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('Error creating Word document:', error);
    throw error;
  }
}; 
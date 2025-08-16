import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, Header, Numbering, LevelFormat, PageNumber } from 'docx';
import { Project } from '@/lib/supabase';
import { ReportImage } from '@/types/reportImage';
import { Section } from '@/lib/jsonTreeModels/types/section';

interface SectionSelection {
  locationPlan: boolean;
  generalProjectStatus: boolean;
  observations: boolean;
  stagingArea: boolean;
}
  

/**
 * Compresses an image buffer using canvas to reduce file size
 * @param imageBuffer - The original image buffer
 * @param maxWidth - Maximum width for the compressed image
 * @param maxHeight - Maximum height for the compressed image
 * @param quality - JPEG quality (0.1 to 1.0)
 * @param format - Output format ('jpeg' or 'png')
 * @param targetDPI - Target DPI for the image (default 150 for Word docs)
 * @returns Compressed image buffer
 */
export const compressImage = async (
  imageBuffer: ArrayBuffer,
  maxWidth: number = 800,
  maxHeight: number = 600,
  quality: number = 0.7,
  format: 'jpeg' | 'png' = 'jpeg',
  targetDPI: number = 150
): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    try {
      // Create blob from buffer
      const blob = new Blob([imageBuffer]);
      const url = URL.createObjectURL(blob);
      
      // Create image element
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        // Calculate new dimensions while maintaining aspect ratio
        const { width, height } = calculateAspectRatioFit(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );
        
        // Calculate DPI-adjusted dimensions
        // Standard screen DPI is 96, so we scale based on target DPI
        const dpiScale = targetDPI / 96;
        const dpiAdjustedWidth = Math.round(width * dpiScale);
        const dpiAdjustedHeight = Math.round(height * dpiScale);
        
        // Create canvas for compression
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Set canvas dimensions with DPI adjustment
        canvas.width = dpiAdjustedWidth;
        canvas.height = dpiAdjustedHeight;
        
        // Draw image on canvas with new dimensions
        ctx.drawImage(img, 0, 0, dpiAdjustedWidth, dpiAdjustedHeight);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Convert blob to array buffer
              const reader = new FileReader();
              reader.onload = () => {
                if (reader.result instanceof ArrayBuffer) {
                  resolve(reader.result);
                } else {
                  reject(new Error('Failed to convert blob to array buffer'));
                }
              };
              reader.readAsArrayBuffer(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          `image/${format}`,
          quality
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Calculates new dimensions while maintaining aspect ratio
 */
const calculateAspectRatioFit = (
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: srcWidth * ratio,
    height: srcHeight * ratio
  };
};

/**
 * Compresses multiple images in parallel
 */
export const compressImages = async (
  images: ArrayBuffer[],
  maxWidth: number = 800,
  maxHeight: number = 600,
  quality: number = 0.7,
  targetDPI: number = 150
): Promise<ArrayBuffer[]> => {
  const compressionPromises = images.map(imageBuffer =>
    compressImage(imageBuffer, maxWidth, maxHeight, quality, 'jpeg', targetDPI)
  );
  
  return Promise.all(compressionPromises);
};


/**
 * Generate the report header with logo, company info, observation report, and project details
 */
export const generate_report_header = async (project: Project | null, pretiumLogoBuffer: ArrayBuffer | null) => {
  const headerChildren: (Paragraph | Table)[] = [];

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
                      type: "jpg",
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
                    text: "Page ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 18,
                    font: "Segoe UI",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
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

export const createProjectDetailsTable = async (project: Project | null) => {
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
              alignment: AlignmentType.JUSTIFIED,
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
              alignment: AlignmentType.JUSTIFIED,
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
                  text: `Contractor: ${project?.[ "Contractor Company Name"] ||  "Contractor Contact Name"}`,
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
  return projectDetailsTable;
};

//------------------------------------------Hard coded sections--------------------------------------------
/**
 * Creates a properly formatted paragraph based on whether it's a numbered section
 */
const sectionHeaders = [
  "LOCATION PLAN",
  "GENERAL PROJECT STATUS",
  "OBSERVATIONS",
  "OBSERVATION/COMMENTS",
  "DEFICIENCY SUMMARY",
];

const createLocationPlanSection = async (): Promise<Paragraph[]> => {
  try {
    const locationImageResponse = await fetch('/placeholder.png');
    const locationImageBuffer = await locationImageResponse.arrayBuffer();
    
    // Compress the location plan image
    const compressedBuffer = await compressImage(
      locationImageBuffer,
      500,  // maxWidth
      400,  // maxHeight
      0.6,  // quality
      'jpeg',
      150   // DPI - optimal for Word documents
    );
    
    const locationImageUint8Array = new Uint8Array(compressedBuffer);
    
    return [
      // Section heading
      new Paragraph({
        children: [
          new TextRun({
            text: "LOCATION PLAN",
            bold: true,
            font: "Segoe UI",
            size: 20,
            allCaps: true,
          }),
        ],
        spacing: {
          before: 300,
          after: 200,
        },
        alignment: AlignmentType.LEFT,
      }),

      // Image centered under heading
      new Paragraph({
        children: [
          new ImageRun({
            data: locationImageUint8Array,
            transformation: {
              width: 500,
              height: 400,
            },
            type: "png",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),

      // Page break to start on a new page
      new Paragraph({
        children: [new PageBreak()],
      }),
    ];
  } catch (error) {
    console.error('Error creating location plan section:', error);
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Error loading location plan section",
            color: "FF0000",
          }),
        ],
      }),
    ];
  }
};



const createGeneralProjectStatusSection = async (): Promise<Paragraph[]> => {
  const bullets = [
    "Project Completion Date: Currently on Schedule (MODIFY SUBHEADINGS AS NECESSARY)",
    "Original Estimated Project Completion Date: August 16, 2024 (weather permitting)",
    "Project Completion Date: Currently on Schedule",
  ];
  try {
    // Section heading
    const sectionHeader = new Paragraph({
      children: [
        new TextRun({
          text: "GENERAL PROJECT STATUS",
          bold: true,
          font: "Segoe UI",
          size: 20,
          allCaps: true,
        }),
      ],
      numbering: {
        reference: 'ai-numbering',
        level: 0,
      },
      indent: {
        hanging: 720,
      },
      style: "Strong",
      alignment: AlignmentType.JUSTIFIED,
      spacing: {
        before: 200,
        after: 100,
      },
    });

    const bulletParagraphs = bullets.map((point, index) =>
      new Paragraph({
        children: [
          new TextRun({
            text: point,
            font: "Segoe UI",
            size: 20,
          }),
        ],
        numbering: {
          reference: 'ai-numbering',
          level: 1,
        },
        alignment: AlignmentType.JUSTIFIED,
        indent: {
          hanging: 720, // Match the indent of other numbered paragraphs
        },
        spacing: {
          before: 0,
          after: 100,
        },
      })
    );

    return [sectionHeader, ...bulletParagraphs];

  } catch (error) {
    console.error('Error creating general project status section:', error);
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Error loading general project status section",
            color: "FF0000",
          }),
        ],
      }),
    ];
  }
};


const createObservationSection = async (): Promise<Paragraph[]> => {

  try {
    // Section heading
    return[ new Paragraph({
      children: [
        new TextRun({
          text: "OBSERVATIONS",
          bold: true,
          font: "Segoe UI",
          size: 20,
          allCaps: true,
        }),
      ],
      indent: {
        left: 1,
      },
      style: "Strong",
      alignment: AlignmentType.JUSTIFIED,
      spacing: {
        before: 200,
        after: 100,
      },
    })];


  } catch (error) {
    console.error('Error creating observation section:', error);
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Error loading observation section",
            color: "FF0000",
          }),
        ],
      }),
    ];
  }
};

export const createPlaceholderImageRow = async (
  placeholderUrl: string,
  boilerplateText: string
): Promise<TableRow> => {
  try {
    const response = await fetch(placeholderUrl);
    const buffer = await response.arrayBuffer();
    
          // Compress the placeholder image
      const compressedBuffer = await compressImage(
        buffer,
        400,  // maxWidth - smaller for placeholder
        300,  // maxHeight - smaller for placeholder
        0.5,  // quality - lower quality for placeholder
        'jpeg',
        150   // DPI - optimal for Word documents
      );
    
    const imageUint8Array = new Uint8Array(compressedBuffer);

    // Left Cell: boilerplate text
    const textCell = new TableCell({
      width: {
        size: 60,
        type: WidthType.PERCENTAGE,
      },
      margins: { top: 0, bottom: 100, left: 0, right: 100 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: boilerplateText,
              font: "Segoe UI",
              size: 20,
            }),
          ],
          numbering: {
            reference: 'ai-numbering',
            level: 1,
          },
          alignment: AlignmentType.JUSTIFIED,
          indent: {
            hanging: 720,
          },
        }),
      ],
    });

    // Right Cell: placeholder image + caption
    const imageCell = new TableCell({
      width: {
        size: 40,
        type: WidthType.PERCENTAGE,
      },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [
        new Paragraph({
          children: [
            new ImageRun({
              data: imageUint8Array,
              transformation: {
                width: 300,
                height: 250,
              },
              type: "jpg",
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Photo X\nPlaceholder image — actual photo not available`,
              font: "Segoe UI",
              size: 18,
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
      ],
    });

    return new TableRow({
      children: [textCell, imageCell],
    });
  } catch (error) {
    console.error("Error loading placeholder image:", error);
    throw error;
  }
};

const createStagingAreaSection = async ():  Promise<(Paragraph | Table)[]> => {
  const bullets = [
    "Items without photos are a row on the table and can be inserted in the table where required to ensure proper ordering of items",
  ];
  try {
    // Section heading
    const sectionHeader = new Paragraph({
      children: [
        new TextRun({
          text: "Site / Staging Area - Construction Set Up",
          bold: true,
          font: "Segoe UI",
          size: 20,
          allCaps: true,
        }),
      ],
      numbering: {
        reference: 'ai-numbering',
        level: 0,
      },
      indent: {
        hanging: 720,
      },
      style: "Strong",
      alignment: AlignmentType.JUSTIFIED,
      spacing: {
        before: 100,
        after: 0,
      },
    });

    const bulletParagraphs = bullets.map((point, index) =>
      new Paragraph({
        children: [
          new TextRun({
            text: point,
            font: "Segoe UI",
            size: 20,
          }),
        ],
        numbering: {
          reference: 'ai-numbering',
          level: 1,
        },
        alignment: AlignmentType.JUSTIFIED,
        indent: {
          hanging: 720, // Match the indent of other numbered paragraphs
        },
        spacing: {
          before: 0,
          after: 100,
        },
      })
    );

    const placeholderRow = await createPlaceholderImageRow(
      "/placeholder.png",
      "At the time of inspection, this area was not accessible. A representative placeholder image is shown here."
    );

    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: "none", size: 0 },
        bottom: { style: "none", size: 0 },
        left: { style: "none", size: 0 },
        right: { style: "none", size: 0 },
        insideHorizontal: { style: "none", size: 0 },
        insideVertical: { style: "none", size: 0 },
      },
      rows: [placeholderRow],
    });

    return [sectionHeader, ...bulletParagraphs, table];

  } catch (error) {
    console.error('Error creating general project status section:', error);
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Error loading general project status section",
            color: "FF0000",
          }),
        ],
      }),
    ];
  }
};

//-------------------------------- WORD UTILS FORMATTING --------------------------------

const createSectionParagraphs = (section: Section, level: number): Paragraph[] => {
  const paragraphs: Paragraph[] = [];
  
  // Add title as a numbered heading
  if (section.title) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            font: "Segoe UI",
            size: 20 - (level * 2), // Decrease font size for deeper levels
          }),
        ],
        numbering: {
          reference: 'ai-numbering',
          level: level,
        },
        style: "Strong",
        alignment: AlignmentType.JUSTIFIED,
        indent: {
          hanging: 720,
        },
        spacing: {
          before: 100,
          after: 0,
        },
      })
    );
  }

  // Add body content
  if (section.bodyMd) {
    const bodyContent = Array.isArray(section.bodyMd) ? section.bodyMd : [section.bodyMd];
    bodyContent.forEach(line => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: "Segoe UI",
              size: 20,
            }),
          ],
          alignment: AlignmentType.JUSTIFIED,
        })
      );
    });
  }

  return paragraphs;
}

const renderSectionsRecursively = async (sections: Section[], level: number, images: ReportImage[]): Promise<(Paragraph | Table)[]> => {
  const elements: (Paragraph | Table)[] = [];
  for (const section of sections) {
    elements.push(...createSectionParagraphs(section, level));
    
    // You might want to handle images associated with this section here
    // For now, let's just recurse
    if (section.children && section.children.length > 0) {
      elements.push(...await renderSectionsRecursively(section.children, level + 1, images));
    }
  }
  return elements;
};


export const createWordDocumentWithImages = async (
  sections: Section[], 
  images: ReportImage[], 
  filename: string, 
  project: Project | null,
  sectionSelection?: SectionSelection
) => {
  try {
    // Load and compress Pretium logo
    let pretiumLogoBuffer: ArrayBuffer | null = null;
    try {
      const logoResponse = await fetch('/pretium.png');
      const logoBuffer = await logoResponse.arrayBuffer();
      
      // Compress the logo for smaller file size
      pretiumLogoBuffer = await compressImage(
        logoBuffer,
        200,  // maxWidth - logo doesn't need to be large
        60,   // maxHeight - maintain aspect ratio
        0.8,  // quality - keep good quality for logo
        'jpeg',
        150   // DPI - optimal for Word documents
      );
    } catch (error) {
      console.error('Could not load Pretium logo:', error);
    }
    
    // Generate header using the utility function
    const headerChildren: (Paragraph | Table)[] = await generate_report_header(project, pretiumLogoBuffer);
    const bodyChildren: (Paragraph | Table)[] = [];


    const projectDetailsTable = await createProjectDetailsTable(project);
    // Add project details table
    bodyChildren.push(projectDetailsTable);
    bodyChildren.push(new Paragraph({ text: "" })); // Empty space
    
    
    
    

    // Define numbering config for numbered paragraphs and photos
    const numbering = {
      config: [
        {
          reference: 'ai-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: '%1.%2.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: '%1.%2.%3.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'photo-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: 'Photo %1',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 0, hanging: 0 } } },
            },
          ],
        },
      ],
    };

    // Create sections based on selection
    if (sectionSelection) {
      if (sectionSelection.locationPlan) {
        const locationPlanSection = await createLocationPlanSection();;
        bodyChildren.push(...locationPlanSection);
      }
      
      if (sectionSelection.generalProjectStatus) {
        const generalProjectStatusSection = await createGeneralProjectStatusSection();
        bodyChildren.push(...generalProjectStatusSection);
      }
      
      if (sectionSelection.observations) {
        const observationsSection = await createObservationSection();
        bodyChildren.push(...observationsSection);
      }

      if (sectionSelection.stagingArea) {
        const stagingAreaSection = await createStagingAreaSection();
        bodyChildren.push(...stagingAreaSection);
      }
    }

    // --- NEW LOGIC ---
    const bodyElements = await renderSectionsRecursively(sections, 0, images);
    bodyChildren.push(...bodyElements);
    // --- END NEW LOGIC ---

    // Create document with proper header
    const doc = new Document({
      numbering,
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
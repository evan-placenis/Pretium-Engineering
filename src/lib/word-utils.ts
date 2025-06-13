import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, Header, Numbering, LevelFormat } from 'docx';
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
//--------------------------------------------------------------------------------------
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
    const locationImageUint8Array = new Uint8Array(locationImageBuffer);
    
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
    "Original Estimated ProjectCompletion Date: August 16, 2024 (weather permitting)",
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
    const imageUint8Array = new Uint8Array(buffer);

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
              type: "png",
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
    "Items without photo are a row in the table and can be inserted in the table where required to ensure proper ordering of items",
  ];
  try {
    // Section heading
    const sectionHeader = new Paragraph({
      children: [
        new TextRun({
          text: "Site / Staging Area -  Construction Set Up",
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

const createSection = async (upperText: string): Promise<(Paragraph | Table)[]> => {
  if (upperText === "LOCATION PLAN") {
    return await createLocationPlanSection();
  } else if (upperText === "GENERAL PROJECT STATUS") {
    return await createGeneralProjectStatusSection();
  } else if (upperText === "OBSERVATIONS") {
    return await createObservationSection();
  } else if (upperText === "STAGING AREA") {
    return await createStagingAreaSection();
  }
  return []; // Return empty array for unknown sections
};

const createNumberedParagraph = (text: string, level: number) => {
  if (level === 0) {
    // Main section - use heading
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          bold: true,
          font: "Segoe UI",
          size: 20,
        }),
      ],
      numbering: {
        reference: 'ai-numbering',
        level: 0,
      },
      
      style: "Strong",
      alignment: AlignmentType.JUSTIFIED,
      indent: {
        hanging: 720, // Number will "hang" into the indent space
      },
      spacing: {
        before: 100,
        after: 0,
      },
    });
  } else {
    // Sub-points - use numbered list
    return new Paragraph({
      children: [
        new TextRun({
          text: text,
          font: "Segoe UI",
          size: 20,
        }),
      ],
      numbering: {
        reference: 'ai-numbering',
        level: level,
      },
      alignment: AlignmentType.JUSTIFIED,
      indent: {
        hanging: 720, // Number will "hang" into the indent space
      },
      spacing: {
        before: 0,
        after: 100,
      },
    });
  }
};

/**
 * Creates a regular paragraph with standard formatting
 */
const createRegularParagraph = (text: string) => {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        font: "Segoe UI",
        size: 20,
      }),
    ],
    alignment: AlignmentType.JUSTIFIED,
  });
};

/**
 * Creates a paragraph with proper formatting based on whether it's a numbered section
 */
const createFormattedParagraph = async (text: string): Promise<(Paragraph | Table)[]> => {
  const upperText = text.trim().toUpperCase();
  const paragraphs: (Paragraph | Table)[] = [];

  // If it's a section header, add the section formatting 
  if (sectionHeaders.includes(upperText)) {
    // const sectionParagraphs = await createSection(upperText);
    // paragraphs.push(...sectionParagraphs);

    // HARD CODED RIGHT NOW TESTING
    const sectionParagraphs = await createSection("LOCATION PLAN");
    paragraphs.push(...sectionParagraphs);

    const sectionParagraphss = await createSection("GENERAL PROJECT STATUS");
    paragraphs.push(...sectionParagraphss);

    const sectionParagraphsss = await createSection("OBSERVATIONS");
    paragraphs.push(...sectionParagraphsss);

    const sectionParagraphssss = await createSection("STAGING AREA");
    paragraphs.push(...sectionParagraphssss);
  }

  // Process the actual content regardless of whether it's a section header
  const numberedMatch = text.match(/^(\d+(?:\.\d+)*)(?:[\.|\)]?)\s+(.*)$/);
  if (numberedMatch) {
    const numberParts = numberedMatch[1].split('.');
    const level = numberParts.length - 1;
    const content = numberedMatch[2];
    paragraphs.push(createNumberedParagraph(content, level));
  } else {
    paragraphs.push(createRegularParagraph(text));
  }
  
  return paragraphs;
};

/**
 * Creates a table cell with an image and caption
 */
const createImageCell = async (image: ReportImage, imageIndex: number) => {
  try {
    const imageResponse = await fetch(image.url);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageUint8Array = new Uint8Array(imageBuffer);

    return new TableCell({
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
              text: `Photo ${imageIndex + 1} \n ${image.description || 'No description available'}`,//
              font: "Segoe UI",
              size: 18,
            }),
          ],
          alignment: AlignmentType.LEFT,
        }),
      ],
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `[Image ${imageIndex + 1}: ${image.description || 'Image not available'}]`,
              font: "Segoe UI",
              size: 20,
            }),
          ],
        }),
      ],
    });
  }
};

/**
 * Creates a table cell with text content
 */
const createTextCell = async (text: string): Promise<TableCell> => {
  const paragraphsOrTables = await createFormattedParagraph(text);
  return new TableCell({
    width: {
      size: 50,
      type: WidthType.PERCENTAGE,
    },
    margins: { top: 0, bottom: 100, left: 0, right: 100 },
    children: paragraphsOrTables,
  });
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

    // Define numbering config for numbered paragraphs
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
      ],
    };

    // Split content by lines and process each line
    const lines = content.split('\n');
    let currentParagraphText = '';
    const numberedLineRegex = /^(\d+(?:\.\d+)*)(?:[\.|\)]?)\s+(.*)$/;
    
    for (const line of lines) {
      // Check if line contains an image placeholder
      const imageMatch = line.match(/\[IMAGE:(\d+)\]/);
      
      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1]) - 1;
        const textBeforeImage = line.replace(/\[IMAGE:\d+\]/, '').trim();
        
        // Add any accumulated text as a paragraph
        if (currentParagraphText.trim()) {
          const paragraphs = await createFormattedParagraph(currentParagraphText);
          bodyChildren.push(...paragraphs);
          currentParagraphText = '';
        }
        
        // Create two-column table for text and image (without borders)
        if (images[imageIndex]) {
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
                  await createTextCell(textBeforeImage),
                  await createImageCell(images[imageIndex], imageIndex),
                ],
              }),
            ],
          });
          
          bodyChildren.push(table);
        } else {
          // Image not found, just add the text
          const paragraphs = await createFormattedParagraph(textBeforeImage);
          bodyChildren.push(...paragraphs);
        }
      } else {
        // Check for numbered line
        const numberedMatch = line.match(numberedLineRegex);
        if (numberedMatch) {
          // Add any accumulated text as a paragraph before starting a numbered list
          if (currentParagraphText.trim()) {
            const paragraphs = await createFormattedParagraph(currentParagraphText);
            bodyChildren.push(...paragraphs);
            currentParagraphText = '';
          }

          const numberParts = numberedMatch[1].split('.');
          const level = numberParts.length - 1;
          const text = numberedMatch[2];
          bodyChildren.push(createNumberedParagraph(text, level));
        } else if (line.trim()) {
          currentParagraphText += (currentParagraphText ? '\n' : '') + line;
        } else if (currentParagraphText.trim()) {
          // Empty line, add accumulated text as paragraph
          const paragraphs = await createFormattedParagraph(currentParagraphText);
          bodyChildren.push(...paragraphs);
          currentParagraphText = '';
          bodyChildren.push(new Paragraph({ text: "" })); // Empty paragraph for spacing
        }
      }
    }
    
    // Add any remaining text
    if (currentParagraphText.trim()) {
      const paragraphs = await createFormattedParagraph(currentParagraphText);
      bodyChildren.push(...paragraphs);
    }

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
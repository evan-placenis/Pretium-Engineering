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

interface SectionSelection {
  locationPlan: boolean;
  generalProjectStatus: boolean;
  observations: boolean;
  stagingArea: boolean;
}

/**
 * Parses the AI report content into a structure grouped by section and image.
 * Each bullet point is associated with its section, image(s), and bullet number.
 * Now more robust: only treat a line as a section header if it matches the section regex and does NOT match the bullet regex.
 */
function parseReportSectionsAndImages(content: string) {
  // Do not filter out empty lines here
  const lines = content.split('\n');
  let currentSection = 'General Observations';
  const sectionRegex = /^\d+\.\s*(.+)$/;
  const bulletRegex = /^(\d+\.\d+)\s+(.*)$/;
  const imageRegex = /\[IMAGE:(\d+):([^\]]+)\]/gi;

  const grouped: Record<string, Record<string, { number: string, text: string, groupName: string }[]>> = {};

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue; // skip empty lines
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && !line.match(bulletRegex)) {
      currentSection = sectionMatch[1].trim();
      continue;
    }
    const bulletMatch = line.match(bulletRegex);
    const bulletNumber = bulletMatch ? bulletMatch[1] : '';
    const bulletText = bulletMatch ? bulletMatch[2] : line;
    const imageMatches = [...line.matchAll(imageRegex)];
    if (imageMatches.length === 0) continue;
    if (!grouped[currentSection]) grouped[currentSection] = {};
    for (const match of imageMatches) {
      const imageId = match[1];
      const groupName = match[2];
      if (!grouped[currentSection][imageId]) grouped[currentSection][imageId] = [];
      let cleanText = bulletText.replace(imageRegex, '').trim();
      // Remove extra spaces before punctuation and collapse multiple spaces
      cleanText = cleanText.replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ');
      grouped[currentSection][imageId].push({ number: bulletNumber, text: cleanText, groupName });
    }
  }
  return grouped;
}

// Helper: Render section heading
function renderSectionHeading(section: string) {
  return createNumberedParagraph(section, 0);
}

// Helper: Render bullets for an image
async function renderBulletsForImage(bullets: { number: string, text: string, groupName: string }[]) {
  return (await Promise.all(
    bullets.map(async ({ number, text }) => {
      if (number) {
        // Only use the bullet text, not the AI's number
        return createNumberedParagraph(text, 1);
      } else {
        // fallback to createTextCell for non-numbered
        const cell = await createTextCell(text);
        // Extract Paragraph(s) from TableCell using _children (private)
        return Array.isArray((cell as any)._children) ? (cell as any)._children : [(cell as any)._children];
      }
    })
  )).flat();
}

// Helper: Render image + bullets table
async function renderImageTable(bulletParagraphs: any[], image: ReportImage | undefined, imageId: string, imageIndex: number) {
  return new Table({
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
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 100, left: 0, right: 100 },
            children: bulletParagraphs,
          }),
          image
            ? await createImageCell(image, imageIndex)
            : new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `[Image ${imageId}: not available]`,
                        font: "Segoe UI",
                        size: 20,
                      }),
                    ],
                  }),
                ],
              }),
        ],
      }),
    ],
  });
}

export const createWordDocumentWithImages = async (
  content: string, 
  images: ReportImage[], 
  filename: string, 
  project: Project | null,
  sectionSelection?: SectionSelection
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


    const projectDetailsTable = await createProjectDetailsTable(project);
    // Add project details table
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

    // --- NEW GROUPING LOGIC ---
    const grouped = parseReportSectionsAndImages(content);
    // For each section
    for (const [section, imagesMap] of Object.entries(grouped)) {
      // Add section heading using helper
      bodyChildren.push(renderSectionHeading(section));
      // For each image in this section
      for (const [imageId, bullets] of Object.entries(imagesMap)) {
        const imageNum = parseInt(imageId);
        const groupName = bullets[0]?.groupName || '';
        
        // Find the image by group and number
        const img = images.find(img => {
          const hasGroup = img.group && img.group.length > 0;
          const groupMatches = hasGroup && img.group!.some(g => g === groupName);
          const numberMatches = img.number === imageNum;
          return groupMatches && numberMatches;
        });
        
        // Compose bullet list as Paragraphs using helper
        const bulletParagraphs = await renderBulletsForImage(bullets);
        // Create table row: bullets left, image right using helper
        const table = await renderImageTable(bulletParagraphs, img, imageId, imageNum - 1);
        bodyChildren.push(table);
      }
    }
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
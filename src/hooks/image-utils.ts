// Image utility functions for alternating and random image selection

// Building images available in the public folder
const BUILDING_IMAGES = [
  '/building_images/building.png',
  '/building_images/building2.png', 
  '/building_images/buildings.png',
  '/building_images/skyline.png'
];

// Report images available in the public folder
const REPORT_IMAGES = [
  '/report_images/report.png',
  '/report_images/report2.png'
];

/**
 * Get a building image based on index (for alternating)
 * @param index - The index to determine which image to show
 * @returns The path to the building image
 */
export function getBuildingImage(index: number): string {
  return BUILDING_IMAGES[index % BUILDING_IMAGES.length];
}

/**
 * Get a random building image
 * @returns The path to a random building image
 */
export function getRandomBuildingImage(): string {
  const randomIndex = Math.floor(Math.random() * BUILDING_IMAGES.length);
  return BUILDING_IMAGES[randomIndex];
}

/**
 * Get a report image based on index (for alternating)
 * @param index - The index to determine which image to show
 * @returns The path to the report image
 */
export function getReportImage(index: number): string {
  return REPORT_IMAGES[index % REPORT_IMAGES.length];
}

/**
 * Get a random report image
 * @returns The path to a random report image
 */
export function getRandomReportImage(): string {
  const randomIndex = Math.floor(Math.random() * REPORT_IMAGES.length);
  return REPORT_IMAGES[randomIndex];
}

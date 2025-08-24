export interface ImageReference {
    number: number;
    group?: string[];
  }
  
  export interface Section {
    id: string;
    number: string;
    title?: string;
    bodyMd?: string[];
    images?: ImageReference[];
    children?: Section[];
    displayHint?: 'locationPlan' | 'stagingArea' | 'default';
  }
    
    export interface SectionSummary {
      id: string;
      number: string;
      title: string;
      path: string[];      // Full path to section for disambiguation
      previewText: string; // First ~200 chars
    }
  
    export interface SectionEditState {
      sections: Section[];
      version: number;      // For tracking changes
      lastModified: string; // ISO timestamp
    }

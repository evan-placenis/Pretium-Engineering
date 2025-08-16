import { z } from 'zod';
import { Section } from '../jsonTreeModels/types/section'; // Assume path to Section type
import React from 'react';

//we are using the strategy pattern to allow for different report structures, maybe we want to use inheritance or factory methods instead- think about later
export interface ReportStructureStrategy {
  getSchema(): z.ZodObject<any>;
  autoNumber(sections: Section[], parentNumber: string): void;
  getCustomRenderer(section: Section): React.ComponentType<{ section: Section }> | null;
  getDefaultSections(): Section[];
}

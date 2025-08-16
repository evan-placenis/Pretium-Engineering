import { z } from 'zod';
import { ReportStructureStrategy } from '../reportStrategies';
import { Section } from '../../jsonTreeModels/types/section';
import { v4 as uuidv4 } from 'uuid';
import React from 'react';
import { LocationPlanSection, StagingAreaSection } from './custom_renderers';

export class ObservationReportStrategy implements ReportStructureStrategy {
  getSchema(): z.ZodObject<any> {
    const ImageRefSchema = z.object({
      number: z.number(),
      group: z.string().array().optional()
    });

    return z.object({
      title: z.string().optional(),
      bodyMd: z.string().array().optional(),
      images: ImageRefSchema.array().optional(),
      children: z.lazy(() => this.getSchema().array()).optional()
    });
  }

  autoNumber(sections: Section[], parentNumber: string): void {
    sections.forEach((sec, index) => {
      const num = parentNumber ? `${parentNumber.replace(/\.$/, '')}.${index + 1}` : `${index + 1}.`;
      sec.number = num;
      if (sec.children) {
        this.autoNumber(sec.children, num);
      }
    });
  }

  getDefaultSections(): Section[] {
    return [
      {
        id: uuidv4(),
        number: '',
        title: 'Location Plan',
        bodyMd: ['Location plan content goes here.'],
        children: [],
        images: [],
        displayHint: 'locationPlan'
      },
      {
        id: uuidv4(),
        number: '',
        title: 'Staging Area',
        bodyMd: ['Staging area content goes here.'],
        children: [],
        images: [],
        displayHint: 'stagingArea'
      }
    ];
  }

  getCustomRenderer(section: Section): React.ComponentType<{ section: Section }> | null {
    if (section.displayHint === 'locationPlan') {
      return LocationPlanSection;
    }
    if (section.displayHint === 'stagingArea') {
      return StagingAreaSection;
    }
    return null;
  }
}

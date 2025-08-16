import React from 'react';
import { Section } from '@/lib/jsonTreeModels/types/section';

// Custom-styled components for special sections
export const LocationPlanSection: React.FC<{ section: Section }> = ({ section }) => (
  <div className="report-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
    <div className="report-header">{section.title}</div>
    <img src="/placeholder.png" alt="Location Plan Placeholder" className="report-image" style={{ marginTop: '1rem' }} />
  </div>
);

export const StagingAreaSection: React.FC<{ section: Section }> = ({ section }) => (
  <div>
    <div className="report-header">{section.title}</div>
      <div className="report-row">
          <div className="report-text">
            <div className="report-boxed-item"><span className="report-boxed-num">x.1</span>Items without photo are a row in the table and can be inserted in the table where required to ensure proper ordering of items.</div>
            <div className="report-boxed-item"><span className="report-boxed-num">x.2</span>You can add sub-headings and the row will expand if needed</div>
          </div>
          <div className="report-image-block">
            <img src="/placeholder.png" alt="Site / Staging Area Placeholder" className="report-image" />
            <p className="report-image-caption"><strong>Site / Staging Area</strong></p>
          </div>
      </div>
  </div>
);

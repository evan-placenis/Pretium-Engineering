"use client";

import React from 'react';
import styles from '../report_style.module.css';
import Image from 'next/image';
import { Section } from '@/lib/jsonTreeModels/types/section';
import { EditableField } from './EditableField';
import { useReportSaver } from '../hooks/useReportSaver';
import { ReportStructureStrategy } from '@/lib/report_strucutres/reportStrategies';
import { ReportImage } from '@/types/reportImage';
import { useRouter } from 'next/router';

interface ReportEditorProps {
  reportId: string;
  content: string | null;
  setContent: (content: string) => void;
  isStreaming: boolean;
  streamingStatus: string;
  sections?: Section[];
  onSectionsChange: (sections: Section[]) => void;
  reportImages?: ReportImage[];
  strategy: ReportStructureStrategy;
}

const CustomImage = ({ src, alt }: { src?: string; alt?: string }) => {
  if (!src) return null;
  return (
    <div className={styles.imageContainer}>
      <Image
        src={src}
        alt={alt || 'Report Image'}
        width={500}
        height={300}
        className={styles.reportImage}
        style={{ objectFit: 'contain' }}
      />
    </div>
  );
};

export const ReportEditor: React.FC<ReportEditorProps> = ({
  reportId,
  sections,
  onSectionsChange,
  reportImages,
  isStreaming,
  streamingStatus,
}) => {
  const { saveSections, isSaving, saveError } = useReportSaver(reportId);

  const handleSave = (updatedSections: Section[]) => {
    onSectionsChange(updatedSections);
    saveSections(updatedSections);
  };

  const handleTitleChange = (sectionId: string, newTitle: string) => {
    const newSections = JSON.parse(JSON.stringify(sections || []));
    const findAndUpdate = (secs: Section[]): boolean => {
      for (const sec of secs) {
        if (sec.id === sectionId) {
          sec.title = newTitle;
          return true;
        }
        if (sec.children && findAndUpdate(sec.children)) {
          return true;
        }
      }
      return false;
    };
    findAndUpdate(newSections);
    handleSave(newSections);
  };

  const handleBodyChange = (sectionId: string, newBody: string) => {
    const newSections = JSON.parse(JSON.stringify(sections || []));
    const findAndUpdate = (secs: Section[]): boolean => {
      for (const sec of secs) {
        if (sec.id === sectionId) {
          sec.bodyMd = [newBody];
          return true;
        }
        if (sec.children && findAndUpdate(sec.children)) {
          return true;
        }
      }
      return false;
    };
    findAndUpdate(newSections);
    handleSave(newSections);
  };

  const renderSections = (currentSections: Section[], level = 0): JSX.Element[] => {
    return currentSections.map(sec => {
      const isSubSection = level > 0;

      return (
        <div 
          key={sec.id} 
          className={styles.section}
          style={{ 
            marginLeft: '0px', 
            marginBottom: '1rem' 
          }}
        >
          {isSubSection ? (
            <div className={styles.subSectionContainer}>
              <div className={styles.subSectionTitle}>
                <span className={styles.subSectionNumber}>{sec.number}</span>
                <EditableField
                  initialValue={sec.bodyMd ? sec.bodyMd.join(' ') : ''}
                  onSave={(newValue) => handleBodyChange(sec.id, newValue)}
                  as="span"
                  className={styles.editableBody}
                  multiline={true}
                />
              </div>
              {sec.images && sec.images.length > 0 && (
                <div className={styles.imageGallery}>
                  {sec.images.map((imageRef, index) => {
                    const image = reportImages?.find(img => 
                      img.number === imageRef.number &&
                      (!imageRef.group || imageRef.group.length === 0 || (img.group && img.group.some(g => imageRef.group?.includes(g))))
                    );
                    if (image?.signedUrl) {
                      return <CustomImage key={index} src={image.signedUrl} alt={`Image ${image.number}`} />;
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              {React.createElement(`h${level + 1}`, { className: styles.sectionHeader }, 
                <span style={{ marginRight: '0.5em' }}>{sec.number}</span>,
                <EditableField
                  initialValue={sec.title || ''}
                  onSave={(newValue) => handleTitleChange(sec.id, newValue)}
                  as="span"
                />
              )}
              {sec.children && sec.children.length > 0 && renderSections(sec.children, level + 1)}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <div className={styles.reportContainer}>
      {isSaving && <div className={styles.savingOverlay}>Saving...</div>}
      {saveError && <div className={styles.saveErrorOverlay}>Error: {saveError}</div>}
      {isStreaming && (
        <div className={styles.streamingOverlay}>
          <div className={styles.spinner}></div>
          <p className={styles.streamingStatus}>{streamingStatus}</p>
        </div>
      )}
      <div className={styles.reportPreview}>
      <Image
        src="/pretium_header.png"
        alt="Pretium Header"
        width={1200}
        height={200}
        style={{ width: '100%', height: 'auto', marginBottom: '2rem' }}
      />
        {sections && sections.length > 0
          ? renderSections(sections)
          : !isStreaming && <div className={styles.noContent}>No structured content available.</div>
        }
      </div>
    </div>
  );
}; 
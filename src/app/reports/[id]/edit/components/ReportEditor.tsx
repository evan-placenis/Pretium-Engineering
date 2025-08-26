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
  signalEdit: () => void; // Replaces onSaveComplete
  reportImages?: ReportImage[];
  strategy: ReportStructureStrategy;
}

const CustomImage = ({ src, alt, imageNumber }: { src?: string; alt?: string; imageNumber?: string | number }) => {
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
      {imageNumber && (
        <div className={styles.imageNumber}>
          Image {imageNumber}
        </div>
      )}
    </div>
  );
};

export const ReportEditor: React.FC<ReportEditorProps> = ({
  reportId,
  sections,
  onSectionsChange,
  signalEdit, // Use signalEdit
  reportImages,
  isStreaming,
  streamingStatus,
}) => {
  const { saveSections, isSaving, saveError } = useReportSaver(reportId);

  // Calculate sequential image numbers globally - recursively traverse all sections
  const imageSequentialMap = new Map<string, number>();
  let globalImageCounter = 1;
  
  const traverseAllSections = (sectionList: Section[]) => {
    for (const section of sectionList) {
      if (section.images && section.images.length > 0) {
        for (let i = 0; i < section.images.length; i++) {
          const imageKey = `${section.id}-${i}`;
          imageSequentialMap.set(imageKey, globalImageCounter);
          globalImageCounter++;
        }
      }
      if (section.children && section.children.length > 0) {
        traverseAllSections(section.children);
      }
    }
  };
  
  if (sections) {
    traverseAllSections(sections);
  }

  const handleSave = async (updatedSections: Section[]) => {
    onSectionsChange(updatedSections);
    const success = await saveSections(updatedSections);
    if (success) {
      signalEdit(); // Signal that an edit has occurred
    }
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
          // Assuming each sub-section has a bodyMd array with one item.
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

  const SectionItem: React.FC<{ section: Section; level: number }> = ({ section: sec, level }) => {
    const HeaderTag = `h${level + 1}` as keyof JSX.IntrinsicElements;

    // Pre-process children into observation groups. A new group starts with an image.
    const observationGroups: Section[][] = [];
    if (sec.children && sec.children.length > 0) {
      let currentGroup: Section[] = [];
      sec.children.forEach(child => {
        if (child.images && child.images.length > 0) {
          if (currentGroup.length > 0) {
            observationGroups.push(currentGroup);
          }
          currentGroup = [child];
        } else {
          currentGroup.push(child);
        }
      });
      if (currentGroup.length > 0) {
        observationGroups.push(currentGroup);
      }
    }

    return (
      <div className={styles.section}>
        <HeaderTag className={styles.sectionHeader}>
          <span style={{ marginRight: '0.5em' }}>{sec.number}</span>
          <EditableField
            initialValue={sec.title || ''}
            onSave={(newValue) => handleTitleChange(sec.id, newValue)}
            as="span"
          />
        </HeaderTag>

        {/* Map over the re-grouped observations */}
        {observationGroups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className={styles.mainSectionLayout}>
            {/* Left column for text points in this group */}
            <div className={styles.textColumn}>
              {group.map((child) => {
                const bodyText = (Array.isArray(child.bodyMd) && child.bodyMd.length > 0) ? child.bodyMd[0] : '';
                return (
                  <div key={child.id} className={styles.subSectionContainer}>
                    <span className={styles.subSectionNumber}>{child.number}</span>
                    <EditableField
                      initialValue={bodyText}
                      onSave={(newValue) => handleBodyChange(child.id, newValue)}
                      as="span"
                      className={styles.editableBody}
                      multiline={true}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Right column for this group's image gallery */}
            <div className={styles.imageColumn}>
              {(() => {
                const firstChild = group[0];
                if (firstChild && firstChild.images && firstChild.images.length > 0) {
                  return (
                    <div className={styles.imageGallery}>
                      {firstChild.images.map((imageRef, idx) => {
                        const image = reportImages?.find(
                          (img) =>
                            img.number === imageRef.number &&
                            (!imageRef.group ||
                              imageRef.group.length === 0 ||
                              (img.group &&
                                img.group.some((g) => imageRef.group?.includes(g)))),
                        );
                        if (!image?.signedUrl) return null;
                        const groupPart = Array.isArray(imageRef.group)
                          ? (imageRef.group ?? []).join('|')
                          : imageRef.group ?? '';
                        const imgKey = `${imageRef.number ?? 'n'}-${groupPart}-${idx}`;
                        
                        // Get sequential image number from global map
                        const imageKey = `${firstChild.id}-${idx}`;
                        const sequentialImageNumber = imageSequentialMap.get(imageKey) || 1;

                        
                        return (
                          <CustomImage
                            key={imgKey}
                            src={image.signedUrl}
                            alt={`Image ${sequentialImageNumber}`}
                            imageNumber={sequentialImageNumber}
                          />
                        );
                      })}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        ))}
      </div>
    );
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
      {sections && sections.length > 0 ? (
        sections.map((section, idx) => (
          <SectionItem
            key={section.id ?? `root-${idx}`}
            section={section}
            level={0}
          />
        ))
      ) : !isStreaming ? (
        <div className={styles.noContent}>
          No structured content available.
        </div>
      ) : null}
      </div>
    </div>
  );
}; 
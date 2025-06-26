"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ImageListView } from '@/components/image_components';
import { useViewPreference } from '@/hooks/useViewPreference';
import { useImageManagement } from '@/hooks/useImageManagement';
import { Toast } from '@/components/feedback';
import { 
  UploadPhotoModal,
  ImagesHeader,
  ImagesFilters,
  CreateGroupMode,
  ImageModal,
  GroupHeader,

  ImageCard,
  NumberingMode,
} from './components';

import{
  useImageData,
  useImageFilters,
  useImageSelection,
  useImageGroups,
  useImageModal,
  useImageUpload,
  useImageNumbering,
  type ExtendedProjectImage
} from './hooks';

export default function ProjectImagesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const selectionMode = searchParams.get('mode') === 'select';
  const returnTo = searchParams.get('returnTo');
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Use the view preference hook for persistent view state
  const { viewMode, setViewMode } = useViewPreference('project-images');
  
  // Use the shared image management hook
  const { updateImageFromAutoSave } = useImageManagement({
    projectId,
    onSuccessMessage: (message) => setSuccessMessage(message)
  });

  // Custom hooks for different functionality
  const {
    images,
    filteredImages: dataFilteredImages,
    project,
    currentUser,
    imagesInReports,
    loading,
    error,
    setFilteredImages,
    updateImageInList,
    refreshImages
  } = useImageData({ projectId });

  const {
    dateFilter,
    tagFilter,
    descriptionFilter,
    userFilter,
    reportUsageFilter,
    sortOrder,
    filteredImages,
    setDateFilter,
    setTagFilter,
    setDescriptionFilter,
    setUserFilter,
    setReportUsageFilter,
    setSortOrder,
    handleSortChange,
    clearAllFilters
  } = useImageFilters({
    images: dataFilteredImages,
    imagesInReports,
    currentUser
  });

  const {
    selectedImages,
    setSelectedImages,
    toggleImageSelection,
    handleSelectAll,
    handleDeselectAll,
    handleConfirmSelection,
    isImageSelected,
    getSelectedCount
  } = useImageSelection({
    filteredImages,
    projectId,
    selectionMode,
    returnTo
  });

  const {
    createGroupMode,
    groupName,
    editingGroup,
    editGroupName,
    editGroupSelected,
    editGroupLoading,
    groupViewModes,
    setGroupViewModes,
    collapsedGroups,
    setCreateGroupMode,
    setGroupName,
    handleSaveGroup,
    handleDeleteGroup,
    startEditGroup,
    cancelEditGroup,
    saveEditGroup,
    toggleGroupViewMode,
    getGroupViewMode,
    toggleGroupCollapse,
    isGroupCollapsed,
    getAllGroups,
    setEditGroupName,
    setEditGroupSelected
  } = useImageGroups({
    projectId,
    images,
    selectedImages,
    onSuccessMessage: (message: string) => setSuccessMessage(message),
    onRefreshImages: refreshImages
  });

  const {
    selectedImage,
    editMode,
    editDescription,
    editTag,
    updateLoading,
    deleteLoading,
    handleImageClick,
    closeModal,
    handleDelete,
    handleUpdate,
    setEditMode,
    setEditDescription,
    setEditTag
  } = useImageModal({
    projectId,
    onSuccessMessage: (message: string) => setSuccessMessage(message),
    onRefreshImages: refreshImages
  });

  const {
    uploadLoading,
    uploadProgress,
    showUploadModal,
    setShowUploadModal,
    handlePhotoUpload
  } = useImageUpload({
    projectId,
    onSuccessMessage: (message: string) => setSuccessMessage(message),
    onRefreshImages: refreshImages
  });

  const {
    numberingMode,
    numberingSelection,
    updatePhotoNumber,
    startNumberingMode,
    handleNumberingSelection,
    completeNumbering,
    cancelNumbering
  } = useImageNumbering({
    filteredImages,
    onSuccessMessage: (message: string) => setSuccessMessage(message),
    onRefreshImages: refreshImages
  });

  // Calculate ungrouped images at the top level so it can be used everywhere
  const ungroupedImages: ExtendedProjectImage[] = filteredImages.filter(img => !img.group || (Array.isArray(img.group) && img.group.length === 0));

  // Handle auto-save updates from list view
  const handleImageUpdateFromAutoSave = (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | 'overview' | 'deficiency' | number | null) => {
    updateImageInList(imageId, field, value);
    if (field === 'description' && typeof value === 'string') {
      updateImageFromAutoSave(imageId, value);
    }
  };

  // Handle checkbox changes for image selection
  const handleImageCheckboxChange = (imageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (selectionMode) {
      toggleImageSelection(imageId);
    } else if (editingGroup) {
      const newSet = new Set(editGroupSelected);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      setEditGroupSelected(newSet);
    } else if (numberingMode) {
      handleNumberingSelection(imageId);
    }
  };

  // Handle image selection
  const handleImageSelect = (image: ExtendedProjectImage) => {
    if (selectionMode) {
      toggleImageSelection(image.id);
    } else if (editingGroup) {
      const newSet = new Set(editGroupSelected);
      if (newSet.has(image.id)) {
        newSet.delete(image.id);
      } else {
        newSet.add(image.id);
      }
      setEditGroupSelected(newSet);
    } else if (numberingMode) {
      handleNumberingSelection(image.id);
    } else {
      handleImageClick(image);
    }
  };

  // Handle create report
  const handleCreateReport = (imageIds: string[]) => {
    router.push(`/reports/new?images=${imageIds.join(',')}`);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div>Loading images...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div style={{ color: 'red' }}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', marginTop: '2rem' }}>
      {/* Success Toast */}
      {successMessage && (
        <Toast
          message={successMessage}
          type="success"
        />
      )}

      {/* Header */}
      <ImagesHeader
        projectName={project?.name}
        imageCount={filteredImages.length}
        selectionMode={selectionMode}
        selectedCount={getSelectedCount()}
        viewMode={viewMode}
        uploadLoading={uploadLoading}
        onUploadClick={() => setShowUploadModal(true)}
        onConfirmSelection={handleConfirmSelection}
        onCancel={() => router.back()}
        onCreateGroup={() => setCreateGroupMode(true)}
        createGroupLoading={false}
      />

      {/* Filters */}
      {!selectionMode && (
        <ImagesFilters
          dateFilter={dateFilter}
          tagFilter={tagFilter}
          descriptionFilter={descriptionFilter}
          userFilter={userFilter}
          reportUsageFilter={reportUsageFilter}
          sortOrder={sortOrder}
          onDateFilterChange={setDateFilter}
          onTagFilterChange={setTagFilter}
          onDescriptionFilterChange={setDescriptionFilter}
          onUserFilterChange={setUserFilter}
          onReportUsageFilterChange={setReportUsageFilter}
          onSortChange={handleSortChange}
          onClearFilters={clearAllFilters}
        />
      )}

      {/* Create Group Mode */}
      {createGroupMode && (
        <CreateGroupMode
          groupName={groupName}
          selectedCount={Array.from(selectedImages).filter(id => ungroupedImages.some(img => img.id === id)).length}
          uploadLoading={uploadLoading}
          images={ungroupedImages}
          selectedImages={new Set(Array.from(selectedImages).filter(id => ungroupedImages.some(img => img.id === id)))}
          onGroupNameChange={setGroupName}
          onSaveGroup={async () => {
            await handleSaveGroup();
            setSelectedImages(new Set());
            await refreshImages();
          }}
          onCancel={() => { setCreateGroupMode(false); setGroupName(''); setSelectedImages(new Set()); }}
          onToggleImageSelection={toggleImageSelection}
        />
      )}

      {/* Main Content */}
      {viewMode === 'list' ? (
        <ImageListView
          images={filteredImages}
          onUpdateImage={handleImageUpdateFromAutoSave}
          onAutoSaveUpdate={updateImageFromAutoSave}
          onShowSuccessMessage={(message) => setSuccessMessage(message)}
          currentUserId={currentUser?.id}
          projectId={projectId}
          imagesInReports={imagesInReports}
        />
      ) : (
        renderGridWithGroups()
      )}

      {/* Image Modal */}
      <ImageModal
        image={selectedImage}
        editMode={editMode}
        editDescription={editDescription}
        editTag={editTag}
        updateLoading={updateLoading}
        deleteLoading={deleteLoading}
        currentUserId={currentUser?.id}
        projectId={projectId}
        onClose={closeModal}
        onDelete={handleDelete}
        onUpdate={handleUpdate}
        onEditModeToggle={() => setEditMode(!editMode)}
        onEditDescriptionChange={setEditDescription}
        onEditTagChange={setEditTag}
      />

      {/* Upload Photo Modal */}
      <UploadPhotoModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handlePhotoUpload}
        loading={uploadLoading}
        progress={uploadProgress}
      />
    </div>
  );

  // Helper function to render grid with groups
  function renderGridWithGroups(): JSX.Element {
    const groups: { [key: string]: ExtendedProjectImage[] } = {};
    filteredImages.forEach(img => {
      if (img.group && Array.isArray(img.group) && img.group.length > 0) {
        const groupName = img.group[0];
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(img);
      }
    });
    
    return (
      <div>
        {Object.entries(groups).map(([groupName, groupImages]) => {
          // Sort images by number (numbered first, ascending), then unnumbered
          const sortedGroupImages = [...groupImages].sort((a, b) => {
            if (typeof a.number === 'number' && typeof b.number === 'number') return a.number - b.number;
            if (typeof a.number === 'number') return -1;
            if (typeof b.number === 'number') return 1;
            return 0;
          });
          const groupViewMode = getGroupViewMode(groupName);
          const isCollapsed = isGroupCollapsed(groupName);
          const isEditing = editingGroup === groupName;
          return (
            <div key={groupName} style={{ marginBottom: '2rem' }}>
              {/* Group Header */}
              <GroupHeader
                groupName={groupName}
                imageCount={groupImages.length}
                isEditing={isEditing}
                editGroupName={editGroupName}
                editGroupLoading={editGroupLoading}
                groupViewMode={groupViewMode}
                isCollapsed={isCollapsed}
                numberingMode={numberingMode === groupName ? groupName : null}
                onEditGroupNameChange={setEditGroupName}
                onSaveEditGroup={saveEditGroup}
                onCancelEditGroup={cancelEditGroup}
                onToggleViewMode={() => toggleGroupViewMode(groupName)}
                onToggleCollapse={() => toggleGroupCollapse(groupName)}
                onStartNumbering={() => startNumberingMode(groupName)}
                onClearNumbers={() => {
                  const numberedImages = groupImages.filter(img => img.number);
                  if (numberedImages.length === 0) {
                    setSuccessMessage(`No photos in "${groupName}" are numbered!`);
                    return;
                  }
                  if (confirm(`Clear numbers from ${numberedImages.length} photos in "${groupName}"?`)) {
                    Promise.all(numberedImages.map(img => updatePhotoNumber(img.id, null)))
                      .then(() => {
                        setSuccessMessage(`Cleared numbers from ${numberedImages.length} photos in "${groupName}"`);
                        refreshImages();
                      })
                      .catch(() => {
                        setSuccessMessage('Failed to clear some numbers');
                      });
                  }
                }}
                onStartEditGroup={() => {}}
                onDeleteGroup={() => {}}
                onCompleteNumbering={completeNumbering}
                onCancelNumbering={cancelNumbering}
                numberingSelectionCount={numberingSelection.length}
                uploadLoading={uploadLoading}
              />
              {/* Numbering Mode Controls for Group */}
              {numberingMode === groupName && (
                <NumberingMode
                  selectedCount={numberingSelection.length}
                  onComplete={completeNumbering}
                  onCancel={cancelNumbering}
                />
              )}
              {groupViewMode === 'list' ? (
                <ImageListView
                  images={groupImages}
                  onUpdateImage={handleImageUpdateFromAutoSave}
                  onAutoSaveUpdate={updateImageFromAutoSave}
                  onShowSuccessMessage={(message) => setSuccessMessage(message)}
                  currentUserId={currentUser?.id}
                  projectId={projectId}
                  imagesInReports={imagesInReports}
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '1rem'
                }}>
                  {groupImages.map(img => (
                    <ImageCard
                      key={img.id}
                      image={img}
                      showGroupBadges={false}
                      editGroupMode={false}
                      selectionMode={selectionMode}
                      numberingMode={numberingMode}
                      isSelected={isImageSelected(img.id)}
                      isInReport={imagesInReports.has(img.url)}
                      isNumbering={numberingMode === groupName && numberingSelection.includes(img.id)}
                      numberingIndex={numberingMode === groupName ? numberingSelection.indexOf(img.id) : -1}
                      editGroupSelected={editGroupSelected}
                      onSelect={() => handleImageSelect(img)}
                      onCheckboxChange={(e) => handleImageCheckboxChange(img.id, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped images */}
        {ungroupedImages.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <GroupHeader
              groupName="Ungrouped"
              imageCount={ungroupedImages.length}
              isEditing={false}
              editGroupName=""
              editGroupLoading={false}
              groupViewMode={getGroupViewMode('ungrouped')}
              isCollapsed={false}
              numberingMode={numberingMode === 'ungrouped' ? 'ungrouped' : null}
              onEditGroupNameChange={() => {}}
              onSaveEditGroup={() => {}}
              onCancelEditGroup={() => {}}
              onToggleViewMode={() => toggleGroupViewMode('ungrouped')}
              onToggleCollapse={() => {}}
              onStartNumbering={() => startNumberingMode('ungrouped')}
              onClearNumbers={() => {
                const numberedImages = ungroupedImages.filter(img => img.number);
                if (numberedImages.length === 0) {
                  setSuccessMessage('No ungrouped photos are numbered!');
                  return;
                }
                if (confirm(`Clear numbers from ${numberedImages.length} ungrouped photos?`)) {
                  Promise.all(numberedImages.map(img => updatePhotoNumber(img.id, null)))
                    .then(() => {
                      setSuccessMessage(`Cleared numbers from ${numberedImages.length} ungrouped photos`);
                      refreshImages();
                    })
                    .catch(() => {
                      setSuccessMessage('Failed to clear some numbers');
                    });
                }
              }}
              onStartEditGroup={() => {}}
              onDeleteGroup={() => {}}
              onCompleteNumbering={completeNumbering}
              onCancelNumbering={cancelNumbering}
              numberingSelectionCount={numberingSelection.length}
              uploadLoading={uploadLoading}
            />
            {/* Numbering Mode Controls for Ungrouped */}
            {numberingMode === 'ungrouped' && (
              <NumberingMode
                selectedCount={numberingSelection.length}
                onComplete={completeNumbering}
                onCancel={cancelNumbering}
              />
            )}
            {getGroupViewMode('ungrouped') === 'list' ? (
              <ImageListView
                images={ungroupedImages}
                onUpdateImage={handleImageUpdateFromAutoSave}
                onAutoSaveUpdate={updateImageFromAutoSave}
                onShowSuccessMessage={(message) => setSuccessMessage(message)}
                currentUserId={currentUser?.id}
                projectId={projectId}
                imagesInReports={imagesInReports}
              />
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '1rem'
              }}>
                {ungroupedImages.map(img => (
                  <ImageCard
                    key={img.id}
                    image={img}
                    showGroupBadges={false}
                    editGroupMode={false}
                    selectionMode={selectionMode}
                    numberingMode={numberingMode}
                    isSelected={isImageSelected(img.id)}
                    isInReport={imagesInReports.has(img.url)}
                    isNumbering={numberingMode === 'ungrouped' && numberingSelection.includes(img.id)}
                    numberingIndex={numberingMode === 'ungrouped' ? numberingSelection.indexOf(img.id) : -1}
                    editGroupSelected={editGroupSelected}
                    onSelect={() => handleImageSelect(img)}
                    onCheckboxChange={(e) => handleImageCheckboxChange(img.id, e)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
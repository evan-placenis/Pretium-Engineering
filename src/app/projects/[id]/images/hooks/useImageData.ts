import { useEffect, useState } from 'react';
import { supabase, ProjectImage, Project } from '@/lib/supabase';
import { TagValue } from '@/lib/tagConfig';

// Extended interface to track rotation and changes
export interface ExtendedProjectImage extends ProjectImage {
  rotation?: number;
  originalDescription?: string;
  originalTag?: TagValue;
  number?: number | null;
}

interface UseImageDataProps {
  projectId: string;
}

interface UseImageDataReturn {
  // Data state
  images: ExtendedProjectImage[];
  filteredImages: ExtendedProjectImage[];
  project: Project | null;
  currentUser: any;
  imagesInReports: Set<string>;
  
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Actions
  setFilteredImages: (images: ExtendedProjectImage[]) => void;
  updateImageInList: (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | 'overview' | 'deficiency' | null | number) => void;
  refreshImages: () => Promise<void>;
}

export function useImageData({ projectId }: UseImageDataProps): UseImageDataReturn {
  const [images, setImages] = useState<ExtendedProjectImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<ExtendedProjectImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [imagesInReports, setImagesInReports] = useState<Set<string>>(new Set());

  // Fetch project info
  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (!error) setProject(data);
    };
    fetchProject();
  }, [projectId]);

  // Fetch images and report usage data
  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      // Fetch project images
      const { data, error } = await supabase
        .from('project_images')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      // Initialize extended properties
      const extendedData = (data || []).map(img => ({
        ...img,
        rotation: img.rotation || 0,
        originalDescription: img.description,
        originalTag: img.tag,
        number: img.number
      }));
      
      setImages(extendedData);
      setFilteredImages(extendedData);
      
      // Fetch which images are used in reports
      const { data: reportImagesData, error: reportImagesError } = await supabase
        .from('report_images')
        .select('url')
        .not('url', 'is', null);
        
      if (reportImagesError) {
        console.error('Error fetching report images:', reportImagesError);
      } else {
        const reportUrls = new Set(reportImagesData?.map(img => img.url) || []);
        setImagesInReports(reportUrls);
      }
    } catch (err: any) {
      console.error('Error fetching images:', err);
      setError(err.message || 'Failed to fetch images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchImages();
    }
  }, [projectId]);

  // Update image in list with change tracking
  const updateImageInList = (imageId: string, field: 'description' | 'tag' | 'rotation' | 'number', value: string | 'overview' | 'deficiency' | null | number) => {
    setImages(prevImages => 
      prevImages.map(img => {
        if (img.id === imageId) {
          const updated = { ...img, [field]: value };
          
          return updated;
        }
        return img;
      })
    );
    
    setFilteredImages(prevFiltered => 
      prevFiltered.map(img => {
        if (img.id === imageId) {
          const updated = { ...img, [field]: value };
          
          return updated;
        }
        return img;
      })
    );
  };

  const refreshImages = async () => {
    await fetchImages();
  };

  return {
    images,
    filteredImages,
    project,
    currentUser,
    imagesInReports,
    loading,
    error,
    setFilteredImages,
    updateImageInList,
    refreshImages
  };
} 
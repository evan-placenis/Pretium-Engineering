// Centralized tag configuration - update tags here and they'll update everywhere
export interface TagConfig {
  value: string;
  label: string;
  badgeClass: string;
  description?: string;
}

export const TAG_CONFIGS: TagConfig[] = [
  {
    value: 'overview',
    label: 'Overview',
    badgeClass: 'badge-info',
    description: 'General project overview images'
  },
  {
    value: 'deficiency',
    label: 'Deficiency',
    badgeClass: 'badge-danger',
    description: 'Issues found during inspection'
  },
  {
    value: 'critical',
    label: 'Critical Issue',
    badgeClass: 'badge-danger',
    description: 'Urgent problems requiring immediate attention'
  },
  {
    value: 'safety',
    label: 'Safety Concern',
    badgeClass: 'badge-danger',
    description: 'Safety-related observations'
  },
  {
    value: 'maintenance',
    label: 'Maintenance Required',
    badgeClass: 'badge-warning',
    description: 'Items needing maintenance'
  },
  {
    value: 'info',
    label: 'General Information',
    badgeClass: 'badge-info',
    description: 'Informational images'
  }
];

// Derived types and utilities
export type TagValue = typeof TAG_CONFIGS[number]['value'] | null;

export const getTagConfig = (value: string | null): TagConfig | null => {
  if (!value) return null;
  return TAG_CONFIGS.find(config => config.value === value) || null;
};

export const getTagLabel = (value: string | null): string => {
  if (!value) return 'No Category';
  const config = getTagConfig(value);
  return config?.label || 'Unknown';
};

export const getTagBadgeClass = (value: string | null): string => {
  if (!value) return 'badge-secondary';
  const config = getTagConfig(value);
  return config?.badgeClass || 'badge-secondary';
};

export const getAllTagValues = (): string[] => {
  return TAG_CONFIGS.map(config => config.value);
};

export const getAllTagOptions = (): Array<{value: string; label: string}> => {
  return [
    { value: '', label: 'No Category' },
    ...TAG_CONFIGS.map(config => ({ value: config.value, label: config.label }))
  ];
}; 
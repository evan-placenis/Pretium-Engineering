'use client';

interface ImagesFiltersProps {
  dateFilter: string;
  tagFilter: string;
  descriptionFilter: string;
  userFilter: string;
  reportUsageFilter: string;
  sortOrder: 'desc' | 'asc' | 'manual';
  onDateFilterChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onDescriptionFilterChange: (value: string) => void;
  onUserFilterChange: (value: string) => void;
  onReportUsageFilterChange: (value: string) => void;
  onSortChange: () => void;
  onClearFilters: () => void;
}

export default function ImagesFilters({
  dateFilter,
  tagFilter,
  descriptionFilter,
  userFilter,
  reportUsageFilter,
  sortOrder,
  onDateFilterChange,
  onTagFilterChange,
  onDescriptionFilterChange,
  onUserFilterChange,
  onReportUsageFilterChange,
  onSortChange,
  onClearFilters
}: ImagesFiltersProps) {
  return (
    <div style={{ 
      background: 'var(--color-bg-card)', 
      padding: '1.5rem', 
      borderRadius: '0.5rem', 
      marginBottom: '2rem',
      border: '1px solid var(--color-border)'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div>
          <label className="form-label">Date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value)}
            className="form-input"
          />
        </div>
        
        <div>
          <label className="form-label">Tag:</label>
          <select
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            className="form-input"
          >
            <option value="">All tags</option>
            <option value="overview">Overview</option>
            <option value="deficiency">Deficiency</option>
          </select>
        </div>
        
        <div>
          <label className="form-label">Description:</label>
          <input
            type="text"
            value={descriptionFilter}
            onChange={(e) => onDescriptionFilterChange(e.target.value)}
            placeholder="Search descriptions..."
            className="form-input"
          />
        </div>
        
        <div>
          <label className="form-label">User:</label>
          <select
            value={userFilter}
            onChange={(e) => onUserFilterChange(e.target.value)}
            className="form-input"
          >
            <option value="">All users</option>
            <option value="mine">My photos</option>
            <option value="others">Others' photos</option>
          </select>
        </div>
        
        <div>
          <label className="form-label">Report Usage:</label>
          <select
            value={reportUsageFilter}
            onChange={(e) => onReportUsageFilterChange(e.target.value)}
            className="form-input"
          >
            <option value="">All images</option>
            <option value="used">Used in reports</option>
            <option value="unused">Not used in reports</option>
          </select>
        </div>
        
        <div>
          <label className="form-label">Sort:</label>
          <button
            onClick={onSortChange}
            className="btn btn-secondary"
            style={{ minWidth: '100px' }}
          >
            {sortOrder === 'desc' ? 'Newest First' : sortOrder === 'asc' ? 'Oldest First' : 'Manual Order'}
          </button>
        </div>
        
        <button
          onClick={onClearFilters}
          className="btn btn-secondary"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
} 
'use client';

interface NumberedImageCardProps {
  image: {
    id: string;
    url: string;
    description?: string;
    number?: number | null;
  };
  groupName: string;
  isNumbering: boolean;
  isNumberingSelected: boolean;
  numberingIndex: number;
  isNumberingEnabled: boolean;
  onNumberingSelection: (imageId: string) => void;
}

export default function NumberedImageCard({
  image,
  groupName,
  isNumbering,
  isNumberingSelected,
  numberingIndex,
  isNumberingEnabled,
  onNumberingSelection
}: NumberedImageCardProps) {
  return (
    <div 
      style={{
        position: "relative",
        border: isNumberingSelected ? '2px solid #2563eb' : "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        cursor: isNumbering ? 'pointer' : 'default',
        backgroundColor: isNumberingSelected ? 'rgba(37,99,235,0.08)' : 'var(--color-bg-card)',
        transition: 'all 0.2s ease'
      }}
      onClick={() => {
        if (isNumbering) {
          onNumberingSelection(image.id);
        }
      }}
    >
      {/* Numbering selection checkbox */}
      {isNumbering && (
        <div style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          zIndex: 10
        }}>
          <input
            type="checkbox"
            checked={isNumberingSelected}
            onChange={() => onNumberingSelection(image.id)}
            style={{ transform: 'scale(1.2)' }}
          />
        </div>
      )}

      {/* Number badge */}
      {isNumberingSelected ? (
        <div style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          zIndex: 10
        }}>
          <div style={{
            width: "2rem",
            height: "2rem",
            borderRadius: "50%",
            backgroundColor: "#2563eb",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            fontWeight: "600",
            border: "2px solid #fff",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)"
          }}>
            {numberingIndex + 1}
          </div>
        </div>
      ) : isNumberingEnabled && image.number && (
        <div style={{
          position: "absolute",
          top: "0.5rem",
          left: "0.5rem",
          background: "rgba(0, 0, 0, 0.8)",
          color: "white",
          borderRadius: "50%",
          width: "2rem",
          height: "2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.875rem",
          fontWeight: "600",
          zIndex: 10
        }}>
          {image.number}
        </div>
      )}

      <img
        src={image.url}
        alt={image.description || 'Project image'}
        style={{
          width: "100%",
          height: "150px",
          objectFit: "cover"
        }}
      />
      <div style={{
        padding: "0.5rem",
        fontSize: "0.875rem"
      }}>
        <div style={{ color: "var(--color-text-secondary)" }}>
          {image.description ? 
            (image.description.length > 50 ? 
              image.description.substring(0, 50) + '...' : 
              image.description
            ) : 
            'No description'
          }
        </div>
      </div>
    </div>
  );
} 
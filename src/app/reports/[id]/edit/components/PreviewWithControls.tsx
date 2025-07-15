import React, { useEffect, useRef } from 'react';

interface PreviewWithControlsProps {
  htmlContent: string;
  onImagePlus: (imageId: number, groupName: string) => void;
  onImageMinus: (imageId: number, groupName: string) => void;
}

export const PreviewWithControls: React.FC<PreviewWithControlsProps> = ({
  htmlContent,
  onImagePlus,
  onImageMinus
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Add CSS for the buttons
    const style = document.createElement('style');
    style.textContent = `
      .image-control-btn {
        width: 25px;
        height: 25px;
        border-radius: 50%;
        border: none;
        color: white;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: transform 0.1s ease;
      }
      .image-control-btn:hover {
        transform: scale(1.1);
      }
      .image-control-plus {
        background: #28a745;
        width: 35px;
        height: 35px;
        margin: 10px auto;
        display: block;
        opacity: 0.3;
        transition: opacity 0.3s ease;
      }
      .image-control-plus:hover {
        opacity: 1;
      }
      .image-control-minus {
        background: #dc3545;
      }
    `;
    document.head.appendChild(style);

    // Wait for DOM to update after innerHTML change
    setTimeout(() => {
      if (!containerRef.current) return;
      
      const images = containerRef.current.querySelectorAll('.report-image');
      
      images.forEach((img) => {
        const imageElement = img as HTMLImageElement;
        const caption = imageElement.nextElementSibling as HTMLElement;
        
        if (caption && caption.className === 'report-image-caption') {
          // Extract image ID and group from caption
          const captionText = caption.textContent || '';
          const trimmedText = captionText.trim();
          
          // More robust regex that handles various dash types and special characters
          const match = trimmedText.match(/Photo\s+(\d+)\s+\(([^)]+)\)\s*:/);
          
          // If the standard regex fails, try a fallback approach
          if (!match) {
            // Try to extract just the photo number and everything in parentheses
            const fallbackMatch = trimmedText.match(/Photo\s+(\d+)\s+\(([^)]*)\)/);
            
            if (fallbackMatch) {
              const imageId = parseInt(fallbackMatch[1]);
              const groupName = fallbackMatch[2];
              
              // Add minus button to top-right of image
              const imageBlock = imageElement.closest('.report-image-block') as HTMLElement;
              if (imageBlock) {
                imageBlock.style.position = 'relative';
                
                // Create minus button for top-right of image
                const minusBtn = document.createElement('button');
                minusBtn.className = 'image-control-btn image-control-minus';
                minusBtn.textContent = '−';
                minusBtn.title = 'Remove image';
                minusBtn.style.position = 'absolute';
                minusBtn.style.top = '10px';
                minusBtn.style.right = '10px';
                minusBtn.style.zIndex = '5';
                minusBtn.onclick = () => onImageMinus(imageId, groupName);
                
                imageBlock.appendChild(minusBtn);
                
                // Add plus button centered below the entire row
                const reportRow = imageBlock.closest('.report-row') as HTMLElement;
                if (reportRow) {
                  // Create plus button for center below text
                  const plusBtn = document.createElement('button');
                  plusBtn.className = 'image-control-btn image-control-plus';
                  plusBtn.textContent = '+';
                  plusBtn.title = 'Add image below';
                  plusBtn.onclick = () => onImagePlus(imageId, groupName);
                  
                  // Insert the plus button after the report row
                  reportRow.parentNode?.insertBefore(plusBtn, reportRow.nextSibling);
                }
              }
            }
          }
          if (match) {
            const imageId = parseInt(match[1]);
            const groupName = match[2];
            
            // Add minus button to top-right of image
            const imageBlock = imageElement.closest('.report-image-block') as HTMLElement;
            if (imageBlock) {
              imageBlock.style.position = 'relative';
              
              // Create minus button for top-right of image
              const minusBtn = document.createElement('button');
              minusBtn.className = 'image-control-btn image-control-minus';
              minusBtn.textContent = '−';
              minusBtn.title = 'Remove image';
              minusBtn.style.position = 'absolute';
              minusBtn.style.top = '10px';
              minusBtn.style.right = '10px';
              minusBtn.style.zIndex = '5';
              minusBtn.onclick = () => onImageMinus(imageId, groupName);
              
              imageBlock.appendChild(minusBtn);
              
              // Add plus button centered below the entire row
              const reportRow = imageBlock.closest('.report-row') as HTMLElement;
              if (reportRow) {
                // Create plus button for center below text
                const plusBtn = document.createElement('button');
                plusBtn.className = 'image-control-btn image-control-plus';
                plusBtn.textContent = '+';
                plusBtn.title = 'Add image below';
                plusBtn.onclick = () => onImagePlus(imageId, groupName);
                
                // Insert the plus button after the report row
                reportRow.parentNode?.insertBefore(plusBtn, reportRow.nextSibling);
              }
            }
          }
        }
      });
    }, 100); // 100ms delay to ensure DOM is updated

    // Cleanup function
    return () => {
      const controlDivs = containerRef.current?.querySelectorAll('[style*="position: absolute"][style*="top: 10px"]');
      controlDivs?.forEach(div => div.remove());
      const plusButtons = containerRef.current?.querySelectorAll('.image-control-plus');
      plusButtons?.forEach(btn => btn.remove());
      document.head.removeChild(style);
    };
  }, [htmlContent, onImagePlus, onImageMinus]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        fontFamily: 'Times New Roman, serif',
        fontSize: '12pt',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        color: '#333',
        textAlign: 'left',
        userSelect: 'text'
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}; 
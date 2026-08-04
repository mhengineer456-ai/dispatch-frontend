// StickerLayouts.js
import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiCheck, FiChevronLeft, FiChevronRight, FiPrinter } from 'react-icons/fi';
import JsBarcode from 'jsbarcode';

// Layout 1: Simple Black & White (Mohit Hosiery Sticker)
export const SimpleBlackWhiteSticker = ({ sticker, matrix, setsCalculation, batchId, packingInfo }) => {
  const barcodeCanvasRef = useRef(null);
  
  const activeColors = matrix?.rows?.filter(row => (row.totalPcs || 0) > 0) || [];
  const totalColors = activeColors.length;
  const currentYear = new Date().getFullYear();
  
  const getInitials = (name) => {
    if (!name || name === '—') return '';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };
  
  const stitchingInitials = getInitials(matrix?.supervisor);
  const packingInitials = getInitials(packingInfo?.packingSupervisor);
  const initialsText = [stitchingInitials, packingInitials]
    .filter(initials => initials && initials !== '—')
    .join('/');
  
  useEffect(() => {
    if (barcodeCanvasRef.current && batchId) {
      try {
        JsBarcode(barcodeCanvasRef.current, batchId, {
          format: "CODE128",
          width: 1.5,
          height: 30,
          displayValue: false,
          fontSize: 10,
          margin: 1,
          textMargin: 1,
          font: "monospace",
          textAlign: "center",
          lineColor: "#000000",
          background: "#ffffff"
        });
      } catch (error) {
        console.error('Barcode render error:', error);
      }
    }
  }, [batchId]);
  
  return (
    <div className="simple-sticker" style={{
      width: `61mm`,
      height: `40.6mm`,
      backgroundColor: '#ffffff',
      border: '1px solid #000000',
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 10px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Top Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: '6px'
      }}>
        {/* Left Side - Static Info */}
        <div style={{
          textAlign: 'left'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#000000',
            lineHeight: '1.3'
          }}>
            {currentYear}/1100/100
          </div>
          <div style={{
            fontSize: '9px',
            fontWeight: '500',
            color: '#000000',
            lineHeight: '1.3'
          }}>
            {initialsText || '—'} 16894
          </div>
        </div>
        
        {/* Right Side - SRN Info */}
        <div style={{
          textAlign: 'right'
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#000000',
            lineHeight: '1.3'
          }}>
            SRN 7846252
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            color: '#000000',
            lineHeight: '1.3'
          }}>
            {currentYear}/110
          </div>
        </div>
      </div>
      
      {/* Color Count - Optional */}
      {totalColors > 0 && (
        <div style={{
          fontSize: '15px',
          fontWeight: 'bold',
          color: '#000000',
          textAlign: 'center',
          marginBottom: '4px'
        }}>
          CL-{totalColors}
        </div>
      )}
      
      {/* Barcode Section - Center */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        margin: '6px 0',
        flex: 1
      }}>
        <canvas 
          ref={barcodeCanvasRef}
          width="200"
          height="35"
          style={{
            width: '160px',
            height: 'auto',
            display: 'block'
          }}
        />
      </div>
      
      {/* Bottom Section - No border line */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginTop: '6px'
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '900',
          color: '#000000',
          textAlign: 'left'
        }}>
          200{matrix?.lotNumber || sticker.lotNumber}
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: '900',
          color: '#000000',
          textAlign: 'right'
        }}>
          PCS: {setsCalculation.piecesPerSet}
        </div>
      </div>
    </div>
  );
};

// Layout 2: Detailed Layout (SS Design Sticker)
export const DetailedSticker = ({ sticker, matrix, setsCalculation, batchId, packingInfo }) => {
  const barcodeCanvasRef = useRef(null);
  const currentYear = new Date().getFullYear();
  
  const activeColors = matrix?.rows?.filter(row => (row.totalPcs || 0) > 0) || [];
  const totalColors = activeColors.length;
  
  const getInitials = (name) => {
    if (!name || name === '—') return '';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };
  
  const stitchingInitials = getInitials(matrix?.supervisor);
  const packingInitials = getInitials(packingInfo?.packingSupervisor);
  const initialsText = [stitchingInitials, packingInitials]
    .filter(initials => initials && initials !== '—')
    .join('/');
  
  useEffect(() => {
    if (barcodeCanvasRef.current && batchId) {
      try {
        JsBarcode(barcodeCanvasRef.current, batchId, {
          format: "CODE128",
          width: 1.5,
          height: 30,
          displayValue: false,
          fontSize: 10,
          margin: 1,
          textMargin: 1,
          font: "monospace",
          textAlign: "center",
          lineColor: "#000000",
          background: "#ffffff"
        });
      } catch (error) {
        console.error('Barcode render error:', error);
      }
    }
  }, [batchId]);
  
  return (
    <div style={{
      width: `61mm`,
      height: `40.6mm`,
      backgroundColor: '#ffffff',
      border: '1px solid #000000',
      fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
      color: 'black',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 15px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Top Section with Static Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: '8px'
      }}>
        {/* Left Side - Product Info */}
        <div style={{
          textAlign: 'left',
          fontSize: '9px',
          lineHeight: '1.4'
        }}>
          <div><span style={{ fontWeight: 'bold' }}>PRODUCT:</span> </div>
          <div><span style={{ fontWeight: 'bold' }}>SIZE:</span> </div>
          <div><span style={{ fontWeight: 'bold' }}>STYLE:</span> AVCHG{matrix?.lotNumber || '—'}</div>
          <div><span style={{ fontWeight: 'bold' }}>PACKED-YY:</span> {currentYear}</div>
          <div><span style={{ fontWeight: 'bold' }}>NET QUANTITY:</span> 1N</div>
          <div><span style={{ fontWeight: 'bold' }}>COLOUR:</span> {totalColors} {totalColors === 1 ? 'Color' : 'Colors'}</div>
        </div>
        
        {/* Right Side - PCS Count and Initials */}
        <div style={{
          textAlign: 'right',
          fontSize: '9px',
          lineHeight: '1.4'
        }}>
          <div><span style={{ fontWeight: 'bold' }}>PCS:</span> {setsCalculation.piecesPerSet}</div>
          <div style={{ marginTop: '4px', fontSize: '8px' }}>{initialsText || '—'}</div>
        </div>
      </div>
      
      {/* Barcode Section - Bottom */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 'auto',
        paddingTop: '4px'
      }}>
        <canvas 
          ref={barcodeCanvasRef}
          width="200"
          height="35"
          style={{
            width: '170px',
            height: 'auto',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};

// Layout Selection Dialog Component - Updated with only 2 options
export const LayoutSelectionDialog = ({ isOpen, onClose, onSelectLayout, totalStickers }) => {
  const [selectedLayout, setSelectedLayout] = useState('simple');
  
  const layouts = [
    {
      id: 'simple',
      name: 'Mohit Hosiery Sticker',
      description: 'Standard format with lot number, barcode, and PCS information',
      component: SimpleBlackWhiteSticker,
      icon: '🏭',
      dimensions: '2.4" × 1.6"'
    },
    {
      id: 'detailed',
      name: 'SS Design Sticker',
      description: 'Detailed layout with product info, style, color count, and complete details',
      component: DetailedSticker,
      icon: '✨',
      dimensions: '2.4" × 1.6"'
    }
  ];
  
  const handleSelect = () => {
    const layout = layouts.find(l => l.id === selectedLayout);
    onSelectLayout(layout);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#000000' }}>Select Sticker Layout</h3>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div style={{ padding: '20px' }}>
          <p style={{ marginBottom: '16px', color: '#000000' }}>
            Choose a layout for your {totalStickers} stickers:
          </p>
          
          <div style={{ display: 'grid', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
            {layouts.map(layout => (
              <div
                key={layout.id}
                onClick={() => setSelectedLayout(layout.id)}
                style={{
                  border: `2px solid ${selectedLayout === layout.id ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  backgroundColor: selectedLayout === layout.id ? '#f0f9ff' : 'white',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>{layout.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#000000' }}>
                      {layout.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#000000', marginBottom: '4px' }}>
                      {layout.description}
                    </div>
                    <div style={{ fontSize: '11px', color: '#000000' }}>
                      Size: {layout.dimensions}
                    </div>
                  </div>
                  {selectedLayout === layout.id && (
                    <FiCheck style={{ color: '#3b82f6', fontSize: '20px' }} />
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                border: '1px solid #e2e8f0',
                backgroundColor: 'white',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#000000'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Generate {totalStickers} Stickers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sticker Preview Modal with Layout Support
export const StickerPreviewModal = ({ 
  isOpen, 
  onClose, 
  stickers, 
  matrix, 
  setsCalculation, 
  batchId, 
  packingInfo,
  selectedLayout,
  onPrint 
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const stickersPerPage = 12;
  
  if (!isOpen) return null;
  
  const currentStickers = stickers.slice(
    currentPage * stickersPerPage,
    (currentPage + 1) * stickersPerPage
  );
  
  const totalPages = Math.ceil(stickers.length / stickersPerPage);
  const StickerComponent = selectedLayout?.component || SimpleBlackWhiteSticker;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px' }}>
        <div className="modal-header">
          <h3 style={{ color: '#000000' }}>
            Sticker Preview - {stickers.length} Stickers
            <span style={{ fontSize: '0.8rem', marginLeft: '8px', color: '#000000' }}>
              ({selectedLayout?.name || 'Mohit Hosiery Sticker'} Layout - 2.4" × 1.6")
            </span>
          </h3>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="stickers-container">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
            {currentStickers.map((sticker) => (
              <StickerComponent
                key={sticker.id}
                sticker={sticker}
                matrix={matrix}
                setsCalculation={setsCalculation}
                batchId={batchId}
                packingInfo={packingInfo}
              />
            ))}
          </div>
        </div>
        
        {totalPages > 1 && (
          <div className="page-control">
            <button 
              className="page-button" 
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <FiChevronLeft /> Previous
            </button>
            <span className="page-info" style={{ color: '#000000' }}>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button 
              className="page-button" 
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
            >
              Next <FiChevronRight />
            </button>
            <button className="print-button" onClick={onPrint} style={{ background: '#3b82f6' }}>
              <FiPrinter /> Print All ({stickers.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
// ManualStickerCreate.js
import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManualStickerCreate.css';
import {
  FiSave, FiArrowLeft, FiTag, FiUser, FiCalendar, FiPackage, 
  FiPrinter, FiEye, FiInfo, FiCheck, FiAlertTriangle, FiLayers,
  FiMessageSquare, FiPlus, FiMinus, FiType, FiMaximize, FiMinimize2,
  FiBold
} from 'react-icons/fi';
import JsBarcode from 'jsbarcode';

// Helper functions (YOUR ORIGINAL)
function generateVerificationCode(lotNumber) {
  const cleanLot = String(lotNumber).replace(/[^0-9]/g, '');
  let sum = 0;
  for (let i = 0; i < cleanLot.length; i++) {
    sum += parseInt(cleanLot[i]);
  }
  return (sum % 97).toString().padStart(2, '0');
}

function getInitialsWithRole(name, roleSuffix) {
  if (!name || name === '—') return '';
  let cleanName = name.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (roleSuffix === 'S') {
    cleanName = cleanName.replace(/stitching/gi, '').replace(/sewing/gi, '').trim();
  } else if (roleSuffix === 'P') {
    cleanName = cleanName.replace(/packing/gi, '').trim();
  }
  let initial = cleanName.charAt(0).toUpperCase();
  if (!/[A-Z]/i.test(initial) && cleanName.length > 0) {
    const match = cleanName.match(/[A-Z]/i);
    if (match) initial = match[0].toUpperCase();
  }
  return initial ? `${initial}${roleSuffix}` : roleSuffix;
}

function generateBarcodeId(lotNumber, groupLetter = 'A') {
  const cleanLot = lotNumber.replace(/[^A-Za-z0-9]/g, '');
  return `LOT-${cleanLot}${groupLetter}`;
}

// Sticker Generator Class (YOUR ORIGINAL)
class ManualStickerGenerator {
  static async renderBarcode(canvas, data, width = 300, height = 180) {
    return new Promise((resolve) => {
      try {
        const ctx = canvas.getContext('2d');
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(scale, scale);
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        JsBarcode(canvas, data, {
          format: "CODE128",
          width: 3,
          height: 50,
          displayValue: false,
          fontSize: 14,
          margin: 8,
          textMargin: 4,
          font: "monospace",
          textAlign: "center",
          lineColor: "#000000",
          background: "#ffffff",
          flat: true,
        });
        
        setTimeout(() => resolve(), 150);
      } catch (error) {
        console.error('Barcode render error:', error);
        resolve();
      }
    });
  }

  static async generateHighQualityBarcode(data, width = 350, height = 90) {
    const canvas = document.createElement('canvas');
    await this.renderBarcode(canvas, data, width, height);
    return canvas.toDataURL('image/png', 1.0);
  }
}

// ========== YOUR ORIGINAL STICKER LAYOUTS (UNCHANGED) ==========
const SimpleSticker = ({ sticker, lotNumber, piecesPerSet, totalColors, currentYear, stitchingInitials, packingInitials, barcodeImage }) => {
  const initialsText = [stitchingInitials, packingInitials]
    .filter(initials => initials && initials !== '—' && initials !== 'S' && initials !== 'P')
    .join('/');
  
  return `
    <style>
      @page {
        size: 61mm 40.6mm;
        margin: 0;
      }
      body { margin: 0; background: white; }
      @media print {
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
      .barcode-img {
        image-rendering: crisp-edges;
        image-rendering: pixelated;
        image-rendering: -webkit-optimize-contrast;
      }
    </style>
    <div style="
      width: 61mm; 
      height: 40.6mm; 
      background-color: #ffffff; 
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
      display: flex; 
      flex-direction: column; 
      padding: 16px 10px 6px 10px; 
      box-sizing: border-box; 
      position: relative;
    ">
      <div style="height: 8px;"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 0px;">
        <div style="text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${currentYear}/1100/100</div>
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${initialsText || '—'} 16894</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">SRN 7846252</div>
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${currentYear}/110</div>
        </div>
      </div>
      
      ${totalColors > 0 ? `
        <div style="font-size: 11px; font-weight: 700; color: #000000; text-align: left; margin: -2px 0 8px 0;">CL-${totalColors}</div>
      ` : '<div style="height: 4px;"></div>'}
      
      <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin: 6px 0 10px 0;">
        <img src="${barcodeImage}" alt="barcode" class="barcode-img" style="width: 190px; height: auto; display: block;" />
      </div>
      
      <div style="height: 6px;"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 6px; padding-top: 2px;">
        <div style="font-size: 20px; font-weight: 900; color: #000000; text-align: left; letter-spacing: 0.5px;">200${lotNumber}</div>
        <div style="font-size: 16px; font-weight: 900; color: #000000; text-align: right; letter-spacing: 0.5px;">PCS: ${piecesPerSet}</div>
      </div>
    </div>
  `;
};

const DetailedSticker = ({ sticker, lotNumber, piecesPerSet, totalColors, currentYear, stitchingInitials, packingInitials, barcodeImage }) => {
  const initialsText = [stitchingInitials, packingInitials]
    .filter(initials => initials && initials !== '—' && initials !== 'S' && initials !== 'P')
    .join('/');
  
  return `
    <style>
      @page { size: 61mm 40.6mm; margin: 0; }
      body { margin: 0; background: white; }
      @media print {
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      .barcode-img { image-rendering: crisp-edges; image-rendering: pixelated; }
    </style>
    <div class="detailed-label" style="width: 61mm; height: 40.6mm; background-color: #ffffff; display: flex; flex-direction: column-reverse; padding: 6px 8px; box-sizing: border-box;">
      <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin: 2px 0; background: white; padding: 2px 0;">
        <img src="${barcodeImage}" alt="barcode" class="barcode-img" style="width: 180px; height: auto; display: block;" />
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 8px; flex-direction: row;">
        <div style="text-align: left; font-size: 9px; line-height: 1.4;">
          <div style="margin-bottom: 2px; font-size: 9px; color: #000000;">
            <span style="font-weight: bold;">IM#442455</span>
            ${initialsText ? `<span style="margin-left: 4px; font-weight: normal;">${initialsText}</span>` : ''}
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 10px;">PRODUCT: </span>
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 11px;">STYLE: </span>
            <span style="font-size: 12px;font-weight: bold">AVCHG${lotNumber}</span>
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 10px;">PACKED-YY: </span>
            <span style="font-size: 10px;font-weight: bold">${currentYear}</span>
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 10px;">NET QTY: </span>
            <span style="font-size: 10px;font-weight: bold">${piecesPerSet}N</span>
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 10px;">COLOUR: </span>
            <span style="font-size: 10px;font-weight: bold">${totalColors}</span>
          </div>
        </div>
        <div style="text-align: right; margin-top: 2px;">
          <div style="margin-bottom: 1px; font-size: 9px; color: #000000;">
            <span style="font-weight: bold;">LYSW514511301</span>
          </div>
          <div style="margin-bottom: 3px;">
            <span style="font-weight: bold; font-size: 22px; color: #000000;">${piecesPerSet}</span>
          </div>
        </div>
      </div>
    </div>
  `;
};

const CompactSticker = ({ sticker, lotNumber, piecesPerSet, totalColors, brand, barcodeImage }) => {
  return `
    <div style="width: 61mm; height: 40.6mm; background-color: #ffffff; border: 1px solid #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">LOT-${lotNumber}</div>
      <div style="font-size: 10px; margin-bottom: 6px;">PCS: ${piecesPerSet}</div>
      <div style="font-size: 8px; margin-bottom: 4px;">${totalColors} Colors</div>
      ${brand ? `<div style="font-size: 8px; margin-bottom: 4px;">${brand}</div>` : ''}
      <img src="${barcodeImage}" alt="barcode" style="width: 170px; height: auto; display: block;" />
    </div>
  `;
};

const ColorCodedSticker = ({ sticker, lotNumber, piecesPerSet, totalColors, brand, barcodeImage, index }) => {
  const colors = ['#f0f9ff', '#f0fdf4', '#fef3c7', '#fce7f3', '#f3e8ff'];
  const colorIndex = index % colors.length;
  
  return `
    <div style="width: 61mm; height: 40.6mm; background-color: ${colors[colorIndex]}; border: 2px solid #000000; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box;">
      <div style="background-color: #000000; color: #ffffff; padding: 2px 4px; font-size: 10px; font-weight: bold; margin-bottom: 4px; text-align: center;">LOT-${lotNumber}</div>
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 4px; font-size: 11px;">${piecesPerSet} PCS/SET</div>
        <div style="text-align: center; font-size: 10px; margin-bottom: 4px;">${totalColors} Colors</div>
        ${brand ? `<div style="text-align: center; font-size: 9px; margin-bottom: 4px;">${brand}</div>` : ''}
        <div style="text-align: center; margin: 4px 0;">
          <img src="${barcodeImage}" alt="barcode" style="width: 170px; height: auto; display: inline-block;" />
        </div>
      </div>
    </div>
  `;
};

// ========== UPDATED: Custom Message Sticker with Dynamic Dimensions & Bold Support ==========
const CustomMessageSticker = ({ messageLines, fontSizePx, borderColor, backgroundColor, stickerIndex, widthMm = 61, heightMm = 40.6, isBold = false }) => {
  const lines = messageLines.filter(line => line.text !== undefined ? line.text.trim() !== '' : line.trim() !== '');
  
  // Handle both old format (string array) and new format (object array with bold)
  const processedLines = lines.map(line => {
    if (typeof line === 'string') {
      return { text: line, bold: isBold };
    }
    return { text: line.text, bold: line.bold !== undefined ? line.bold : isBold };
  });
  
  if (processedLines.length === 0) {
    return `<div style="width: ${widthMm}mm; height: ${heightMm}mm; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">Empty message</div>`;
  }
  
  const textItems = processedLines.map(line => {
    const escapedLine = line.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fontWeight = line.bold ? '900' : 'normal';
    return `<div style="font-size: ${fontSizePx}px; font-weight: ${fontWeight}; line-height: 1.35; margin: 2px 0; word-break: break-word; text-align: center;">${escapedLine}</div>`;
  }).join('');
  
  return `
    <style>
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      body { margin: 0; background: white; }
      @media print {
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
    <div style="width: ${widthMm}mm; height: ${heightMm}mm; background-color: ${backgroundColor}; border: 2px solid ${borderColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 8px 12px; box-sizing: border-box; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; overflow: hidden; position: relative;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; max-height: 100%; overflow-y: auto;">
        ${textItems}
      </div>
      ${stickerIndex ? `<div style="position: absolute; bottom: 4px; right: 6px; font-size: 7px; color: #aaa; opacity: 0.6;">#${stickerIndex}</div>` : ''}
    </div>
  `;
};

// Layout Selection Dialog
const LayoutSelectionDialog = ({ isOpen, onClose, onSelectLayout, onSelectCustomMessage }) => {
  const layouts = [
    { id: 'simple', name: 'Simple Layout', description: 'Clean, bold text with scannable barcode', icon: '📄' },
    { id: 'detailed', name: 'Detailed Layout', description: 'More information with PROD/SRN details', icon: '📑' },
    { id: 'compact', name: 'Compact Layout', description: 'Minimalist design with border', icon: '🔲' },
    { id: 'colorful', name: 'Color Coded', description: 'Color-coded backgrounds for easy sorting', icon: '🎨' },
    { id: 'customMessage', name: '✏️ Custom Message Sticker', description: 'Write your own text, adjust font size & dimensions', icon: '💬' }
  ];

  if (!isOpen) return null;

  return (
    <div className="layout-dialog-overlay">
      <div className="layout-dialog">
        <h3>Select Sticker Layout</h3>
        <div className="layout-grid">
          {layouts.map(layout => (
            <div
              key={layout.id}
              className="layout-option"
              onClick={() => {
                if (layout.id === 'customMessage') {
                  onSelectCustomMessage();
                } else {
                  onSelectLayout(layout);
                }
              }}
            >
              <span className="layout-icon">{layout.icon}</span>
              <div>
                <div className="layout-name">{layout.name}</div>
                <div className="layout-description">{layout.description}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="cancel-button">Cancel</button>
      </div>
    </div>
  );
};

// ========== UPDATED: Custom Message Config Dialog with Dimensions & Bold Controls ==========
const CustomMessageConfigDialog = ({ isOpen, onClose, onGenerate, initialConfig }) => {
  // Support for line objects with bold property
  const [lines, setLines] = useState(initialConfig?.lines || [
    { text: 'Enter', bold: false },
    { text: 'Your Message', bold: true },
    { text: 'Here', bold: false }
  ]);
  const [fontSize, setFontSize] = useState(initialConfig?.fontSize || 16);
  const [borderColor, setBorderColor] = useState(initialConfig?.borderColor || '#000000');
  const [backgroundColor, setBackgroundColor] = useState(initialConfig?.backgroundColor || '#ffffff');
  const [stickerCount, setStickerCount] = useState(initialConfig?.stickerCount || 1);
  const [stickerWidth, setStickerWidth] = useState(initialConfig?.stickerWidth || 61);
  const [stickerHeight, setStickerHeight] = useState(initialConfig?.stickerHeight || 40.6);
  const [globalBold, setGlobalBold] = useState(initialConfig?.globalBold || false);

  const addLine = () => setLines([...lines, { text: '', bold: false }]);
  const removeLine = (index) => {
    if (lines.length > 1) {
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
    }
  };
  const updateLineText = (index, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], text: value };
    setLines(newLines);
  };
  const toggleLineBold = (index) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], bold: !newLines[index].bold };
    setLines(newLines);
  };
  
  const applyGlobalBold = () => {
    const newBoldState = !globalBold;
    setGlobalBold(newBoldState);
    const newLines = lines.map(line => ({ ...line, bold: newBoldState }));
    setLines(newLines);
  };

  if (!isOpen) return null;

  return (
    <div className="custom-msg-overlay">
      <div className="custom-msg-dialog">
        <div className="dialog-header">
          <h3><FiMessageSquare /> Custom Message Sticker</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        {/* Sticker Dimensions Controls */}
        <div className="dimensions-section">
          <label><FiMaximize /> Sticker Dimensions (mm)</label>
          <div className="dimensions-controls">
            <div className="dimension-input">
              <span>Width:</span>
              <input 
                type="number" 
                min="40" 
                max="120" 
                step="1" 
                value={stickerWidth} 
                onChange={(e) => setStickerWidth(Math.max(40, parseFloat(e.target.value) || 61))}
              />
              <span>mm</span>
            </div>
            <div className="dimension-input">
              <span>Height:</span>
              <input 
                type="number" 
                min="25" 
                max="80" 
                step="1" 
                value={stickerHeight} 
                onChange={(e) => setStickerHeight(Math.max(25, parseFloat(e.target.value) || 40.6))}
              />
              <span>mm</span>
            </div>
          </div>
        </div>
        
        <div className="msg-lines-section">
          <div className="lines-header">
            <label>📝 Text Lines</label>
            <button onClick={applyGlobalBold} className={`global-bold-btn ${globalBold ? 'active' : ''}`}>
              <FiBold /> {globalBold ? 'Unbold All' : 'Bold All'}
            </button>
          </div>
          <div className="lines-container">
            {lines.map((line, idx) => (
              <div key={idx} className="line-input-row">
                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => updateLineText(idx, e.target.value)}
                  placeholder={`Line ${idx+1}`}
                  style={{ fontWeight: line.bold ? 'bold' : 'normal' }}
                />
                <button 
                  onClick={() => toggleLineBold(idx)} 
                  className={`bold-line-btn ${line.bold ? 'active' : ''}`}
                  title="Toggle Bold"
                >
                  <FiBold />
                </button>
                <button onClick={() => removeLine(idx)} className="remove-line-btn">🗑️</button>
              </div>
            ))}
          </div>
          <button onClick={addLine} className="add-line-btn">+ Add Line</button>
        </div>
        
        <div className="msg-controls">
          <div className="control-group">
            <label><FiType /> Font Size: {fontSize}px</label>
            <div className="font-controls">
              <button onClick={() => setFontSize(prev => Math.max(8, prev - 2))}><FiMinus /></button>
              <span>{fontSize}px</span>
              <button onClick={() => setFontSize(prev => Math.min(98, prev + 2))}><FiPlus /></button>
            </div>
          </div>
          <div className="control-group">
            <label>Border Color</label>
            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
          </div>
          <div className="control-group">
            <label>Background</label>
            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
          </div>
          <div className="control-group">
            <label>Quantity</label>
            <input type="number" min="1" max="200" value={stickerCount} onChange={(e) => setStickerCount(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>
        
        <div className="preview-section">
          <label>🔍 Live Preview ({stickerWidth}mm x {stickerHeight}mm)</label>
          <div className="mini-preview" style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}>
            <div dangerouslySetInnerHTML={{ __html: CustomMessageSticker({ 
              messageLines: lines, 
              fontSizePx: fontSize, 
              borderColor, 
              backgroundColor, 
              stickerIndex: 1,
              widthMm: stickerWidth,
              heightMm: stickerHeight
            }) }} />
          </div>
        </div>
        
        <div className="dialog-actions">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={() => onGenerate({ 
            lines, fontSize, borderColor, backgroundColor, stickerCount, 
            stickerWidth, stickerHeight, globalBold 
          })} className="generate-btn">
            Generate {stickerCount} Sticker(s)
          </button>
        </div>
      </div>
    </div>
  );
};

// Sticker Preview Modal
const StickerPreviewModal = ({ isOpen, onClose, stickers, stickerData, onPrint }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const stickersPerPage = 12;
  
  if (!isOpen || !stickers.length) return null;
  
  const totalPages = Math.ceil(stickers.length / stickersPerPage);
  const startIdx = currentPage * stickersPerPage;
  const currentStickers = stickers.slice(startIdx, startIdx + stickersPerPage);
  
  return (
    <div className="preview-modal-overlay">
      <div className="preview-modal">
        <div className="preview-header">
          <h3>Sticker Preview ({stickers.length} stickers)</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>
        
        <div className="preview-grid">
          {currentStickers.map((sticker, idx) => (
            <div key={idx} dangerouslySetInnerHTML={{ __html: sticker.html }} />
          ))}
        </div>
        
        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>Previous</button>
            <span>Page {currentPage + 1} of {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1}>Next</button>
          </div>
        )}
        
        <div className="preview-actions">
          <button onClick={onClose} className="close-preview-btn">Close</button>
          <button onClick={() => onPrint(stickers.length)} className="print-btn"><FiPrinter /> Print All</button>
        </div>
      </div>
    </div>
  );
};

// Main Component
export default function ManualStickerCreate({ parties, onBack, onSubmit, currentUser }) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
    } else {
      navigate('/');
    }
  }, [onBack, navigate]);

  const [formData, setFormData] = useState({
    lotNumber: '',
    brand: '',
    style: '',
    fabric: '',
    garmentType: '',
    supervisor: '',
    packingSupervisor: '',
    packingDate: '',
    totalColors: 1,
    piecesPerSet: 1,
    numberOfStickers: 1,
    extraPercentage: 0,
    notes: ''
  });
  
  const [generatedStickers, setGeneratedStickers] = useState([]);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [existingCheck, setExistingCheck] = useState(null);
  const [showCustomMsgConfig, setShowCustomMsgConfig] = useState(false);
  const [customMsgData, setCustomMsgData] = useState(null);
  
  const currentYear = new Date().getFullYear();
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const totalStickers = useMemo(() => {
    const base = formData.numberOfStickers;
    const extra = Math.ceil(base * (formData.extraPercentage / 100));
    return base + extra;
  }, [formData.numberOfStickers, formData.extraPercentage]);
  
  const handleCheckLot = useCallback(async () => {
    if (!formData.lotNumber) {
      alert('Please enter a Lot Number');
      return;
    }
    setExistingCheck({ checking: true });
    setTimeout(() => {
      setExistingCheck({ exists: false, message: 'Lot not found in database. You can create manual stickers.' });
    }, 1000);
  }, [formData.lotNumber]);
  
  const handleGenerateStickers = useCallback(() => {
    if (!formData.lotNumber) {
      alert('Please enter Lot Number');
      return;
    }
    if (formData.piecesPerSet <= 0) {
      alert('Please enter valid Pieces per Set');
      return;
    }
    if (formData.numberOfStickers <= 0) {
      alert('Please enter valid number of stickers');
      return;
    }
    setShowLayoutDialog(true);
  }, [formData]);
  
  const handleLayoutSelect = useCallback(async (layout) => {
    setSelectedLayout(layout);
    setShowLayoutDialog(false);
    setIsGenerating(true);
    
    try {
      const lotNumber = formData.lotNumber;
      const piecesPerSet = formData.piecesPerSet;
      const totalColors = formData.totalColors;
      const barcodeId = generateBarcodeId(lotNumber, 'A');
      
      const stitchingInitials = getInitialsWithRole(formData.supervisor, 'S');
      const packingInitials = getInitialsWithRole(formData.packingSupervisor, 'P');
      
      const barcodeImage = await ManualStickerGenerator.generateHighQualityBarcode(barcodeId, 350, 90);
      
      const stickers = [];
      for (let i = 1; i <= totalStickers; i++) {
        let html = '';
        const stickerObj = { id: i, barcodeId, stickerNumber: i };
        
        if (layout.id === 'simple') {
          html = SimpleSticker({
            sticker: stickerObj,
            lotNumber,
            piecesPerSet,
            totalColors,
            currentYear,
            stitchingInitials,
            packingInitials,
            barcodeImage
          });
        } else if (layout.id === 'detailed') {
          html = DetailedSticker({
            sticker: stickerObj,
            lotNumber,
            piecesPerSet,
            totalColors,
            currentYear,
            stitchingInitials,
            packingInitials,
            barcodeImage
          });
        } else if (layout.id === 'compact') {
          html = CompactSticker({
            sticker: stickerObj,
            lotNumber,
            piecesPerSet,
            totalColors,
            brand: formData.brand,
            barcodeImage
          });
        } else if (layout.id === 'colorful') {
          html = ColorCodedSticker({
            sticker: stickerObj,
            lotNumber,
            piecesPerSet,
            totalColors,
            brand: formData.brand,
            barcodeImage,
            index: i
          });
        }
        
        stickers.push({ id: i, html, barcodeId });
      }
      
      setGeneratedStickers(stickers);
      setShowPreviewModal(true);
      
    } catch (error) {
      console.error('Error generating stickers:', error);
      alert('Failed to generate stickers: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  }, [formData, totalStickers, currentYear]);
  
  const handleCustomMessageClick = () => {
    setShowLayoutDialog(false);
    setShowCustomMsgConfig(true);
  };
  
  const handleGenerateCustomStickers = useCallback(async ({ lines, fontSize, borderColor, backgroundColor, stickerCount, stickerWidth, stickerHeight }) => {
    setIsGenerating(true);
    try {
      const stickers = [];
      for (let i = 1; i <= stickerCount; i++) {
        const html = CustomMessageSticker({ 
          messageLines: lines, 
          fontSizePx: fontSize, 
          borderColor, 
          backgroundColor, 
          stickerIndex: stickerCount > 1 ? i : null,
          widthMm: stickerWidth || 61,
          heightMm: stickerHeight || 40.6
        });
        stickers.push({ id: i, html, type: 'custom' });
      }
      setGeneratedStickers(stickers);
      setCustomMsgData({ lines, fontSize, borderColor, backgroundColor, stickerCount, stickerWidth, stickerHeight });
      setShowCustomMsgConfig(false);
      setShowPreviewModal(true);
    } catch (err) {
      console.error(err);
      alert('Error generating custom stickers');
    } finally {
      setIsGenerating(false);
    }
  }, []);
  
  const handlePrint = useCallback((count) => {
    const stickersToPrint = generatedStickers.slice(0, count);
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      const stickersHtml = stickersToPrint.map(s => s.html).join('');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print Stickers - Lot ${formData.lotNumber}</title>
            <meta charset="UTF-8">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { background: white; padding: 2mm; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
              .sticker-grid { display: flex; flex-wrap: wrap; gap: 1mm; justify-content: flex-start; }
              @media print {
                body { background: white; padding: 0; margin: 0; }
                .sticker-grid > div { break-inside: avoid; page-break-inside: avoid; }
              }
              img { print-color-adjust: exact; -webkit-print-color-adjust: exact; image-rendering: crisp-edges; }
            </style>
          </head>
          <body>
            <div class="sticker-grid">
              ${stickersHtml}
            </div>
            <script>
              const images = document.querySelectorAll('img');
              let loadedCount = 0;
              function checkAllLoaded() {
                loadedCount++;
                if (loadedCount === images.length) {
                  setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1500);
                  }, 500);
                }
              }
              if (images.length === 0) {
                setTimeout(() => { window.print(); setTimeout(() => window.close(), 1500); }, 500);
              } else {
                images.forEach(img => {
                  if (img.complete) checkAllLoaded();
                  else { img.addEventListener('load', checkAllLoaded); img.addEventListener('error', checkAllLoaded); }
                });
              }
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
    } else {
      alert('Please allow pop-ups for this site to print stickers.');
    }
  }, [generatedStickers, formData.lotNumber]);
  
  const handleSave = useCallback(() => {
    const manualStickerData = {
      lotNumber: formData.lotNumber,
      brand: formData.brand,
      style: formData.style,
      fabric: formData.fabric,
      garmentType: formData.garmentType,
      supervisor: formData.supervisor,
      packingSupervisor: formData.packingSupervisor,
      packingDate: formData.packingDate,
      totalColors: formData.totalColors,
      piecesPerSet: formData.piecesPerSet,
      numberOfStickers: formData.numberOfStickers,
      extraPercentage: formData.extraPercentage,
      totalStickers: totalStickers,
      notes: formData.notes,
      layout: selectedLayout?.id || (customMsgData ? 'customMessage' : 'simple'),
      generatedDate: new Date().toISOString(),
      generatedBy: currentUser?.username || 'manual',
      barcodeId: generateBarcodeId(formData.lotNumber, 'A'),
      customMessageData: customMsgData || null
    };
    
    onSubmit(manualStickerData);
  }, [formData, totalStickers, selectedLayout, customMsgData, currentUser, onSubmit]);
  
  return (
    <div className="manual-sticker-create">
      <div className="manual-sticker-header">
        <button onClick={handleBack} className="back-button">
          <FiArrowLeft /> Back to Dashboard
        </button>
        <h2>🏷️ Manual Sticker Creation</h2>
        <p>Create stickers manually for lots missing in the database</p>
      </div>
      
      <div className="manual-sticker-content">
        <div className="form-section">
          <div className="panel-header">
            <FiTag />
            <h3>Lot Information</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Lot Number *</label>
              <div className="input-with-button">
                <input
                  type="text"
                  name="lotNumber"
                  value={formData.lotNumber}
                  onChange={handleChange}
                  placeholder="e.g., 64003"
                />
                <button onClick={handleCheckLot} className="check-button">Check</button>
              </div>
              {existingCheck && (
                <div className={`check-message ${existingCheck.exists ? 'error' : 'info'}`}>
                  {existingCheck.message}
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="Brand name"
              />
            </div>
            
            <div className="form-group">
              <label>Style</label>
              <input
                type="text"
                name="style"
                value={formData.style}
                onChange={handleChange}
                placeholder="Style number/name"
              />
            </div>
            
            <div className="form-group">
              <label>Fabric</label>
              <input
                type="text"
                name="fabric"
                value={formData.fabric}
                onChange={handleChange}
                placeholder="Fabric type"
              />
            </div>
            
            <div className="form-group">
              <label>Garment Type</label>
              <input
                type="text"
                name="garmentType"
                value={formData.garmentType}
                onChange={handleChange}
                placeholder="e.g., T-Shirt, Hoodie"
              />
            </div>
            
            <div className="form-group">
              <label>Stitching Supervisor</label>
              <input
                type="text"
                name="supervisor"
                value={formData.supervisor}
                onChange={handleChange}
                placeholder="Supervisor name"
              />
            </div>
            
            <div className="form-group">
              <label>Packing Supervisor</label>
              <input
                type="text"
                name="packingSupervisor"
                value={formData.packingSupervisor}
                onChange={handleChange}
                placeholder="Packing supervisor name"
              />
            </div>
            
            <div className="form-group">
              <label>Packing Date</label>
              <input
                type="date"
                name="packingDate"
                value={formData.packingDate}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
        
        <div className="form-section">
          <div className="panel-header">
            <FiPackage />
            <h3>Sticker Configuration</h3>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Total Colors</label>
              <input
                type="number"
                name="totalColors"
                value={formData.totalColors}
                onChange={handleChange}
                min="1"
                step="1"
              />
            </div>
            
            <div className="form-group">
              <label>Pieces per Set (PCS/SET)</label>
              <input
                type="number"
                name="piecesPerSet"
                value={formData.piecesPerSet}
                onChange={handleChange}
                min="1"
                step="1"
              />
            </div>
            
            <div className="form-group">
              <label>Number of Stickers (Base)</label>
              <input
                type="number"
                name="numberOfStickers"
                value={formData.numberOfStickers}
                onChange={handleChange}
                min="1"
                step="1"
              />
            </div>
            
            <div className="form-group">
              <label>Extra Percentage (%)</label>
              <input
                type="number"
                name="extraPercentage"
                value={formData.extraPercentage}
                onChange={handleChange}
                min="0"
                max="100"
                step="1"
              />
              <small>+{Math.ceil(formData.numberOfStickers * (formData.extraPercentage / 100))} extra stickers</small>
            </div>
          </div>
          
          <div className="sticker-summary">
            <div className="summary-item">
              <span>Base Stickers:</span>
              <strong>{formData.numberOfStickers}</strong>
            </div>
            <div className="summary-item">
              <span>Extra Stickers:</span>
              <strong>{Math.ceil(formData.numberOfStickers * (formData.extraPercentage / 100))}</strong>
            </div>
            <div className="summary-item total">
              <span>Total Stickers:</span>
              <strong>{totalStickers}</strong>
            </div>
          </div>
          
          <div className="form-group">
            <label>Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Any additional information..."
            />
          </div>
        </div>
        
        <div className="form-actions">
          <button onClick={handleBack} className="cancel-button">
            Cancel
          </button>
          <button onClick={handleGenerateStickers} className="generate-button" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : <><FiEye /> Standard Stickers</>}
          </button>
          <button onClick={() => setShowCustomMsgConfig(true)} className="custom-msg-button">
            <FiMessageSquare /> Custom Message
          </button>
          <button onClick={handleSave} className="save-button" disabled={generatedStickers.length === 0}>
            <FiSave /> Save & Continue
          </button>
        </div>
      </div>
      
      <LayoutSelectionDialog
        isOpen={showLayoutDialog}
        onClose={() => setShowLayoutDialog(false)}
        onSelectLayout={handleLayoutSelect}
        onSelectCustomMessage={handleCustomMessageClick}
      />
      
      <CustomMessageConfigDialog
        isOpen={showCustomMsgConfig}
        onClose={() => setShowCustomMsgConfig(false)}
        onGenerate={handleGenerateCustomStickers}
        initialConfig={customMsgData}
      />
      
      {showPreviewModal && (
        <StickerPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          stickers={generatedStickers}
          stickerData={formData}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
}
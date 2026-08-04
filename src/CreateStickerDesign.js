// CreateStickerDesign.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  FiSave, FiDownload, FiPrinter, FiSettings, FiType, FiAlignLeft,
  FiAlignCenter, FiAlignRight, FiEye, FiX, FiDroplet,
  FiLayout, FiCheck, FiRefreshCw, FiImage, FiSquare, FiCircle
} from 'react-icons/fi';
import JsBarcode from 'jsbarcode';

// Styled Components for Design Studio
const DesignStudioContainer = styled.div`
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 24px;
  min-height: 600px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const DesignPanel = styled.div`
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  height: fit-content;
  position: sticky;
  top: 20px;
  
  @media (max-width: 1024px) {
    position: static;
  }
`;

const PreviewPanel = styled.div`
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const DesignSection = styled.div`
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e2e8f0;
  
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 600;
  color: #1e293b;
  font-size: 1rem;
  
  svg {
    color: #3b82f6;
  }
`;

const ColorPicker = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const ColorOption = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  background: ${props => props.color};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
    border-color: #3b82f6;
  }
`;

const InputGroup = styled.div`
  margin-bottom: 16px;
  
  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #64748b;
    margin-bottom: 6px;
  }
  
  input, select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    
    &:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }
  }
`;

const SliderGroup = styled.div`
  margin-bottom: 16px;
  
  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #64748b;
    margin-bottom: 6px;
  }
  
  input {
    width: 100%;
    margin: 8px 0;
  }
  
  .value {
    font-size: 0.85rem;
    color: #3b82f6;
    font-weight: 600;
    text-align: right;
  }
`;

const ToggleGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const ToggleButton = styled.button`
  padding: 8px 16px;
  background: ${props => props.active ? '#3b82f6' : '#f1f5f9'};
  color: ${props => props.active ? 'white' : '#64748b'};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.active ? '#2563eb' : '#e2e8f0'};
  }
`;

const StickerPreview = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  transition: all 0.3s ease;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  
  ${props => props.primary && `
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
    }
  `}
  
  ${props => props.secondary && `
    background: #f1f5f9;
    color: #1e293b;
    
    &:hover {
      background: #e2e8f0;
    }
  `}
  
  ${props => props.danger && `
    background: #fee2e2;
    color: #dc2626;
    
    &:hover {
      background: #fecaca;
    }
  `}
`;

const ShapeOption = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`;

const ShapeButton = styled.button`
  padding: 8px 16px;
  background: ${props => props.selected ? '#3b82f6' : '#f1f5f9'};
  color: ${props => props.selected ? 'white' : '#64748b'};
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  
  &:hover {
    background: ${props => props.selected ? '#2563eb' : '#e2e8f0'};
  }
`;

const TemplateSelector = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
`;

const TemplateCard = styled.div`
  padding: 12px;
  border: 2px solid ${props => props.selected ? '#3b82f6' : '#e2e8f0'};
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
  }
  
  .template-name {
    font-size: 0.85rem;
    font-weight: 500;
    margin-top: 8px;
    color: #1e293b;
  }
`;

// Default sticker designs
const STICKER_TEMPLATES = {
  standard: {
    name: 'Standard',
    shape: 'rectangle',
    backgroundColor: '#ffffff',
    borderColor: '#3b82f6',
    borderWidth: 2,
    borderRadius: 12,
    headerColor: '#1e293b',
    headerFontSize: 14,
    headerFontWeight: 'bold',
    labelColor: '#64748b',
    valueColor: '#1e293b',
    valueFontSize: 11,
    showBarcode: true,
    showUniqueId: true,
    showPartyName: true,
    showLotNumber: true,
    showPiecesPerSet: true,
    textAlign: 'left',
    barcodeHeight: 60,
    barcodeWidth: 300,
    margin: 16
  },
  modern: {
    name: 'Modern',
    shape: 'rectangle',
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderColor: '#ffffff',
    borderWidth: 0,
    borderRadius: 16,
    headerColor: '#ffffff',
    headerFontSize: 16,
    headerFontWeight: 'bold',
    labelColor: '#f0f0f0',
    valueColor: '#ffffff',
    valueFontSize: 12,
    showBarcode: true,
    showUniqueId: true,
    showPartyName: true,
    showLotNumber: true,
    showPiecesPerSet: true,
    textAlign: 'center',
    barcodeHeight: 60,
    barcodeWidth: 300,
    margin: 20
  },
  minimal: {
    name: 'Minimal',
    shape: 'rectangle',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 4,
    headerColor: '#0f172a',
    headerFontSize: 12,
    headerFontWeight: 'normal',
    labelColor: '#475569',
    valueColor: '#0f172a',
    valueFontSize: 10,
    showBarcode: true,
    showUniqueId: true,
    showPartyName: true,
    showLotNumber: true,
    showPiecesPerSet: false,
    textAlign: 'left',
    barcodeHeight: 50,
    barcodeWidth: 280,
    margin: 12
  },
  circular: {
    name: 'Circular',
    shape: 'circle',
    backgroundColor: '#ffffff',
    borderColor: '#ef4444',
    borderWidth: 3,
    borderRadius: 999,
    headerColor: '#ef4444',
    headerFontSize: 12,
    headerFontWeight: 'bold',
    labelColor: '#6b7280',
    valueColor: '#1f2937',
    valueFontSize: 10,
    showBarcode: true,
    showUniqueId: true,
    showPartyName: true,
    showLotNumber: true,
    showPiecesPerSet: true,
    textAlign: 'center',
    barcodeHeight: 50,
    barcodeWidth: 250,
    margin: 24
  }
};

const CreateStickerDesign = ({ 
  initialStickerData, 
  onSave, 
  onClose,
  onPrint,
  onDownload 
}) => {
  const [design, setDesign] = useState(() => {
    // Load saved design from localStorage or use default
    const saved = localStorage.getItem('stickerDesign');
    return saved ? JSON.parse(saved) : STICKER_TEMPLATES.standard;
  });
  
  const [stickerData, setStickerData] = useState(initialStickerData);
  const [previewBarcode, setPreviewBarcode] = useState(null);
  const barcodeCanvasRef = useRef(null);
  
  // Generate preview barcode
  useEffect(() => {
    if (stickerData && design.showBarcode && barcodeCanvasRef.current) {
      const barcodeData = `${stickerData.lotNumber}|${stickerData.partyName}|${stickerData.setRatio || 'SET'}`;
      try {
        JsBarcode(barcodeCanvasRef.current, barcodeData, {
          format: "CODE128",
          width: 1.5,
          height: design.barcodeHeight,
          displayValue: true,
          fontSize: 10,
          margin: 5
        });
        setPreviewBarcode(barcodeCanvasRef.current.toDataURL());
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [stickerData, design.showBarcode, design.barcodeHeight, stickerData?.lotNumber, stickerData?.partyName]);
  
  const updateDesign = (updates) => {
    setDesign(prev => {
      const newDesign = { ...prev, ...updates };
      localStorage.setItem('stickerDesign', JSON.stringify(newDesign));
      return newDesign;
    });
  };
  
  const applyTemplate = (templateId) => {
    const template = STICKER_TEMPLATES[templateId];
    if (template) {
      setDesign(template);
      localStorage.setItem('stickerDesign', JSON.stringify(template));
    }
  };
  
  const resetDesign = () => {
    setDesign(STICKER_TEMPLATES.standard);
    localStorage.setItem('stickerDesign', JSON.stringify(STICKER_TEMPLATES.standard));
  };
  
  const handleSaveDesign = () => {
    if (onSave) {
      onSave(design);
    }
    localStorage.setItem('stickerDesign', JSON.stringify(design));
    alert('Design saved successfully!');
  };
  
  const handlePrintSticker = () => {
    if (onPrint) {
      onPrint(design, stickerData, previewBarcode);
    }
  };
  
  const handleDownloadSticker = () => {
    if (onDownload) {
      onDownload(design, stickerData, previewBarcode);
    }
  };
  
  // Render sticker preview based on design
  const renderStickerPreview = () => {
    const getBackground = () => {
      if (design.backgroundColor && design.backgroundColor.includes('gradient')) {
        return design.backgroundColor;
      }
      return design.backgroundColor;
    };
    
    const getShapeStyles = () => {
      switch (design.shape) {
        case 'circle':
          return {
            borderRadius: '50%',
            width: '300px',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          };
        default:
          return {
            borderRadius: `${design.borderRadius}px`,
            width: '100%'
          };
      }
    };
    
    return (
      <StickerPreview
        style={{
          background: getBackground(),
          border: `${design.borderWidth}px solid ${design.borderColor}`,
          ...getShapeStyles(),
          padding: `${design.margin}px`,
          textAlign: design.textAlign
        }}
      >
        <div style={{ marginBottom: '12px', textAlign: design.textAlign }}>
          <h3 style={{
            margin: 0,
            fontSize: `${design.headerFontSize}px`,
            fontWeight: design.headerFontWeight,
            color: design.headerColor
          }}>
            BARCODE STICKER
          </h3>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          {design.showPartyName && stickerData?.partyName && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: design.labelColor, marginBottom: '2px' }}>Party Name:</div>
              <div style={{ fontSize: `${design.valueFontSize}px`, fontWeight: 600, color: design.valueColor, wordBreak: 'break-word' }}>
                {stickerData.partyName}
              </div>
            </div>
          )}
          
          {design.showLotNumber && stickerData?.lotNumber && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: design.labelColor, marginBottom: '2px' }}>Lot Number:</div>
              <div style={{ fontSize: `${design.valueFontSize}px`, fontWeight: 600, color: design.valueColor }}>
                {stickerData.lotNumber}
              </div>
            </div>
          )}
          
          {design.showPiecesPerSet && stickerData?.piecesPerSet && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: design.labelColor, marginBottom: '2px' }}>Pieces per Set:</div>
              <div style={{ fontSize: `${design.valueFontSize}px`, fontWeight: 600, color: design.valueColor }}>
                {stickerData.piecesPerSet} PCS
              </div>
            </div>
          )}
          
          {design.showUniqueId && stickerData?.uniqueId && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: design.labelColor, marginBottom: '2px' }}>Unique ID:</div>
              <div style={{ fontSize: '10px', color: design.valueColor, wordBreak: 'break-all' }}>
                {stickerData.uniqueId.slice(-12)}
              </div>
            </div>
          )}
        </div>
        
        {design.showBarcode && previewBarcode && (
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <canvas ref={barcodeCanvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
        )}
      </StickerPreview>
    );
  };
  
  return (
    <DesignStudioContainer>
      <DesignPanel>
        <SectionTitle>
          <FiSettings />
          <span>Design Settings</span>
        </SectionTitle>
        
        <DesignSection>
          <SectionTitle>
            <FiLayout />
            <span>Templates</span>
          </SectionTitle>
          <TemplateSelector>
            {Object.entries(STICKER_TEMPLATES).map(([id, template]) => (
              <TemplateCard
                key={id}
                selected={design.name === template.name}
                onClick={() => applyTemplate(id)}
              >
                <div style={{
                  width: '100%',
                  height: '60px',
                  background: template.backgroundColor,
                  border: `1px solid ${template.borderColor}`,
                  borderRadius: `${template.borderRadius}px`,
                  marginBottom: '8px'
                }} />
                <div className="template-name">{template.name}</div>
              </TemplateCard>
            ))}
          </TemplateSelector>
        </DesignSection>
        
        <DesignSection>
          <SectionTitle>
            <FiSquare />
            <span>Shape & Border</span>
          </SectionTitle>
          <ShapeOption>
            <ShapeButton
              selected={design.shape === 'rectangle'}
              onClick={() => updateDesign({ shape: 'rectangle' })}
            >
              <FiSquare /> Rectangle
            </ShapeButton>
            <ShapeButton
              selected={design.shape === 'circle'}
              onClick={() => updateDesign({ shape: 'circle' })}
            >
              <FiCircle /> Circle
            </ShapeButton>
          </ShapeOption>
          
          <InputGroup>
            <label>Border Color</label>
            <input
              type="color"
              value={design.borderColor}
              onChange={(e) => updateDesign({ borderColor: e.target.value })}
            />
          </InputGroup>
          
          <InputGroup>
            <label>Border Width (px)</label>
            <input
              type="range"
              min="0"
              max="10"
              value={design.borderWidth}
              onChange={(e) => updateDesign({ borderWidth: parseInt(e.target.value) })}
            />
            <div className="value">{design.borderWidth}px</div>
          </InputGroup>
          
          {design.shape === 'rectangle' && (
            <InputGroup>
              <label>Border Radius (px)</label>
              <input
                type="range"
                min="0"
                max="50"
                value={design.borderRadius}
                onChange={(e) => updateDesign({ borderRadius: parseInt(e.target.value) })}
              />
              <div className="value">{design.borderRadius}px</div>
            </InputGroup>
          )}
        </DesignSection>
        
        <DesignSection>
          <SectionTitle>
            <FiDroplet />
            <span>Colors</span>
          </SectionTitle>
          <InputGroup>
            <label>Background Color</label>
            <input
              type="color"
              value={design.backgroundColor && design.backgroundColor.includes('gradient') ? '#667eea' : design.backgroundColor}
              onChange={(e) => updateDesign({ backgroundColor: e.target.value })}
            />
          </InputGroup>
          
          <InputGroup>
            <label>Header Color</label>
            <input
              type="color"
              value={design.headerColor}
              onChange={(e) => updateDesign({ headerColor: e.target.value })}
            />
          </InputGroup>
          
          <InputGroup>
            <label>Label Color</label>
            <input
              type="color"
              value={design.labelColor}
              onChange={(e) => updateDesign({ labelColor: e.target.value })}
            />
          </InputGroup>
          
          <InputGroup>
            <label>Value Color</label>
            <input
              type="color"
              value={design.valueColor}
              onChange={(e) => updateDesign({ valueColor: e.target.value })}
            />
          </InputGroup>
        </DesignSection>
        
        <DesignSection>
          <SectionTitle>
            <FiType />
            <span>Typography</span>
          </SectionTitle>
          <InputGroup>
            <label>Header Font Size (px)</label>
            <input
              type="range"
              min="10"
              max="24"
              value={design.headerFontSize}
              onChange={(e) => updateDesign({ headerFontSize: parseInt(e.target.value) })}
            />
            <div className="value">{design.headerFontSize}px</div>
          </InputGroup>
          
          <ToggleGroup>
            <ToggleButton
              active={design.headerFontWeight === 'bold'}
              onClick={() => updateDesign({ headerFontWeight: 'bold' })}
            >
              <FiType /> Bold
            </ToggleButton>
            <ToggleButton
              active={design.headerFontWeight === 'normal'}
              onClick={() => updateDesign({ headerFontWeight: 'normal' })}
            >
              <FiType /> Normal
            </ToggleButton>
          </ToggleGroup>
          
          <InputGroup>
            <label>Value Font Size (px)</label>
            <input
              type="range"
              min="8"
              max="16"
              value={design.valueFontSize}
              onChange={(e) => updateDesign({ valueFontSize: parseInt(e.target.value) })}
            />
            <div className="value">{design.valueFontSize}px</div>
          </InputGroup>
          
          <ToggleGroup>
            <ToggleButton
              active={design.textAlign === 'left'}
              onClick={() => updateDesign({ textAlign: 'left' })}
            >
              <FiAlignLeft /> Left
            </ToggleButton>
            <ToggleButton
              active={design.textAlign === 'center'}
              onClick={() => updateDesign({ textAlign: 'center' })}
            >
              <FiAlignCenter /> Center
            </ToggleButton>
            <ToggleButton
              active={design.textAlign === 'right'}
              onClick={() => updateDesign({ textAlign: 'right' })}
            >
              <FiAlignRight /> Right
            </ToggleButton>
          </ToggleGroup>
        </DesignSection>
        
        <DesignSection>
          <SectionTitle>
            <FiEye />
            <span>Show/Hide Elements</span>
          </SectionTitle>
          <ToggleGroup>
            <ToggleButton
              active={design.showPartyName}
              onClick={() => updateDesign({ showPartyName: !design.showPartyName })}
            >
              Party Name
            </ToggleButton>
            <ToggleButton
              active={design.showLotNumber}
              onClick={() => updateDesign({ showLotNumber: !design.showLotNumber })}
            >
              Lot Number
            </ToggleButton>
            <ToggleButton
              active={design.showPiecesPerSet}
              onClick={() => updateDesign({ showPiecesPerSet: !design.showPiecesPerSet })}
            >
              Pieces per Set
            </ToggleButton>
            <ToggleButton
              active={design.showUniqueId}
              onClick={() => updateDesign({ showUniqueId: !design.showUniqueId })}
            >
              Unique ID
            </ToggleButton>
            <ToggleButton
              active={design.showBarcode}
              onClick={() => updateDesign({ showBarcode: !design.showBarcode })}
            >
              Barcode
            </ToggleButton>
          </ToggleGroup>
        </DesignSection>
        
        <DesignSection>
          <SectionTitle>
            <FiImage />
            <span>Barcode Settings</span>
          </SectionTitle>
          <InputGroup>
            <label>Barcode Height (px)</label>
            <input
              type="range"
              min="40"
              max="100"
              value={design.barcodeHeight}
              onChange={(e) => updateDesign({ barcodeHeight: parseInt(e.target.value) })}
            />
            <div className="value">{design.barcodeHeight}px</div>
          </InputGroup>
          
          <InputGroup>
            <label>Margin (px)</label>
            <input
              type="range"
              min="8"
              max="40"
              value={design.margin}
              onChange={(e) => updateDesign({ margin: parseInt(e.target.value) })}
            />
            <div className="value">{design.margin}px</div>
          </InputGroup>
        </DesignSection>
        
        <ActionButtons>
          <Button secondary onClick={resetDesign}>
            <FiRefreshCw /> Reset
          </Button>
          <Button primary onClick={handleSaveDesign}>
            <FiSave /> Save Design
          </Button>
        </ActionButtons>
      </DesignPanel>
      
      <PreviewPanel>
        <SectionTitle>
          <FiEye />
          <span>Live Preview</span>
        </SectionTitle>
        
        {renderStickerPreview()}
        
        <ActionButtons>
          <Button secondary onClick={onClose}>
            <FiX /> Close
          </Button>
          <Button secondary onClick={handlePrintSticker}>
            <FiPrinter /> Print Preview
          </Button>
          <Button primary onClick={handleDownloadSticker}>
            <FiDownload /> Download Sticker
          </Button>
        </ActionButtons>
      </PreviewPanel>
    </DesignStudioContainer>
  );
};

export default CreateStickerDesign;
// StickerGenerator.js
import React, { useState, useRef, useEffect } from 'react';
import './StickerGenerator.css';

function StickerGenerator({ stickerData, setStickerData, onSubmit, onBack }) {
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setStickerData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const stickerTypes = [
    { value: "shipping", label: "Shipping Label", icon: "📦" },
    { value: "warning", label: "Warning Sticker", icon: "⚠️" },
    { value: "fragile", label: "Fragile", icon: "🥚" },
    { value: "custom", label: "Custom Sticker", icon: "✨" }
  ];

  const stickerSizes = [
    { value: "small", label: "Small (3x2 inches)", dimensions: "76.2mm x 50.8mm", width: 300, height: 200 },
    { value: "medium", label: "Medium (4x3 inches)", dimensions: "101.6mm x 76.2mm", width: 400, height: 300 },
    { value: "large", label: "Large (6x4 inches)", dimensions: "152.4mm x 101.6mm", width: 600, height: 400 }
  ];

  // Initialize canvas and drawing context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = stickerSizes.find(s => s.value === stickerData.size)?.width || 400;
      canvas.height = stickerSizes.find(s => s.value === stickerData.size)?.height || 300;
      
      const ctx = canvas.getContext('2d');
      ctxRef.current = ctx;
      
      // Draw initial sticker
      drawSticker();
    }
  }, [stickerData.size, stickerData.title, stickerData.content, stickerData.type]);

  const drawSticker = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx) return;

    const size = stickerSizes.find(s => s.value === stickerData.size);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    
    // Draw cut lines (dotted border for die-cut effect)
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#999999';
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    ctx.setLineDash([]);
    
    // Draw barcode area (bottom section)
    const barcodeHeight = 80;
    const barcodeY = canvas.height - barcodeHeight - 10;
    
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(10, barcodeY, canvas.width - 20, barcodeHeight);
    
    ctx.strokeStyle = '#dddddd';
    ctx.strokeRect(10, barcodeY, canvas.width - 20, barcodeHeight);
    
    // Barcode label
    ctx.fillStyle = '#666666';
    ctx.font = '12px Arial';
    ctx.fillText('BARCODE AREA', canvas.width / 2 - 50, barcodeY + 20);
    
    // Draw placeholder barcode lines
    const lineCount = 30;
    const lineSpacing = (canvas.width - 40) / lineCount;
    for (let i = 0; i < lineCount; i++) {
      const x = 20 + (i * lineSpacing);
      const height = 40;
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, barcodeY + 30, 2, height);
    }
    
    // Draw sticker icon based on type
    const iconY = 30;
    const iconX = canvas.width / 2 - 20;
    ctx.font = '40px Arial';
    ctx.fillStyle = '#000000';
    const icon = stickerTypes.find(t => t.value === stickerData.type)?.icon || "🏷️";
    ctx.fillText(icon, iconX, iconY + 40);
    
    // Draw title
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    const title = stickerData.title || "Sticker Title";
    ctx.fillText(title, canvas.width / 2, 100);
    
    // Draw content with word wrap
    ctx.font = '14px Arial';
    ctx.fillStyle = '#666666';
    const content = stickerData.content || "Your sticker content will appear here";
    const maxWidth = canvas.width - 40;
    const lineHeight = 20;
    const words = content.split(' ');
    let lines = [];
    let currentLine = '';
    
    for (let word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    
    const contentStartY = 130;
    lines.forEach((line, index) => {
      if (contentStartY + (index * lineHeight) < barcodeY - 20) {
        ctx.fillText(line, canvas.width / 2, contentStartY + (index * lineHeight));
      }
    });
    
    // Add drawing area indicator
    if (isDrawing) {
      ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
      ctx.fillRect(10, 10, canvas.width - 20, barcodeY - 20);
      ctx.fillStyle = '#0096ff';
      ctx.font = '12px Arial';
      ctx.fillText('✏️ Drawing Mode - Click and drag to draw', canvas.width / 2 - 100, barcodeY - 5);
    }
  };

  // Drawing functions
  const startDrawing = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    ctxRef.current.lineTo(x, y);
    ctxRef.current.strokeStyle = '#000000';
    ctxRef.current.lineWidth = 2;
    ctxRef.current.stroke();
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    ctxRef.current.beginPath();
  };

  const toggleDrawingMode = () => {
    setIsDrawing(!isDrawing);
    if (!isDrawing) {
      drawSticker();
    }
  };

  const clearDrawing = () => {
    drawSticker();
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    const drawingData = canvas.toDataURL();
    setStickerData(prev => ({
      ...prev,
      drawingData: drawingData
    }));
    alert('Drawing saved to sticker!');
  };

  const getCurrentSize = () => {
    return stickerSizes.find(s => s.value === stickerData.size);
  };

  return (
    <div className="sticker-generator">
      <div className="sticker-header">
        <h2>Create Sticker</h2>
        <button className="back-btn" onClick={onBack}>← Back to Dashboard</button>
      </div>

      <form onSubmit={onSubmit} className="sticker-form">
        <div className="form-row">
          <div className="form-group">
            <label>Sticker Title *</label>
            <input
              type="text"
              name="title"
              value={stickerData.title}
              onChange={handleChange}
              placeholder="e.g., Fragile Handle with Care"
              required
            />
          </div>

          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={stickerData.quantity}
              onChange={handleChange}
              min="1"
              max="1000"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Sticker Type *</label>
          <div className="sticker-types">
            {stickerTypes.map(type => (
              <label key={type.value} className="sticker-type-option">
                <input
                  type="radio"
                  name="type"
                  value={type.value}
                  checked={stickerData.type === type.value}
                  onChange={handleChange}
                />
                <span className="type-icon">{type.icon}</span>
                <span className="type-label">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Sticker Size *</label>
          <div className="sticker-sizes">
            {stickerSizes.map(size => (
              <label key={size.value} className="sticker-size-option">
                <input
                  type="radio"
                  name="size"
                  value={size.value}
                  checked={stickerData.size === size.value}
                  onChange={handleChange}
                />
                <div className="size-info">
                  <span className="size-label">{size.label}</span>
                  <span className="size-dimensions">{size.dimensions}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Sticker Content / Message *</label>
          <textarea
            name="content"
            value={stickerData.content}
            onChange={handleChange}
            rows="3"
            placeholder="Enter the text or message for your sticker..."
            required
          />
        </div>

        {/* Drawing Canvas Section */}
        <div className="drawing-section">
          <div className="drawing-header">
            <h3>Sticker Drawing Area</h3>
            <div className="drawing-controls">
              <button 
                type="button" 
                onClick={toggleDrawingMode}
                className={`drawing-btn ${isDrawing ? 'active' : ''}`}
              >
                {isDrawing ? '✏️ Drawing Mode ON' : '✏️ Enable Drawing'}
              </button>
              {isDrawing && (
                <>
                  <button type="button" onClick={clearDrawing} className="clear-btn">
                    🧹 Clear Drawing
                  </button>
                  <button type="button" onClick={saveDrawing} className="save-drawing-btn">
                    💾 Save Drawing
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`sticker-canvas ${isDrawing ? 'drawing-enabled' : ''}`}
              style={{
                width: '100%',
                height: 'auto',
                border: '2px solid #ddd',
                borderRadius: '8px',
                cursor: isDrawing ? 'crosshair' : 'default'
              }}
            />
            {!isDrawing && (
              <div className="canvas-overlay">
                <p>Click "Enable Drawing" to draw on your sticker</p>
                <p className="barcode-note">↓ Barcode space reserved below ↓</p>
              </div>
            )}
          </div>
          
          <div className="drawing-info">
            <div className="info-box">
              <strong>📏 Sticker Size:</strong> {getCurrentSize()?.dimensions}
            </div>
            <div className="info-box">
              <strong>📊 Barcode Area:</strong> Reserved at bottom (80px height)
            </div>
            {isDrawing && (
              <div className="info-box drawing-tip">
                <strong>✏️ Drawing Tip:</strong> Click and drag on the canvas to draw
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="sticker-preview">
          <h3>Final Preview</h3>
          <div className={`preview-sticker preview-${stickerData.size}`}>
            <div className="sticker-content">
              <div className="sticker-icon">
                {stickerTypes.find(t => t.value === stickerData.type)?.icon || "🏷️"}
              </div>
              <h4>{stickerData.title || "Sticker Title"}</h4>
              <p>{stickerData.content || "Your sticker content will appear here"}</p>
              <div className="barcode-placeholder">
                <div className="barcode-lines"></div>
                <span className="barcode-label">BARCODE AREA</span>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="cancel-btn" onClick={onBack}>
            Cancel
          </button>
          <button type="submit" className="submit-btn">
            Create Sticker
          </button>
        </div>
      </form>
    </div>
  );
}

export default StickerGenerator;
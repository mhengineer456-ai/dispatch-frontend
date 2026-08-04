// src/components/PrintDialog.js
import React, { useState } from 'react';
import { FiPrinter, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import './PrintDialog.css';

const PrintDialog = ({ isOpen, onClose, totalStickers, onPrint, isPrinting }) => {
  const [printMode, setPrintMode] = useState('all'); // 'all' or 'manual'
  const [manualCount, setManualCount] = useState(1);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handlePrint = () => {
    setError('');
    
    if (printMode === 'manual') {
      if (manualCount < 1) {
        setError('Please enter at least 1 sticker');
        return;
      }
      if (manualCount > totalStickers) {
        setError(`Cannot print more than ${totalStickers} stickers`);
        return;
      }
      onPrint(manualCount);
    } else {
      onPrint(totalStickers);
    }
  };

  return (
    <div className="print-dialog-overlay" onClick={onClose}>
      <div className="print-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="print-dialog-header">
          <FiPrinter size={20} />
          <h3>Print Stickers</h3>
          <button className="print-dialog-close" onClick={onClose}>
            <FiX />
          </button>
        </div>
        
        <div className="print-dialog-body">
          <div className="print-info">
            <p>Total stickers available: <strong>{totalStickers}</strong></p>
          </div>
          
          <div className="print-mode-selector">
            <label className="print-mode-option">
              <input
                type="radio"
                value="all"
                checked={printMode === 'all'}
                onChange={() => setPrintMode('all')}
              />
              <div className="print-mode-content">
                <FiCheckCircle size={18} />
                <span>Print All Stickers</span>
                <small>{totalStickers} stickers will be printed</small>
              </div>
            </label>
            
            <label className="print-mode-option">
              <input
                type="radio"
                value="manual"
                checked={printMode === 'manual'}
                onChange={() => setPrintMode('manual')}
              />
              <div className="print-mode-content">
                <FiPrinter size={18} />
                <span>Print Specific Number</span>
                <div className="manual-input-group">
                  <input
                    type="number"
                    min="1"
                    max={totalStickers}
                    value={manualCount}
                    onChange={(e) => setManualCount(parseInt(e.target.value) || 1)}
                    disabled={printMode !== 'manual'}
                    className="manual-input"
                  />
                  <span>stickers</span>
                </div>
              </div>
            </label>
          </div>
          
          {error && (
            <div className="print-dialog-error">
              <FiAlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="print-dialog-note">
            <small>⚠️ Note: Each sticker will have the same barcode and batch ID for tracking</small>
          </div>
        </div>
        
        <div className="print-dialog-footer">
          <button className="print-dialog-cancel" onClick={onClose} disabled={isPrinting}>
            Cancel
          </button>
          <button 
            className="print-dialog-print" 
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>
                <div className="spinner-small"></div>
                Printing...
              </>
            ) : (
              <>
                <FiPrinter />
                Print {printMode === 'all' ? 'All' : `${manualCount}`} Stickers
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintDialog;
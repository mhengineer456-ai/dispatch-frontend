// src/components/StickerPrinter.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FiPrinter, FiX, FiAlertTriangle, FiCheck, FiEye, FiInfo, FiSettings } from 'react-icons/fi';
import JsBarcode from 'jsbarcode';
import './StickerPrinter.css';

// ESC/POS Commands for Thermal Roll Printer
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';
const CR = '\x0D';

// Label dimensions for thermal roll (2.4" × 1.6" = 61mm × 40.6mm)
// For 203 DPI printer: 2.4" = 487 dots, 1.6" = 325 dots
const LABEL_WIDTH_DOTS = 487;
const LABEL_HEIGHT_DOTS = 325;

// Gap between labels in dots (3mm gap = 24 dots at 203 DPI)
const LABEL_GAP_DOTS = 24;

const StickerPrinter = ({ stickerData, onClose, onPrintComplete, directPrintService }) => {
    const [printCount, setPrintCount] = useState(1);
    const [isPrinting, setIsPrinting] = useState(false);
    const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });
    const [printResult, setPrintResult] = useState(null);
    const [printerStatus, setPrinterStatus] = useState({ connected: false, ready: false, checking: true });
    const [selectedPrinter, setSelectedPrinter] = useState('SNBC TVSE LP46 Dlite BPLE');
    const [availablePrinters, setAvailablePrinters] = useState([]);
    const [labelSize, setLabelSize] = useState('61x40.6');
    const [labelGap, setLabelGap] = useState(3); // mm gap between labels
    const [printDensity, setPrintDensity] = useState(4); // 0-8, higher = darker
    const [printSpeed, setPrintSpeed] = useState(1); // 0-3, lower = slower
    
    const previewBarcodeRef = useRef(null);

    // Check printer status on mount
    useEffect(() => {
        const checkPrinter = async () => {
            try {
                const printers = await directPrintService.getAvailablePrinters?.() || [];
                setAvailablePrinters(printers);
                
                const status = await directPrintService.checkPrinter(selectedPrinter);
                setPrinterStatus({
                    connected: status.connected,
                    ready: status.ready,
                    checking: false,
                    message: status.message
                });
            } catch (error) {
                console.error('Printer check error:', error);
                setPrinterStatus({ connected: false, ready: false, checking: false, message: error.message });
            }
        };
        
        checkPrinter();
        
        // Poll printer status every 30 seconds
        const interval = setInterval(checkPrinter, 30000);
        return () => clearInterval(interval);
    }, [directPrintService, selectedPrinter]);

    // Generate preview barcode
    useEffect(() => {
        if (stickerData && previewBarcodeRef.current) {
            const barcodeData = generateBarcodeData();
            try {
                JsBarcode(previewBarcodeRef.current, barcodeData, {
                    format: "CODE128",
                    width: 1.5,
                    height: 35,
                    displayValue: true,
                    fontSize: 8,
                    margin: 2,
                    textMargin: 1
                });
            } catch (error) {
                console.error('Barcode generation error:', error);
            }
        }
    }, [stickerData]);

    const generateBarcodeData = () => {
        return `${stickerData?.lotNumber}|${stickerData?.partyName}`;
    };

    // Generate optimized ESC/POS commands for thermal roll stickers
    const generateThermalRollLabel = (sticker, stickerNumber, totalStickers) => {
        let data = '';
        
        // Initialize printer
        data += ESC + '@';
        
        // Set printer to label mode with gap detection
        data += ESC + 'x' + '\x01'; // 0x01 = label mode, 0x00 = continuous mode
        
        // Set label size with gap
        const gapDots = Math.round(labelGap * 8); // Convert mm to dots (1mm ≈ 8 dots at 203 DPI)
        
        // Set label length (including gap)
        const totalLabelHeight = LABEL_HEIGHT_DOTS + gapDots;
        data += GS + 'H' + String.fromCharCode(totalLabelHeight & 0xFF) + String.fromCharCode((totalLabelHeight >> 8) & 0xFF);
        data += GS + 'L' + String.fromCharCode(LABEL_WIDTH_DOTS & 0xFF) + String.fromCharCode((LABEL_WIDTH_DOTS >> 8) & 0xFF);
        
        // Set print speed (0=slow, 1=medium, 2=fast, 3=fastest)
        const speedValues = [0, 1, 2, 3];
        data += ESC + 'd' + String.fromCharCode(speedValues[printSpeed] || 1);
        
        // Set print density (0-8, higher = darker)
        const densityValue = Math.min(8, Math.max(0, printDensity));
        data += ESC + 'e' + String.fromCharCode(densityValue);
        
        // Set horizontal and vertical offsets (center content)
        data += GS + 'P' + '\x10' + '\x10';
        
        // Set line spacing
        data += ESC + '3' + '\x18'; // 24 dots line spacing
        
        // Set character size for header
        data += GS + '!' + '\x11'; // Double width + double height
        
        // Center alignment for everything
        data += ESC + 'a' + '\x01';
        
        // ========== STICKER CONTENT ==========
        
        // Company name
        data += 'QUALITY APPARELS' + LF;
        
        // Decorative line
        data += ESC + '-' + '\x01'; // Underline on
        data += '================' + ESC + '-' + '\x00' + LF;
        
        // Lot number - extra large
        data += GS + '!' + '\x22'; // Double width + double height
        data += `LOT: ${sticker.lotNumber || stickerData.lotNumber}` + LF;
        data += GS + '!' + '\x00'; // Reset size
        data += LF;
        
        // Party and style info (bold, left aligned)
        data += ESC + 'a' + '\x00'; // Left alignment
        data += ESC + 'E' + '\x01'; // Bold on
        
        const partyName = (sticker.partyName || stickerData.partyName || '—').substring(0, 25);
        data += `Party: ${partyName}` + LF;
        
        if (stickerData.style) {
            data += `Style: ${stickerData.style.substring(0, 20)}` + LF;
        }
        
        if (stickerData.fabric) {
            data += `Fabric: ${stickerData.fabric.substring(0, 20)}` + LF;
        }
        
        data += ESC + 'E' + '\x00'; // Bold off
        data += LF;
        
        // Set information (center aligned)
        data += ESC + 'a' + '\x01'; // Center alignment
        data += ESC + 'E' + '\x01'; // Bold on
        
        const setsText = `SETS: ${stickerData.sets || 0}`;
        const piecesText = `PCS/SET: ${stickerData.piecesPerSet || 0}`;
        const ratioText = `RATIO: ${stickerData.setRatio || 'N/A'}`;
        
        data += setsText + '  ' + piecesText + '  ' + ratioText + LF;
        data += ESC + 'E' + '\x00';
        data += LF;
        
        // Barcode section
        const barcodeData = generateBarcodeData();
        
        // Set barcode height
        data += GS + 'h' + '\x32'; // Barcode height: 50 dots
        
        // Set barcode width
        data += GS + 'w' + '\x02'; // Barcode width: 2 dots
        
        // Print CODE128 barcode
        data += GS + 'k' + '\x49'; // CODE128
        data += String.fromCharCode(barcodeData.length);
        data += barcodeData;
        data += LF;
        
        // Batch ID under barcode
        data += ESC + 'a' + '\x01'; // Center alignment
        const uniqueId = sticker.uniqueId || stickerData.uniqueId || `LOT-${stickerData.lotNumber}`;
        data += `ID: ${uniqueId.slice(-12)}` + LF;
        
        // Reset alignment
        data += ESC + 'a' + '\x00';
        
        // Add some space before cut
        data += LF;
        
        // Print and cut commands for thermal roll
        if (stickerNumber === totalStickers) {
            // After last sticker: feed, cut, and eject
            data += GS + 'V' + '\x01'; // Full cut
            data += ESC + 'd' + '\x04'; // Feed 4 lines after cut
        } else {
            // Between stickers: partial cut (for easy tearing)
            data += GS + 'V' + '\x00'; // Partial cut (notch)
        }
        
        return data;
    };

    // Simplified label for testing (plain text)
    const generateSimpleLabel = (sticker, stickerNumber, totalStickers) => {
        let data = '';
        
        data += '='.repeat(32) + '\n';
        data += 'QUALITY APPARELS\n';
        data += '='.repeat(32) + '\n';
        data += `LOT: ${sticker.lotNumber || stickerData.lotNumber}\n`;
        data += `Party: ${sticker.partyName || stickerData.partyName}\n`;
        if (stickerData.style) data += `Style: ${stickerData.style}\n`;
        data += `SETS: ${stickerData.sets || 0}\n`;
        data += `PCS/SET: ${stickerData.piecesPerSet || 0}\n`;
        data += `RATIO: ${stickerData.setRatio || 'N/A'}\n`;
        data += `BARCODE: ${generateBarcodeData()}\n`;
        data += `ID: ${(sticker.uniqueId || stickerData.uniqueId || '').slice(-12)}\n`;
        data += '='.repeat(32) + '\n';
        data += '\f'; // Form feed
        
        return data;
    };

    const handlePrint = async () => {
        if (!stickerData) {
            alert('No sticker data available');
            return;
        }

        if (printCount < 1) {
            alert('Please enter a valid count (minimum 1)');
            return;
        }

        if (!printerStatus.ready) {
            alert(`⚠️ Printer not ready!\n\nStatus: ${printerStatus.message || 'Unknown'}\n\nPlease check:\n• Printer is connected via USB\n• Printer is turned ON\n• Thermal roll has paper\n• Cover is closed properly`);
            return;
        }

        if (printCount > 500) {
            if (!window.confirm(`⚠️ You're about to print ${printCount} stickers. This will take approximately ${Math.ceil(printCount * 1.5 / 60)} minutes.\n\nMake sure the thermal roll has enough paper.\n\nContinue?`)) {
                return;
            }
        }

        setIsPrinting(true);
        setPrintProgress({ current: 0, total: printCount });
        setPrintResult(null);

        try {
            let allData = '';
            
            // Generate all labels
            for (let i = 1; i <= printCount; i++) {
                const sticker = {
                    lotNumber: stickerData.lotNumber,
                    partyName: stickerData.partyName,
                    uniqueId: stickerData.uniqueId || `LOT-${stickerData.lotNumber}-${Date.now()}`,
                    currentNumber: i,
                    totalStickers: printCount
                };
                
                // Generate label data
                const labelData = generateThermalRollLabel(sticker, i, printCount);
                allData += labelData;
                
                // Update progress
                setPrintProgress({ current: i, total: printCount });
                
                // Small delay between stickers to prevent buffer overflow
                if (i % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Send all data to printer
            const result = await directPrintService.printRawData(allData, {
                printerName: selectedPrinter,
                labelSize: labelSize,
                labelGap: labelGap,
                copies: printCount,
                printDensity: printDensity,
                printSpeed: printSpeed
            });
            
            setPrintResult({
                success: true,
                message: `✅ Successfully printed ${printCount} sticker${printCount !== 1 ? 's' : ''}!\n\nPrinter: ${selectedPrinter}\nLabel: 2.4" × 1.6" (61mm × 40.6mm)\nGap: ${labelGap}mm\nQuality: ${printDensity === 4 ? 'Standard' : printDensity > 4 ? 'Dark' : 'Light'}`,
                printed: printCount
            });

            if (onPrintComplete) {
                onPrintComplete({ success: true, printed: printCount });
            }

            // Auto close after 5 seconds on success
            setTimeout(() => {
                if (onClose) onClose();
            }, 5000);

        } catch (error) {
            console.error('Print error:', error);
            setPrintResult({
                success: false,
                message: `❌ Print failed: ${error.message}\n\nTroubleshooting:\n• Check USB connection\n• Ensure printer is ON\n• Verify thermal paper is loaded\n• Check if printer cover is closed\n• Restart print service if needed`,
                error: error.message
            });
        } finally {
            setIsPrinting(false);
        }
    };

    const handleCountChange = (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value)) value = 1;
        if (value < 1) value = 1;
        if (value > 1000) value = 1000;
        setPrintCount(value);
    };

    const handleIncrement = () => {
        setPrintCount(prev => Math.min(prev + 1, 1000));
    };

    const handleDecrement = () => {
        setPrintCount(prev => Math.max(prev - 1, 1));
    };

    const handleQuickCount = (count) => {
        setPrintCount(count);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat().format(num);
    };

    const formatTime = (stickers) => {
        const seconds = stickers * 1.5;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.ceil(seconds % 60);
        if (minutes > 0) {
            return `${minutes} min ${remainingSeconds} sec`;
        }
        return `${seconds} sec`;
    };

    return (
        <div className="sticker-printer-overlay" onClick={onClose}>
            <div className="sticker-printer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🖨️ Thermal Roll Sticker Printer</h2>
                    <button className="close-button" onClick={onClose}>
                        <FiX />
                    </button>
                </div>

                {/* Printer Status Bar */}
                {!printerStatus.checking && (
                    <div className={`printer-status-bar ${printerStatus.ready ? 'ready' : 'not-ready'}`}>
                        {printerStatus.ready ? (
                            <>
                                <FiCheck className="status-icon" />
                                <span>✅ Printer Ready: {selectedPrinter}</span>
                            </>
                        ) : (
                            <>
                                <FiAlertTriangle className="status-icon" />
                                <span>⚠️ Printer Not Ready: {printerStatus.message || 'Please check printer connection and thermal paper'}</span>
                            </>
                        )}
                    </div>
                )}

                {/* Sticker Preview Section */}
                <div className="preview-section">
                    <div className="preview-header">
                        <FiEye />
                        <h3>Thermal Roll Sticker Preview</h3>
                        <span className="preview-badge">2.4" × 1.6" (61mm × 40.6mm)</span>
                    </div>
                    
                    <div className="sticker-preview-thermal" style={{ width: '61mm', height: '40.6mm', margin: '0 auto' }}>
                        <div className="sticker-content-thermal">
                            <div className="sticker-header-thermal">
                                QUALITY APPARELS
                            </div>
                            
                            <div className="sticker-lot-thermal">
                                LOT: {stickerData?.lotNumber || 'XXXXX'}
                            </div>
                            
                            <div className="sticker-party-thermal">
                                Party: {stickerData?.partyName?.substring(0, 25) || 'Party Name'}
                            </div>
                            
                            <div className="sticker-style-thermal">
                                {stickerData?.style && `Style: ${stickerData.style.substring(0, 20)}`}
                            </div>
                            
                            <div className="sticker-barcode-thermal">
                                <canvas ref={previewBarcodeRef} className="barcode-canvas-thermal"></canvas>
                            </div>
                            
                            <div className="sticker-info-thermal">
                                <div className="info-row">
                                    <span>SETS: {stickerData?.sets || 0}</span>
                                    <span>PCS/SET: {stickerData?.piecesPerSet || 0}</span>
                                    <span>RATIO: {stickerData?.setRatio || 'N/A'}</span>
                                </div>
                            </div>
                            
                            <div className="sticker-id-thermal">
                                ID: {stickerData?.uniqueId?.slice(-12) || 'XXXXXXXXXXXX'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="barcode-info">
                        <FiInfo className="info-icon" />
                        <span>Barcode: {stickerData?.lotNumber} | {stickerData?.partyName}</span>
                    </div>
                </div>

                {/* Print Settings Section */}
                <div className="print-settings-section">
                    <div className="settings-header">
                        <FiSettings />
                        <h3>Thermal Printer Settings</h3>
                    </div>

                    {/* Printer Selection */}
                    <div className="setting-group">
                        <label className="setting-label">Printer:</label>
                        <select 
                            value={selectedPrinter} 
                            onChange={(e) => setSelectedPrinter(e.target.value)}
                            disabled={isPrinting}
                            className="setting-select"
                        >
                            <option value="SNBC TVSE LP46 Dlite BPLE">SNBC TVSE LP46 Dlite BPLE (USB003)</option>
                            {availablePrinters.map(printer => (
                                <option key={printer} value={printer}>{printer}</option>
                            ))}
                        </select>
                    </div>

                    {/* Print Quality Settings */}
                    <div className="setting-group">
                        <label className="setting-label">Print Darkness:</label>
                        <div className="quality-controls">
                            <input
                                type="range"
                                min="0"
                                max="8"
                                value={printDensity}
                                onChange={(e) => setPrintDensity(parseInt(e.target.value))}
                                disabled={isPrinting}
                                className="density-slider"
                            />
                            <span className="density-value">
                                {printDensity === 0 ? 'Light' : printDensity === 8 ? 'Dark' : 
                                 printDensity < 3 ? 'Light-Medium' : 
                                 printDensity < 6 ? 'Medium' : 'Medium-Dark'}
                            </span>
                        </div>
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">Print Speed:</label>
                        <select 
                            value={printSpeed} 
                            onChange={(e) => setPrintSpeed(parseInt(e.target.value))}
                            disabled={isPrinting}
                            className="setting-select"
                        >
                            <option value="0">Slow (Best Quality)</option>
                            <option value="1">Medium (Recommended)</option>
                            <option value="2">Fast</option>
                            <option value="3">Fastest</option>
                        </select>
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">Label Gap (mm):</label>
                        <select 
                            value={labelGap} 
                            onChange={(e) => setLabelGap(parseFloat(e.target.value))}
                            disabled={isPrinting}
                            className="setting-select"
                        >
                            <option value="2">2 mm (Small Gap)</option>
                            <option value="3">3 mm (Standard)</option>
                            <option value="4">4 mm (Large Gap)</option>
                            <option value="5">5 mm (Extra Large)</option>
                        </select>
                        <div className="setting-hint">
                            Adjust if labels are not stopping at the correct position
                        </div>
                    </div>

                    {/* Count Selector */}
                    <div className="count-selector">
                        <label className="count-label">Number of Stickers:</label>
                        <div className="count-controls">
                            <button 
                                className="count-button" 
                                onClick={handleDecrement}
                                disabled={isPrinting || printCount <= 1}
                            >
                                -
                            </button>
                            <input
                                type="number"
                                className="count-input"
                                value={printCount}
                                onChange={handleCountChange}
                                min="1"
                                max="1000"
                                disabled={isPrinting}
                            />
                            <button 
                                className="count-button" 
                                onClick={handleIncrement}
                                disabled={isPrinting || printCount >= 1000}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Quick Count Buttons */}
                    <div className="quick-count-buttons">
                        <button className="quick-btn" onClick={() => handleQuickCount(10)} disabled={isPrinting}>10</button>
                        <button className="quick-btn" onClick={() => handleQuickCount(25)} disabled={isPrinting}>25</button>
                        <button className="quick-btn" onClick={() => handleQuickCount(50)} disabled={isPrinting}>50</button>
                        <button className="quick-btn" onClick={() => handleQuickCount(100)} disabled={isPrinting}>100</button>
                        <button className="quick-btn" onClick={() => handleQuickCount(500)} disabled={isPrinting}>500</button>
                    </div>

                    {/* Print Progress */}
                    {isPrinting && (
                        <div className="print-progress">
                            <div className="progress-bar-container">
                                <div 
                                    className="progress-bar"
                                    style={{ width: `${(printProgress.current / printProgress.total) * 100}%` }}
                                ></div>
                            </div>
                            <div className="progress-text">
                                Printing {printProgress.current} of {printProgress.total} stickers...
                            </div>
                        </div>
                    )}

                    {/* Print Result */}
                    {printResult && (
                        <div className={`print-result ${printResult.success ? 'success' : 'error'}`}>
                            {printResult.success ? <FiCheck /> : <FiAlertTriangle />}
                            <div className="result-message">{printResult.message}</div>
                        </div>
                    )}

                    {/* Print Summary */}
                    <div className="print-summary">
                        <div className="summary-item">
                            <span className="summary-label">Label Size:</span>
                            <span className="summary-value">2.4" × 1.6" (61mm × 40.6mm)</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Label Gap:</span>
                            <span className="summary-value">{labelGap} mm</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Print Quality:</span>
                            <span className="summary-value">
                                {printDensity === 0 ? 'Light' : printDensity === 8 ? 'Dark' : 
                                 printDensity < 3 ? 'Light-Medium' : 
                                 printDensity < 6 ? 'Medium' : 'Medium-Dark'}
                            </span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Total to Print:</span>
                            <span className="summary-value highlight">{formatNumber(printCount)}</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Est. Time:</span>
                            <span className="summary-value">{formatTime(printCount)}</span>
                        </div>
                        <div className="summary-item">
                            <span className="summary-label">Paper Length:</span>
                            <span className="summary-value">{Math.ceil(printCount * 43.6 / 1000)} meters</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="action-buttons">
                        <button 
                            className="print-button-primary"
                            onClick={handlePrint}
                            disabled={isPrinting || !printerStatus.ready}
                        >
                            {isPrinting ? (
                                <>
                                    <div className="spinner-small"></div>
                                    Printing...
                                </>
                            ) : (
                                <>
                                    <FiPrinter />
                                    Print {formatNumber(printCount)} Sticker{printCount !== 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                        
                        <button 
                            className="print-button-secondary"
                            onClick={onClose}
                            disabled={isPrinting}
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="print-tip">
                        <FiAlertTriangle />
                        <div>
                            <strong>Thermal Roll Tips:</strong><br/>
                            • Ensure thermal paper is loaded correctly<br/>
                            • Adjust gap if labels don't stop at the right position<br/>
                            • For darker prints, increase darkness setting<br/>
                            • For faster printing, increase speed (may affect quality)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StickerPrinter;
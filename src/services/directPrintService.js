// src/services/directPrintService.js
class DirectPrintService {
    constructor() {
        this.apiUrl = 'http://localhost:3002';
        // Updated to match your actual printer name
        this.printerName = 'SNBC TVSE LP46 Dlite BPLE';
        this.printerPort = 'USB003';
        this.isServiceRunning = false;
    }

    async checkService() {
        try {
            const response = await fetch(`${this.apiUrl}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.isServiceRunning = true;
                const data = await response.json();
                return { running: true, message: data.message || 'Print service is running' };
            }
        } catch (error) {
            this.isServiceRunning = false;
            return { 
                running: false, 
                message: 'Print service not running. Please start the print service first.\n\nCommand: node server.js' 
            };
        }
        return { running: false };
    }

    async checkPrinter() {
        try {
            const response = await fetch(`${this.apiUrl}/printer/status`);
            const data = await response.json();
            
            return {
                connected: data.connected || false,
                ready: data.ready || false,
                printer: data.printer || this.printerName,
                port: data.port || this.printerPort,
                message: data.message || (data.ready ? 'Printer is ready' : 'Printer not ready')
            };
        } catch (error) {
            console.error('Printer check error:', error);
            return {
                connected: false,
                ready: false,
                error: error.message,
                message: 'Failed to check printer status'
            };
        }
    }

    // Print single sticker with count
    async printStickerWithCount(sticker, count, options = {}) {
        const serviceStatus = await this.checkService();
        if (!serviceStatus.running) {
            throw new Error(serviceStatus.message);
        }

        const printerStatus = await this.checkPrinter();
        if (!printerStatus.connected) {
            throw new Error(`Printer not detected on ${this.printerPort}`);
        }

        if (!printerStatus.ready) {
            throw new Error(`Printer is not ready. ${printerStatus.message}`);
        }

        try {
            const response = await fetch(`${this.apiUrl}/print/count`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sticker: {
                        lotNumber: sticker.lotNumber,
                        partyName: sticker.partyName,
                        setRatio: sticker.setRatio,
                        piecesPerSet: sticker.piecesPerSet,
                        uniqueId: sticker.uniqueId,
                        barcodeData: `${sticker.lotNumber}|${sticker.partyName}`
                    },
                    count: count,
                    metadata: {
                        ...options,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return {
                    success: true,
                    printed: result.printed || count,
                    printer: result.printer,
                    port: result.port,
                    duration: result.duration,
                    message: result.message || `${result.printed || count} stickers printed successfully`
                };
            } else {
                throw new Error(result.error || 'Print failed');
            }
        } catch (error) {
            console.error('Print with count error:', error);
            throw new Error(`Print failed: ${error.message}`);
        }
    }

    async printSingleSticker(sticker, options = {}) {
        return await this.printStickerWithCount(sticker, 1, options);
    }

    async printStickers(stickers, metadata) {
        const serviceStatus = await this.checkService();
        if (!serviceStatus.running) {
            throw new Error(serviceStatus.message);
        }

        const printerStatus = await this.checkPrinter();
        if (!printerStatus.connected) {
            throw new Error(`Printer not detected on ${this.printerPort}`);
        }

        if (!printerStatus.ready) {
            throw new Error(`Printer is not ready. ${printerStatus.message}`);
        }

        try {
            const response = await fetch(`${this.apiUrl}/print/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stickers: stickers.map(s => ({
                        lotNumber: s.lotNumber,
                        partyName: s.partyName,
                        setRatio: s.setRatio,
                        piecesPerSet: s.piecesPerSet,
                        uniqueId: s.uniqueId,
                        barcodeData: `${s.lotNumber}|${s.partyName}`
                    })),
                    metadata: {
                        ...metadata,
                        totalStickers: stickers.length,
                        timestamp: new Date().toISOString()
                    }
                })
            });

            const result = await response.json();
            
            if (result.success) {
                return {
                    success: true,
                    printed: result.printed || stickers.length,
                    failed: result.failed || 0,
                    printer: result.printer,
                    port: result.port,
                    duration: result.duration,
                    message: result.message || `${result.printed || stickers.length} stickers printed successfully`
                };
            } else {
                throw new Error(result.error || 'Batch print failed');
            }
        } catch (error) {
            throw new Error(`Batch print failed: ${error.message}`);
        }
    }

    async testPrint() {
        const testSticker = {
            lotNumber: 'TEST-001',
            partyName: 'Test Print - LP-46 Dlite',
            setRatio: '1:1:1',
            piecesPerSet: 3,
            uniqueId: `TEST-${Date.now()}`
        };

        return await this.printStickerWithCount(testSticker, 1, { test: true });
    }
}

export default new DirectPrintService();
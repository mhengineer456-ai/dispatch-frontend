// src/services/thermalPrintService.js

const PRINT_SERVICE_URL = 'http://localhost:3002';

class ThermalPrintService {
  constructor() {
    this.baseUrl = PRINT_SERVICE_URL;
  }

  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      return { running: true, ...data };
    } catch (error) {
      console.error('Health check failed:', error.message);
      return { running: false, message: error.message };
    }
  }

  async getPrinters() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/printers`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      return data.printers || [];
    } catch (error) {
      console.error('Failed to get printers:', error);
      return [];
    }
  }

  async printStickers(printData, onProgress) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const response = await fetch(`${this.baseUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(printData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const result = await response.json();
      
      if (onProgress && result.progress) {
        onProgress(result.progress);
      }
      
      return result;
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new ThermalPrintService();
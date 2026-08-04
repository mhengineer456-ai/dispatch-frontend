// services/pdfService.js
import jsPDF from 'jspdf';

class PDFService {
  constructor() {
    this.activeDownloads = new Map();
    this.downloadQueue = [];
    this.isProcessing = false;
    this.maxConcurrent = 1;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.memoryThreshold = 0.8; // 80% memory usage threshold
  }

  /**
   * Generate and download PDF with production-grade reliability
   */
  async generatePDF(pdfData, options = {}) {
    const {
      fileName,
      retryAttempts = this.retryAttempts,
      priority = 'normal',
      onProgress = null
    } = options;

    // Check memory before starting
    if (!this.checkAvailableMemory()) {
      await this.forceMemoryCleanup();
      if (!this.checkAvailableMemory()) {
        throw new Error('Insufficient memory available. Please close other tabs and try again.');
      }
    }

    return new Promise((resolve, reject) => {
      const downloadTask = {
        id: this.generateTaskId(),
        data: pdfData,
        fileName,
        retryAttempts,
        priority,
        onProgress,
        resolve,
        reject,
        createdAt: Date.now(),
        retryCount: 0
      };

      this.downloadQueue.push(downloadTask);
      this.sortQueue();
      this.processQueue();
    });
  }

  /**
   * Generate the actual PDF with memory-safe approach
   */
  async generatePDFDocument(pdfData) {
    const doc = new jsPDF({ 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait',
      compress: true, // Enable compression
      hotfixes: ['px_scaling'] // Fix for scaling issues
    });

    try {
      // Call the PDF building function
      await this.buildPDFContent(doc, pdfData);
      
      // Use blob method for better memory management
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      
      return { blobUrl, pdfBlob };
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    } finally {
      // Cleanup doc references
      if (doc.internal) {
        doc.internal.events = null;
        doc.internal.objects = null;
      }
    }
  }

  /**
   * Download PDF with cleanup
   */
  async downloadPDF(blobUrl, fileName) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('a');
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Download timeout - user may have blocked popups'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      };

      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      
      link.onclick = () => {
        setTimeout(() => {
          cleanup();
          resolve(true);
        }, 1000);
      };
      
      link.onerror = () => {
        cleanup();
        reject(new Error('Failed to download PDF'));
      };
      
      document.body.appendChild(link);
      link.click();
    });
  }

  /**
   * Build PDF content with chunking for large datasets
   */
  async buildPDFContent(doc, pdfData) {
    // This is a placeholder - you need to integrate your existing PDF generation logic here
    // For now, we'll call a method that should be overridden or implemented
    
    if (typeof pdfData.items === 'undefined') {
      // If pdfData has a different structure (like from draft), handle it
      return this.buildLegacyPDFContent(doc, pdfData);
    }
    
    const CHUNK_SIZE = 50;
    const items = pdfData.items || [];
    
    // Add header
    this.addPDFHeader(doc, pdfData);
    
    // Process items in chunks
    let yPos = 60; // Starting Y position after header
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      yPos = await this.processPDFChunk(doc, chunk, i, yPos);
      
      // Allow UI to breathe
      if (i + CHUNK_SIZE < items.length) {
        await this.sleep(10);
      }
    }
    
    // Add footer
    this.addPDFFooter(doc, pdfData);
  }

  /**
   * Legacy PDF content builder for draft PDFs
   */
  async buildLegacyPDFContent(doc, pdfData) {
    // This should handle the draft PDF structure
    // For now, we'll create a simple placeholder
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.text("Packing List (DRAFT)", pageWidth / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text(`Document: ${pdfData.packingNumber || pdfData.billNumber || 'N/A'}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Party: ${pdfData.partyName || 'N/A'}`, pageWidth / 2, 40, { align: "center" });
  }

  /**
   * Process PDF chunk
   */
  async processPDFChunk(doc, chunk, startIndex, startY) {
    let yPos = startY;
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i];
      const index = startIndex + i;
      
      // Check if we need a new page
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 20;
        // Re-add header on new page
        this.addPDFHeader(doc, { partyName: item.partyName }, true);
      }
      
      // Draw row
      doc.setFontSize(10);
      doc.text((index + 1).toString(), leftMargin, yPos);
      doc.text(item.lotNumber || '', leftMargin + 15, yPos);
      doc.text(item.brand || '', leftMargin + 40, yPos);
      
      // Truncate description if too long
      let description = item.description || '';
      if (description.length > 30) {
        description = description.substring(0, 27) + '...';
      }
      doc.text(description, leftMargin + 70, yPos);
      doc.text((item.sets || 0).toString(), leftMargin + 125, yPos);
      doc.text((item.setsPerPcs || 0).toString(), leftMargin + 145, yPos);
      doc.text((item.loosePcs || 0).toString(), leftMargin + 165, yPos);
      doc.text((item.quantity || 0).toString(), leftMargin + 185, yPos);
      
      yPos += 10;
      
      // Yield to event loop every 10 rows
      if (i % 10 === 0) {
        await this.sleep(1);
      }
    }
    
    return yPos;
  }

  /**
   * Add PDF header
   */
  addPDFHeader(doc, pdfData, isContinuation = false) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (!isContinuation) {
      doc.setFontSize(24);
      doc.setFont("times", "bold");
      doc.text("Packing List", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.text(pdfData.partyName || 'N/A', pageWidth / 2, 35, { align: "center" });
      
      // Draw header box
      doc.rect(15, 45, pageWidth - 30, 40);
      
      // Left side
      doc.setFontSize(10);
      doc.text(`Date: ${pdfData.billDate || new Date().toLocaleDateString()}`, 20, 55);
      doc.text(`Doc No: ${pdfData.packingNumber || 'N/A'}`, 20, 65);
      doc.text(`Generated By: ${pdfData.preparedBy || 'System'}`, 20, 75);
      
      // Right side
      const rightX = pageWidth / 2 + 10;
      doc.text(`Total Items: ${pdfData.items?.length || 0}`, rightX, 55);
      const totalQty = pdfData.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
      doc.text(`Total Quantity: ${totalQty}`, rightX, 65);
      doc.text(`Status: ${pdfData.status || 'FINAL'}`, rightX, 75);
    }
  }

  /**
   * Add PDF footer
   */
  addPDFFooter(doc, pdfData) {
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
    }
  }

  /**
   * Queue management with priority
   */
  sortQueue() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.downloadQueue.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Process download queue
   */
  async processQueue() {
    if (this.isProcessing || this.downloadQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.downloadQueue.length > 0) {
      const task = this.downloadQueue.shift();
      
      try {
        await this.executeDownload(task);
        task.resolve(true);
      } catch (error) {
        console.error(`Download failed for task ${task.id}:`, error);
        
        if (task.retryCount < task.retryAttempts) {
          // Retry with exponential backoff
          task.retryCount++;
          const delay = this.retryDelay * Math.pow(2, task.retryCount);
          await this.sleep(delay);
          
          // Re-queue for retry
          this.downloadQueue.unshift(task);
          continue;
        }
        
        task.reject(error);
      }
      
      // Force cleanup between tasks
      await this.forceMemoryCleanup();
    }
    
    this.isProcessing = false;
  }

  /**
   * Execute single download task
   */
  async executeDownload(task) {
    const { data, fileName, onProgress } = task;
    
    if (onProgress) onProgress(10, 'Generating PDF...');
    
    const { blobUrl } = await this.generatePDFDocument(data);
    
    if (onProgress) onProgress(50, 'Preparing download...');
    
    await this.downloadPDF(blobUrl, fileName);
    
    if (onProgress) onProgress(100, 'Complete!');
  }

  /**
   * Check available memory
   */
  checkAvailableMemory() {
    if (performance.memory) {
      const usedMemory = performance.memory.usedJSHeapSize;
      const totalMemory = performance.memory.jsHeapSizeLimit;
      const usageRatio = usedMemory / totalMemory;
      
      if (usageRatio > this.memoryThreshold) {
        console.warn(`High memory usage: ${(usageRatio * 100).toFixed(1)}%`);
        return false;
      }
    }
    return true;
  }

  /**
   * Force memory cleanup
   */
  async forceMemoryCleanup() {
    // Clear all blob URLs
    if (window.blobUrls) {
      window.blobUrls.forEach(url => URL.revokeObjectURL(url));
      window.blobUrls = [];
    }
    
    // Clear any pending timeouts
    const highestTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // Request garbage collection if available
    if (window.gc) {
      window.gc();
    }
    
    // Allow time for cleanup
    await this.sleep(50);
  }

  /**
   * Generate unique task ID
   */
  generateTaskId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new PDFService();
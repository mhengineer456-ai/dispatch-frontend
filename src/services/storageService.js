// services/storageService.js

// Google Apps Script URL - REPLACE WITH YOUR DEPLOYED WEB APP URL
const APPS_SCRIPT_URL = process.env.REACT_APP_BILL_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyjxBL0ujNRvpUp2NHfwfjRUZS3ryqNks5pFmS9UuSoR8fF87S_W1AnFEwMSmaoz_xk/exec";

class StorageService {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 50; // Max items in cache
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Save bill with cache invalidation
   */
  async saveBill(billData, type = 'final') {
    const saveId = this.generateSaveId();

    try {
      // Clear relevant caches before saving
      this.invalidateCache('bills');
      this.invalidateCache(`party_${billData.partyName}`);

      // Save with retry logic
      const result = await this.saveWithRetry(billData, type);

      // Clear sensitive data from memory
      this.clearTemporaryData(billData);

      return result;
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    }
  }

  /**
   * Save with retry logic
   */
  async saveWithRetry(billData, type, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const formData = new URLSearchParams();
        formData.append('payload', JSON.stringify(billData));

        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
          // Prevent caching
          cache: 'no-store',
          credentials: 'same-origin'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.success) {
          return result;
        }

        throw new Error(result.error || 'Save failed');

      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(1000 * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  /**
   * Save draft with retry logic
   */
  async saveDraft(draftData, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const encodedData = encodeURIComponent(JSON.stringify(draftData));
        const urlEncodedData = `data=${encodedData}&type=draft`;

        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: urlEncodedData,
          cache: 'no-store',
          credentials: 'same-origin'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.success) {
          return result;
        }

        throw new Error(result.error || 'Save failed');

      } catch (error) {
        if (i === retries - 1) throw error;
        await this.sleep(1000 * Math.pow(2, i));
      }
    }
  }

  /**
   * Cache management
   */
  setCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  invalidateCache(pattern) {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear temporary data
   */
  clearTemporaryData(billData) {
    // Remove large object references
    if (billData.items) {
      billData.items = billData.items.map(item => ({
        // Keep only essential fields
        id: item.id,
        lotNumber: item.lotNumber,
        quantity: item.quantity
      }));
    }
  }

  generateSaveId() {
    return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new StorageService();
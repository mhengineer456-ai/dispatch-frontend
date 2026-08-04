// config/pdf.config.js
export const PDF_CONFIG = {
  // Retry configuration
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2
  },
  
  // Memory management
  memory: {
    threshold: 0.8, // 80% memory usage threshold
    cleanupInterval: 30000, // Cleanup every 30 seconds
    maxCacheSize: 50
  },
  
  // PDF generation
  pdf: {
    chunkSize: 50, // Items per chunk
    compression: true,
    pageSize: 'a4',
    orientation: 'portrait',
    unit: 'mm'
  },
  
  // Download settings
  download: {
    timeout: 30000, // 30 seconds timeout
    maxConcurrent: 1,
    priorityLevels: ['high', 'normal', 'low']
  },
  
  // Monitoring
  monitoring: {
    enabled: true,
    logErrors: true,
    logPerformance: true
  }
};
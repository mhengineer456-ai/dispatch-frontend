// hooks/usePDFMonitoring.js
import { useEffect, useRef } from 'react';

export const usePDFMonitoring = () => {
  const startTimeRef = useRef(null);
  const metricsRef = useRef([]);

  const startGeneration = () => {
    startTimeRef.current = Date.now();
  };

  const endGeneration = (success, error = null) => {
    if (!startTimeRef.current) return;
    
    const duration = Date.now() - startTimeRef.current;
    const metric = {
      timestamp: new Date().toISOString(),
      duration,
      success,
      error: error?.message,
      memoryUsage: performance.memory?.usedJSHeapSize
    };
    
    metricsRef.current.push(metric);
    
    // Keep last 50 metrics
    if (metricsRef.current.length > 50) {
      metricsRef.current.shift();
    }
    
    // Store in localStorage for debugging
    try {
      localStorage.setItem('pdf_metrics', JSON.stringify(metricsRef.current));
    } catch (e) {
      console.warn('Could not save metrics to localStorage');
    }
    
    // Log slow generations
    if (duration > 10000) {
      console.warn(`Slow PDF generation: ${duration}ms`);
    }
    
    startTimeRef.current = null;
  };

  const getMetrics = () => {
    return metricsRef.current;
  };

  const clearMetrics = () => {
    metricsRef.current = [];
    startTimeRef.current = null;
    try {
      localStorage.removeItem('pdf_metrics');
    } catch (e) {}
  };

  return { startGeneration, endGeneration, getMetrics, clearMetrics };
};
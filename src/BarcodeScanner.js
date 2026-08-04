import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import './BarcodeScanner.css';

const BarcodeScanner = ({ onBack, onScanComplete }) => {
  const [scanMode, setScanMode] = useState('manual');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allBarcodeData, setAllBarcodeData] = useState([]);
  const [indexSheetData, setIndexSheetData] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [scanProgress, setScanProgress] = useState('');
  const [activeTab, setActiveTab] = useState('scan');
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    productionDetails: true,
    sizeColorBreakdown: false,
    cuttingPackingInfo: false,
    qualityTimeline: false,
    indexDetails: false
  });

  const html5QrCodeRef = useRef(null);
  const scannerContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // GOOGLE SHEETS CREDENTIALS
  const GOOGLE_SHEET_CONFIG = {
    apiKey: process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
    sheetId: process.env.REACT_APP_PRODUCT_SHEET_ID || '1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8',
    range: 'LotBarcodeData'
  };

  // Index Sheet Configuration
  const INDEX_SHEET_CONFIG = {
    apiKey: process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
    sheetId: process.env.REACT_APP_INDEX_SHEET_ID || '1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA',
    range: 'Index'
  };

  // Show toast notification
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // Fetch Index Sheet Data
  const fetchIndexSheetData = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${INDEX_SHEET_CONFIG.sheetId}/values/${INDEX_SHEET_CONFIG.range}?key=${INDEX_SHEET_CONFIG.apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);

        const formattedData = rows.map(row => {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = row[index] || '';
          });
          return record;
        });

        setIndexSheetData(formattedData);
        console.log('Loaded Index sheet data:', formattedData.length, 'records');
        return formattedData;
      } else {
        console.log('No data from Index API');
        setIndexSheetData([]);
        return [];
      }
    } catch (err) {
      console.error('Error fetching Index sheet data:', err);
      setError('Failed to load index sheet data');
      setIndexSheetData([]);
      return [];
    }
  };

  // Fetch data from Google Sheets
  const fetchGoogleSheetData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch both sheets in parallel
      const [barcodeResponse, indexResponse] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_CONFIG.sheetId}/values/${GOOGLE_SHEET_CONFIG.range}?key=${GOOGLE_SHEET_CONFIG.apiKey}`),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${INDEX_SHEET_CONFIG.sheetId}/values/${INDEX_SHEET_CONFIG.range}?key=${INDEX_SHEET_CONFIG.apiKey}`)
      ]);

      const barcodeData = await barcodeResponse.json();
      const indexData = await indexResponse.json();

      // Process Barcode Data
      if (barcodeData.values && barcodeData.values.length > 0) {
        const headers = barcodeData.values[0];
        const rows = barcodeData.values.slice(1);

        const formattedData = rows.map(row => {
          const record = {};
          headers.forEach((header, index) => {
            let value = row[index] || '';

            if (header === 'Colors' || header === 'Sizes') {
              try {
                value = JSON.parse(value);
              } catch (e) {
                value = value ? [value] : [];
              }
            }
            if (header === 'Size Quantities' || header === 'Color Details' || header === 'Cutting Tables') {
              try {
                value = JSON.parse(value);
              } catch (e) {
                value = {};
              }
            }

            record[header] = value;
          });
          return record;
        });

        setAllBarcodeData(formattedData);
        showToast(`Loaded ${formattedData.length} records from database`, 'success');
        console.log('Loaded barcode data:', formattedData.length, 'records');
      } else {
        console.log('No data from API');
        setAllBarcodeData([]);
        showToast('No data found in the database', 'error');
      }

      // Process Index Data
      if (indexData.values && indexData.values.length > 0) {
        const headers = indexData.values[0];
        const rows = indexData.values.slice(1);

        const formattedIndexData = rows.map(row => {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = row[index] || '';
          });
          return record;
        });

        setIndexSheetData(formattedIndexData);
        console.log('Loaded Index sheet data:', formattedIndexData.length, 'records');
      } else {
        console.log('No Index data from API');
        setIndexSheetData([]);
      }

    } catch (err) {
      console.error('Error fetching Google Sheet data:', err);
      setError('Failed to load data from Google Sheets. Please check your connection and try again.');
      setAllBarcodeData([]);
      setIndexSheetData([]);
      showToast('Failed to load data from database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Get Index data for a specific lot number
  const getIndexDataByLotNumber = (lotNumber) => {
    if (!lotNumber) return null;

    // Search in index sheet data
    const foundIndexData = indexSheetData.find(item =>
      item['Lot Number']?.toString().trim() === lotNumber.toString().trim()
    );

    return foundIndexData;
  };

  // Stop the real barcode scanner
  const stopRealBarcodeScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.log('Error stopping scanner:', err);
      }
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Initialize ZXing reader with ALL barcode formats
  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.AZTEC,
      BarcodeFormat.CODABAR,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.CODE_128,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.EAN_8,
      BarcodeFormat.EAN_13,
      BarcodeFormat.ITF,
      BarcodeFormat.MAXICODE,
      BarcodeFormat.PDF_417,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.RSS_14,
      BarcodeFormat.RSS_EXPANDED,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.UPC_EAN_EXTENSION
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8');

    zxingReaderRef.current = new BrowserMultiFormatReader(hints);

    fetchGoogleSheetData();

    return () => {
      if (html5QrCodeRef.current && isScanning) {
        stopRealBarcodeScanner();
      }
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Search for barcode in loaded data
  const searchBarcode = (barcodeId) => {
    if (!barcodeId || barcodeId.trim() === '') {
      showToast('Please enter a valid barcode', 'error');
      return;
    }

    setIsLoading(true);
    setError(null);

    const cleanBarcode = barcodeId.trim();

    const foundData = allBarcodeData.find(item => {
      const barcodeIdField = item['Barcode ID']?.toString().trim();
      const lotNumberField = item['Lot Number']?.toString().trim();

      return barcodeIdField === cleanBarcode ||
        lotNumberField === cleanBarcode ||
        barcodeIdField?.includes(cleanBarcode) ||
        lotNumberField?.includes(cleanBarcode);
    });

    setTimeout(() => {
      setIsLoading(false);

      if (foundData) {
        showToast(`Found: ${foundData['Lot Number'] || foundData['Barcode ID']}`, 'success');
        processScannedBarcode(foundData);
      } else {
        showToast(`Barcode "${cleanBarcode}" not found in system`, 'error');
        const notFoundResult = {
          barcode: cleanBarcode,
          timestamp: new Date().toISOString(),
          type: 'unknown',
          data: null,
          status: 'not_found'
        };
        setScannedResult(notFoundResult);

        if (onScanComplete) {
          onScanComplete(notFoundResult);
        }
      }
    }, 100);
  };

  // Real-time camera scanner
  const startRealBarcodeScanner = async () => {
    if (!scannerContainerRef.current) {
      console.error('Scanner container not found');
      showToast('Scanner container not ready', 'error');
      return;
    }

    if (html5QrCodeRef.current) {
      await stopRealBarcodeScanner();
    }

    setIsScanning(true);
    setError(null);

    try {
      if (scannerContainerRef.current) {
        scannerContainerRef.current.innerHTML = '';
      }

      html5QrCodeRef.current = new Html5Qrcode("barcode-scanner-container");

      const config = {
        fps: 30,
        qrbox: { width: 300, height: 200 },
        aspectRatio: 1.0,
        disableFlip: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.PDF_417,
          Html5QrcodeSupportedFormats.AZTEC
        ]
      };

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          console.log('Real barcode detected:', decodedText);

          if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(200);
          }

          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.1;
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
            oscillator.stop(audioContext.currentTime + 0.3);
          } catch (e) {
            // Audio not supported
          }

          stopRealBarcodeScanner();
          searchBarcode(decodedText);
        },
        (errorMessage) => {
          if (!errorMessage.includes('NotFoundException') && !errorMessage.includes('NoMultiFormatReaders')) {
            console.log('Scan error:', errorMessage);
          }
        }
      );

      showToast('Scanner started. Point camera at barcode.', 'success');
      console.log('Real barcode scanner started successfully');

    } catch (err) {
      console.error("Error starting real barcode scanner:", err);
      showToast('Unable to access camera. Please check permissions.', 'error');
      try {
        await startFallbackScanner();
      } catch (fallbackErr) {
        showToast('Camera access failed. Please use manual entry or upload.', 'error');
        setScanMode('manual');
        setIsScanning(false);
      }
    }
  };

  // Fallback scanner using ZXing with canvas
  const startFallbackScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        const scanFrame = async () => {
          if (!isScanning || !videoRef.current || videoRef.current.paused) return;

          if (canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;

            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            try {
              const result = await zxingReaderRef.current.decodeFromCanvas(canvas);
              if (result && result.getText()) {
                console.log('ZXing detected barcode:', result.getText());
                stream.getTracks().forEach(track => track.stop());
                setIsScanning(false);
                searchBarcode(result.getText());
                return;
              }
            } catch (err) {
              // No barcode found
            }
          }

          requestAnimationFrame(scanFrame);
        };

        scanFrame();
      }
    } catch (err) {
      console.error('Fallback scanner failed:', err);
      throw err;
    }
  };

  // Scan with ZXing
  const scanWithZXing = async (imageElement, attempts = 3) => {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const result = await zxingReaderRef.current.decodeFromImageElement(imageElement);
        if (result && result.getText()) {
          console.log('ZXing detected barcode:', result.getText());
          return result.getText();
        }
      } catch (err) {
        console.log(`ZXing scan attempt ${attempt + 1} failed:`, err);
        if (attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    return null;
  };

  // Image preprocessing
  const preprocessImageForBarcode = (imgElement) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let width = imgElement.width;
      let height = imgElement.height;
      const maxDimension = 1280;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const versions = [];

      ctx.drawImage(imgElement, 0, 0, width, height);
      versions.push(canvas.toDataURL('image/jpeg', 1.0));

      ctx.drawImage(imgElement, 0, 0, width, height);
      const imgData1 = ctx.getImageData(0, 0, width, height);
      const data1 = imgData1.data;
      for (let i = 0; i < data1.length; i += 4) {
        const brightness = (data1[i] + data1[i + 1] + data1[i + 2]) / 3;
        data1[i] = brightness;
        data1[i + 1] = brightness;
        data1[i + 2] = brightness;
      }
      ctx.putImageData(imgData1, 0, 0);
      versions.push(canvas.toDataURL('image/jpeg', 0.9));

      ctx.drawImage(imgElement, 0, 0, width, height);
      const imgData2 = ctx.getImageData(0, 0, width, height);
      const data2 = imgData2.data;
      for (let i = 0; i < data2.length; i += 4) {
        const brightness = (data2[i] + data2[i + 1] + data2[i + 2]) / 3;
        let enhanced = brightness > 128 ? 255 : 0;
        data2[i] = enhanced;
        data2[i + 1] = enhanced;
        data2[i + 2] = enhanced;
      }
      ctx.putImageData(imgData2, 0, 0);
      versions.push(canvas.toDataURL('image/jpeg', 0.9));

      ctx.drawImage(imgElement, 0, 0, width, height);
      const imgData3 = ctx.getImageData(0, 0, width, height);
      const data3 = imgData3.data;
      for (let i = 0; i < data3.length; i += 4) {
        if (i > width * 4 && i < data3.length - width * 4) {
          const current = (data3[i] + data3[i + 1] + data3[i + 2]) / 3;
          const left = (data3[i - 4] + data3[i - 3] + data3[i - 2]) / 3;
          const right = (data3[i + 4] + data3[i + 5] + data3[i + 6]) / 3;
          const sharpened = current * 1.5 - (left + right) * 0.25;
          const val = Math.min(255, Math.max(0, sharpened));
          data3[i] = val;
          data3[i + 1] = val;
          data3[i + 2] = val;
        }
      }
      ctx.putImageData(imgData3, 0, 0);
      versions.push(canvas.toDataURL('image/jpeg', 0.9));

      ctx.drawImage(imgElement, 0, 0, width, height);
      const imgData4 = ctx.getImageData(0, 0, width, height);
      const data4 = imgData4.data;
      for (let i = 0; i < data4.length; i += 4) {
        data4[i] = 255 - data4[i];
        data4[i + 1] = 255 - data4[i + 1];
        data4[i + 2] = 255 - data4[i + 2];
      }
      ctx.putImageData(imgData4, 0, 0);
      versions.push(canvas.toDataURL('image/jpeg', 0.9));

      resolve(versions);
    });
  };

  // Extract image regions
  const extractImageRegions = async (imgElement) => {
    const regions = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = imgElement.width;
    const height = imgElement.height;

    const regionDefinitions = [
      { x: width * 0.25, y: height * 0.25, w: width * 0.5, h: height * 0.5 },
      { x: 0, y: 0, w: width * 0.5, h: height * 0.5 },
      { x: width * 0.5, y: 0, w: width * 0.5, h: height * 0.5 },
      { x: 0, y: height * 0.5, w: width * 0.5, h: height * 0.5 },
      { x: width * 0.5, y: height * 0.5, w: width * 0.5, h: height * 0.5 }
    ];

    for (const region of regionDefinitions) {
      canvas.width = region.w;
      canvas.height = region.h;
      ctx.drawImage(imgElement, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);

      const img = new Image();
      img.src = canvas.toDataURL('image/jpeg', 1.0);
      await new Promise((resolve) => { img.onload = resolve; });
      regions.push(img);
    }

    return regions;
  };

  // Detect barcode from image
  const detectBarcodeFromImage = async (imageUrl) => {
    setScanProgress('Attempting direct barcode detection...');
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    let barcode = await scanWithZXing(img, 3);
    if (barcode) return barcode;

    setScanProgress('Enhancing image for better detection...');
    const processedVersions = await preprocessImageForBarcode(img);

    for (let i = 0; i < processedVersions.length; i++) {
      setScanProgress(`Trying detection method ${i + 1} of ${processedVersions.length}...`);
      const processedImg = new Image();
      processedImg.src = processedVersions[i];
      await new Promise((resolve) => { processedImg.onload = resolve; });

      barcode = await scanWithZXing(processedImg, 2);
      if (barcode) return barcode;

      await new Promise(resolve => setTimeout(resolve, 150));
    }

    setScanProgress('Trying alternative detection method...');
    const tempScanner = new Html5Qrcode("temp-scanner-final");
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'barcode.jpg', { type: 'image/jpeg' });
      const result = await tempScanner.scanFile(file, false);
      if (result && result.decodedText) {
        await tempScanner.clear();
        return result.decodedText;
      }
    } catch (err) {
      console.log('Html5Qrcode fallback failed:', err);
    }
    await tempScanner.clear();

    setScanProgress('Analyzing different image regions...');
    const regions = await extractImageRegions(img);
    for (const region of regions) {
      barcode = await scanWithZXing(region, 1);
      if (barcode) return barcode;
    }

    return null;
  };

  // Scan image file
  const scanImageFile = async (file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image file (JPEG, PNG, WEBP, BMP, or TIFF)', 'error');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showToast('File size too large. Please upload an image less than 15MB.', 'error');
      return;
    }

    setIsProcessingImage(true);
    setScanProgress('Preparing image for scanning...');
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const detectedBarcode = await detectBarcodeFromImage(previewUrl);

      if (detectedBarcode) {
        console.log('Barcode successfully detected:', detectedBarcode);
        setScanProgress('Barcode detected! Searching database...');

        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(100);
        }

        showToast(`Barcode detected: ${detectedBarcode}`, 'success');
        searchBarcode(detectedBarcode);
      } else {
        setScanProgress('');
        showToast('No barcode could be detected in this image. Please try a clearer image.', 'error');
      }

    } catch (err) {
      console.error('Error processing image:', err);
      showToast('Error processing image. Please try with a different image.', 'error');
    } finally {
      setIsProcessingImage(false);
      setScanProgress('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle image upload
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      scanImageFile(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      scanImageFile(file);
    } else {
      showToast('Please drop an image file', 'error');
    }
  };

  // Handle manual barcode input
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      searchBarcode(barcodeInput.trim());
      setBarcodeInput('');
    }
  };

  // Process scanned barcode
  const processScannedBarcode = (data) => {
    const lotNumber = data['Lot Number'];
    const indexData = getIndexDataByLotNumber(lotNumber);

    const scanResult = {
      barcode: data['Barcode ID'] || data['Lot Number'],
      lotNumber: lotNumber,
      timestamp: new Date().toISOString(),
      type: 'barcode',
      data: data,
      indexData: indexData,
      status: data['Status'] || 'unknown'
    };

    setScannedResult(scanResult);

    const updatedHistory = [scanResult, ...scanHistory].slice(0, 20);
    setScanHistory(updatedHistory);
    localStorage.setItem('barcodeScanHistory', JSON.stringify(updatedHistory));

    if (onScanComplete) {
      onScanComplete(scanResult);
    }

    if (isScanning) {
      stopRealBarcodeScanner();
    }
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Format currency/numbers
  const formatNumber = (num) => {
    if (!num) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Update status
  const updateStatus = async (barcodeId, newStatus) => {
    setScannedResult({
      ...scannedResult,
      data: {
        ...scannedResult.data,
        'Status': newStatus,
        ...(newStatus === 'Completed' && { 'Completed Date': new Date().toLocaleString() })
      },
      status: newStatus
    });

    showToast(`Status updated to ${newStatus}`, 'success');
  };

  const clearScanResult = () => {
    setScannedResult(null);
  };

  const clearHistory = () => {
    if (window.confirm('Clear all scan history?')) {
      setScanHistory([]);
      localStorage.setItem('barcodeScanHistory', '[]');
      showToast('Scan history cleared', 'info');
    }
  };

  // Calculate statistics
  const getStatistics = () => {
    const totalLots = allBarcodeData.length;
    const completedLots = allBarcodeData.filter(d => d['Status'] === 'Completed').length;
    const inProgressLots = allBarcodeData.filter(d => d['Status'] === 'In Progress').length;
    const printedLots = allBarcodeData.filter(d => d['Status'] === 'Printed').length;
    const totalUnits = allBarcodeData.reduce((sum, d) => sum + (parseInt(d['Total Pieces']) || 0), 0);

    return { totalLots, completedLots, inProgressLots, printedLots, totalUnits };
  };

  const stats = getStatistics();

  return (
    <div className="scanner-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🏭</div>
            <div className="logo-text">
              <h1>TrackMaster Pro</h1>
              <span>Production Tracking System</span>
            </div>
          </div>
          <button className="close-btn" onClick={onBack}>
            <span>✕</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="nav-tabs">
        <button
          className={`tab ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
        >
          <span className="tab-icon">📷</span>
          <span>Scan Barcode</span>
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📜</span>
          <span>Scan History</span>
          {scanHistory.length > 0 && <span className="tab-badge">{scanHistory.length}</span>}
        </button>
        <button
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <span className="tab-icon">📊</span>
          <span>Statistics</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="main-container">
        {/* Scan Tab */}
        {activeTab === 'scan' && (
          <div className="scan-tab">
            {/* Mode Selector */}
            <div className="mode-selector">
              <button
                className={`mode-option ${scanMode === 'manual' ? 'active' : ''}`}
                onClick={() => {
                  setScanMode('manual');
                  if (isScanning) stopRealBarcodeScanner();
                }}
              >
                <span className="mode-option-icon">⌨️</span>
                <div className="mode-option-text">
                  <strong>Manual Entry</strong>
                  <small>Type barcode manually</small>
                </div>
              </button>
              <button
                className={`mode-option ${scanMode === 'camera' ? 'active' : ''}`}
                onClick={() => {
                  setScanMode('camera');
                  if (!isScanning) startRealBarcodeScanner();
                }}
              >
                <span className="mode-option-icon">📷</span>
                <div className="mode-option-text">
                  <strong>Camera Scan</strong>
                  <small>Real-time barcode scanner</small>
                </div>
              </button>
              <button
                className={`mode-option ${scanMode === 'upload' ? 'active' : ''}`}
                onClick={() => {
                  setScanMode('upload');
                  if (isScanning) stopRealBarcodeScanner();
                }}
              >
                <span className="mode-option-icon">📤</span>
                <div className="mode-option-text">
                  <strong>Upload Image</strong>
                  <small>Scan from gallery</small>
                </div>
              </button>
            </div>

            {/* Manual Entry */}
            {scanMode === 'manual' && (
              <div className="manual-entry">
                <div className="search-container">
                  <form onSubmit={handleManualSubmit}>
                    <input
                      type="text"
                      placeholder="Enter Barcode ID or Lot Number..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" disabled={!barcodeInput.trim()}>
                      Search
                    </button>
                  </form>
                  <p className="search-hint">💡 Search by Barcode ID or Lot Number</p>
                </div>
              </div>
            )}

            {/* Camera Scanner */}
            {scanMode === 'camera' && (
              <div className="camera-scanner">
                <div className="scanner-wrapper">
                  <div
                    id="barcode-scanner-container"
                    ref={scannerContainerRef}
                    className="scanner-container"
                  ></div>
                  {!isScanning && (
                    <div className="scanner-placeholder">
                      <div className="placeholder-content">
                        <div className="placeholder-icon">📷</div>
                        <h3>Ready to Scan</h3>
                        <p>Click the button below to start the camera</p>
                        <button className="start-scanner-btn" onClick={startRealBarcodeScanner}>
                          Start Camera Scanner
                        </button>
                      </div>
                    </div>
                  )}
                  {isScanning && (
                    <>
                      <div className="scan-overlay">
                        <div className="scan-frame"></div>
                        <div className="scan-line"></div>
                      </div>
                      <button className="stop-scanner-btn" onClick={stopRealBarcodeScanner}>
                        Stop Scanning
                      </button>
                    </>
                  )}
                </div>
                <div className="scanner-tips">
                  <div className="tip">🎯 Center barcode in frame</div>
                  <div className="tip">📱 Hold steady for 1-2 seconds</div>
                  <div className="tip">✨ Supports all barcode types</div>
                </div>
              </div>
            )}

            {/* Image Upload */}
            {scanMode === 'upload' && (
              <div className="upload-section">
                <div
                  className="upload-area"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/bmp,image/tiff"
                    style={{ display: 'none' }}
                  />
                  <div className="upload-icon">📸</div>
                  <h3>Upload Barcode Image</h3>
                  <p>Click or drag & drop an image here</p>
                  <span className="upload-hint">Supports JPEG, PNG, WEBP, BMP (Max 15MB)</span>
                </div>

                {imagePreview && !isProcessingImage && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Uploaded barcode" />
                    <button
                      className="remove-image"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {isProcessingImage && (
                  <div className="processing-indicator">
                    <div className="spinner"></div>
                    <p>{scanProgress || 'Processing image...'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Results Section */}
            {scannedResult && (
              <div className="results-container">
                <div className="results-header">
                  <h2>Production Details</h2>
                  <button className="close-results" onClick={clearScanResult}>✕</button>
                </div>

                {scannedResult.status === 'not_found' ? (
                  <div className="not-found">
                    <div className="not-found-icon">🔍</div>
                    <h3>No Results Found</h3>
                    <p>No record matching <strong>{scannedResult.barcode}</strong></p>
                  </div>
                ) : (
                  <div className="results-grid">
                    {/* Basic Info */}
                    <div className="result-card">
                      <div className="card-header" onClick={() => toggleSection('basicInfo')}>
                        <div className="card-title">
                          <span className="card-icon">📄</span>
                          <h3>Basic Information</h3>
                        </div>
                        <span className="toggle-icon">{expandedSections.basicInfo ? '−' : '+'}</span>
                      </div>
                      {expandedSections.basicInfo && (
                        <div className="card-body">
                          <div className="info-row">
                            <span className="label">Barcode ID</span>
                            <span className="value highlight">{scannedResult.data['Barcode ID']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Lot Number</span>
                            <span className="value">{scannedResult.data['Lot Number']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Party Name</span>
                            <span className="value">{scannedResult.data['Party Name']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Status</span>
                            <span className={`status-badge ${scannedResult.status?.toLowerCase()}`}>
                              {scannedResult.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Production Details */}
                    <div className="result-card">
                      <div className="card-header" onClick={() => toggleSection('productionDetails')}>
                        <div className="card-title">
                          <span className="card-icon">🏭</span>
                          <h3>Production Details</h3>
                        </div>
                        <span className="toggle-icon">{expandedSections.productionDetails ? '−' : '+'}</span>
                      </div>
                      {expandedSections.productionDetails && (
                        <div className="card-body">
                          <div className="info-row">
                            <span className="label">Style</span>
                            <span className="value">{scannedResult.data['Style']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Fabric</span>
                            <span className="value">{scannedResult.data['Fabric']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Garment Type</span>
                            <span className="value">{scannedResult.data['Garment Type']}</span>
                          </div>
                          <div className="info-row">
                            <span className="label">Total Pieces</span>
                            <span className="value total">{formatNumber(scannedResult.data['Total Pieces'])}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Index Details */}
                    {scannedResult.indexData && (
                      <div className="result-card full-width">
                        <div className="card-header" onClick={() => toggleSection('indexDetails')}>
                          <div className="card-title">
                            <span className="card-icon">📊</span>
                            <h3>Index Sheet Details</h3>
                          </div>
                          <span className="toggle-icon">{expandedSections.indexDetails ? '−' : '+'}</span>
                        </div>
                        {expandedSections.indexDetails && (
                          <div className="card-body">
                            <div className="info-grid">
                              <div className="info-row">
                                <span className="label">Brand</span>
                                <span className="value">{scannedResult.indexData['BRAND'] || 'N/A'}</span>
                              </div>
                              <div className="info-row">
                                <span className="label">Season</span>
                                <span className="value">{scannedResult.indexData['SEASON'] || 'N/A'}</span>
                              </div>
                              <div className="info-row">
                                <span className="label">Supervisor</span>
                                <span className="value">{scannedResult.indexData['Supervisor'] || 'N/A'}</span>
                              </div>
                              <div className="info-row">
                                <span className="label">Date of Issue</span>
                                <span className="value">{formatDate(scannedResult.indexData['Date of Issue'])}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-tab">
            <div className="history-header">
              <h2>Scan History</h2>
              {scanHistory.length > 0 && (
                <button className="clear-all-btn" onClick={clearHistory}>
                  Clear All
                </button>
              )}
            </div>
            {scanHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>No Scan History</h3>
                <p>Your scanned barcodes will appear here</p>
              </div>
            ) : (
              <div className="history-list">
                {scanHistory.map((scan, index) => (
                  <div key={index} className="history-item" onClick={() => {
                    setScannedResult(scan);
                    setActiveTab('scan');
                  }}>
                    <div className="history-item-info">
                      <div className="history-barcode">{scan.barcode}</div>
                      <div className="history-lot">{scan.lotNumber}</div>
                      <div className="history-time">{formatDate(scan.timestamp)}</div>
                    </div>
                    <div className={`history-status ${scan.status?.toLowerCase()}`}>
                      {scan.status || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="stats-tab">
            <h2>Production Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalLots}</div>
                <div className="stat-label">Total Lots</div>
              </div>
              <div className="stat-card success">
                <div className="stat-value">{stats.completedLots}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card warning">
                <div className="stat-value">{stats.inProgressLots}</div>
                <div className="stat-label">In Progress</div>
              </div>
              <div className="stat-card info">
                <div className="stat-value">{stats.printedLots}</div>
                <div className="stat-label">Printed</div>
              </div>
              <div className="stat-card primary full-width">
                <div className="stat-value">{formatNumber(stats.totalUnits)}</div>
                <div className="stat-label">Total Units</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading data...</p>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="error-alert">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
          </div>
          <button onClick={fetchGoogleSheetData} className="retry-btn">Retry</button>
        </div>
      )}

      {/* Hidden elements for scanners */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div id="temp-scanner-final" style={{ display: 'none' }}></div>
    </div>
  );
};

export default BarcodeScanner;
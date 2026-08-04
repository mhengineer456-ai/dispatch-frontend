import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import './BarcodeGenerator.css';
import {
  FiSearch, FiRefreshCw, FiAlertTriangle, FiPackage, FiTag, FiGrid, FiArrowLeft, FiInfo, FiUser, FiCalendar, FiPercent, FiPrinter, FiDownload, FiEye, FiX, FiChevronLeft, FiChevronRight, FiSettings, FiCheck, FiStar, FiDatabase, FiSave, FiLayers
} from 'react-icons/fi';
import JsBarcode from 'jsbarcode';
import CreateStickerDesign from './CreateStickerDesign';
import SetsManager from './SetsManager';
import PrintDialog from './PrintDialog';
import {
  SimpleBlackWhiteSticker,
  DetailedSticker,
  CompactSticker,
  ColorCodedSticker,
  LayoutSelectionDialog,
  StickerPreviewModal
} from './StickerLayouts';

// ============================
// Environment Variables for Security
// ============================
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const SHEET_ID = process.env.REACT_APP_INDEX_SHEET_ID || "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
const ISSUES_SHEET_ID = process.env.REACT_APP_ISSUES_SHEET_ID || "1uo14nKO_yHu4AJ2rOgaJajuprcinj6xw1AUMFJ6_zYM";
const ISSUES_TAB = "Issues";
const BARCODE_SHEET_ID = process.env.REACT_APP_PRODUCT_SHEET_ID || "1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8";
const BARCODE_TAB = "LotBarcodeData";
const BACKEND_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
const BACKEND_ENDPOINT_URL = `${BACKEND_BASE_URL}/exec`;
const BARCODE_STORAGE_SCRIPT_URL = BACKEND_ENDPOINT_URL;

const MAX_RANGE = 'A1:Z';

// Bartender Sticker Dimensions
const STICKER_WIDTH_MM = 61;
const STICKER_HEIGHT_MM = 40.6;
const STICKER_WIDTH_PX = 230;
const STICKER_HEIGHT_PX = 154;

// Helpers
const norm = (v) => (v ?? '').toString().trim();
const includes = (hay, needle) => norm(hay).toLowerCase().includes(norm(needle).toLowerCase());

function uniqCaseInsensitive(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr ?? []) {
    const k = String(s ?? "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
function generateVerificationCode(lotNumber) {
  const cleanLot = String(lotNumber).replace(/[^0-9]/g, '');
  let sum = 0;
  for (let i = 0; i < cleanLot.length; i++) {
    sum += parseInt(cleanLot[i]);
  }
  return (sum % 97).toString().padStart(2, '0');
}

function titleCase(str) {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function printableDate(isoDate) {
  if (!isoDate) return '';

  let dateObj;

  if (isoDate.includes('/')) {
    const dateTimeParts = isoDate.split(' ');
    if (dateTimeParts.length > 0) {
      const datePart = dateTimeParts[0];
      const [month, day, year] = datePart.split('/').map(Number);
      dateObj = new Date(year, month - 1, day);
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) {
    dateObj = new Date(isoDate);
  }

  if (isNaN(dateObj.getTime())) return String(isoDate || '');

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}/${month}/${year}`;
}

function digitsOnly(s) {
  const m = String(s ?? '').match(/\d+/g);
  return m ? m.join('') : '';
}

function getInitialsWithRole(name, roleSuffix) {
  if (!name || name === '—') return '';

  let cleanName = name.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (roleSuffix === 'S') {
    cleanName = cleanName.replace(/stitching/gi, '').replace(/sewing/gi, '').trim();
  } else if (roleSuffix === 'P') {
    cleanName = cleanName.replace(/packing/gi, '').trim();
  }

  let initial = cleanName.charAt(0).toUpperCase();

  if (!/[A-Z]/i.test(initial) && cleanName.length > 0) {
    const match = cleanName.match(/[A-Z]/i);
    if (match) initial = match[0].toUpperCase();
  }

  return initial ? `${initial}${roleSuffix}` : roleSuffix;
}

// Generate barcode ID in format LOT-XXXXX
// Generate barcode ID with letter suffix for all groups (A, B, C, etc.)
function generateBarcodeId(lotNumber, groupLetter) {
  const cleanLot = lotNumber.replace(/[^A-Za-z0-9]/g, '');

  // Always add letter suffix (A, B, C, etc.)
  if (groupLetter && groupLetter !== 'MAIN') {
    return `LOT-${cleanLot}${groupLetter}`;
  }

  // First group gets 'A'
  return `LOT-${cleanLot}A`;
}
// ============================
// ENHANCED CACHE SYSTEM
// ============================
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100;
    this.ttl = 5 * 60 * 1000;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

class IndexCache {
  constructor() {
    this.indexMap = null;
    this.lastUpdated = null;
    this.ttl = 30 * 60 * 1000;
  }

  isValid() {
    return this.indexMap && this.lastUpdated && (Date.now() - this.lastUpdated) < this.ttl;
  }

  get(lotNumber) {
    if (!this.isValid()) return null;
    return this.indexMap.get(norm(lotNumber)) || null;
  }

  set(indexMap) {
    this.indexMap = indexMap;
    this.lastUpdated = Date.now();
  }

  clear() {
    this.indexMap = null;
    this.lastUpdated = null;
  }
}

const sheetDataCache = new ApiCache();
const lotMatrixCache = new ApiCache();
const issuesCache = new ApiCache();
const indexCache = new IndexCache();

function generateSheetCacheKey(sheetId, range) {
  return `sheet_${sheetId}_${range}`;
}

function generateLotMatrixCacheKey(lotNo) {
  return `lot_matrix_${norm(lotNo)}`;
}

function generateIssuesCacheKey(lotNo) {
  return `issues_${norm(lotNo)}`;
}

// ============================
// CACHED API FUNCTIONS
// ============================
async function fetchSheetDataCached(sheetId, rawRange, signal) {
  const range = decodeURIComponent(rawRange);
  const cacheKey = generateSheetCacheKey(sheetId, range);

  const cached = sheetDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const backendUrl = `${BACKEND_BASE_URL}/api/sheet-data?sheetId=${encodeURIComponent(sheetId)}&range=${encodeURIComponent(range)}`;
  const res = await fetch(backendUrl, { signal });

  if (!res.ok) {
    throw new Error(`Failed to fetch sheet data from Express Backend: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.values || data?.rows || [];

  sheetDataCache.set(cacheKey, result);

  return result;
}

// ============================
// INDEX FETCHING WITH SUPERVISOR
// ============================
async function loadIndexMap(signal) {
  if (indexCache.isValid()) {
    return indexCache.indexMap;
  }

  const range = encodeURIComponent('Index!A1:Z');
  const rows = await fetchSheetDataCached(SHEET_ID, range, signal);

  if (!rows || rows.length < 2) {
    throw new Error('Index sheet is empty or not found');
  }

  const headers = rows[0].map(norm);

  const lotNumberCol = headers.findIndex(h => includes(h, 'lot number'));
  const startRowCol = headers.findIndex(h => includes(h, 'startrow'));
  const numRowsCol = headers.findIndex(h => includes(h, 'numrows'));
  const headerColsCol = headers.findIndex(h => includes(h, 'headercols'));
  const brandCol = headers.findIndex(h => includes(h, 'brand'));
  const styleCol = headers.findIndex(h => includes(h, 'style'));
  const fabricCol = headers.findIndex(h => includes(h, 'fabric'));
  const garmentTypeCol = headers.findIndex(h => includes(h, 'garment type'));
  const supervisorCol = headers.findIndex(h => includes(h, 'supervisor'));

  if (lotNumberCol === -1) {
    throw new Error('Index sheet must have a "Lot Number" column');
  }

  const indexMap = new Map();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const lotNumber = norm(row[lotNumberCol]);

    if (lotNumber) {
      indexMap.set(lotNumber, {
        lotNumber,
        startRow: startRowCol !== -1 ? parseInt(row[startRowCol]) || 1 : 1,
        numRows: numRowsCol !== -1 ? parseInt(row[numRowsCol]) || 20 : 20,
        headerCols: headerColsCol !== -1 ? parseInt(row[headerColsCol]) || 7 : 7,
        brand: brandCol !== -1 ? norm(row[brandCol]) : '',
        style: styleCol !== -1 ? norm(row[styleCol]) : '',
        fabric: fabricCol !== -1 ? norm(row[fabricCol]) : '',
        garmentType: garmentTypeCol !== -1 ? norm(row[garmentTypeCol]) : '',
        supervisor: supervisorCol !== -1 ? norm(row[supervisorCol]) : ''
      });
    }
  }

  indexCache.set(indexMap);
  return indexMap;
}

async function getLotIndex(lotNumber, signal) {
  const indexMap = await loadIndexMap(signal);
  return indexMap.get(norm(lotNumber)) || null;
}

// ============================
// CUTTING SHEET FETCHING
// ============================
function getColumnLetter(colNumber) {
  let letter = '';
  while (colNumber > 0) {
    const remainder = (colNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colNumber = Math.floor((colNumber - 1) / 26);
  }
  return letter;
}

async function fetchCuttingSection(lotIndex, signal) {
  const { startRow, numRows, headerCols } = lotIndex;
  const endRow = startRow + numRows - 1;
  const lastColumn = getColumnLetter(Math.min(headerCols || 7, 26));

  const range = `Cutting!A${startRow}:${lastColumn}${endRow}`;

  console.log(`📊 Fetching Cutting rows ${startRow}-${endRow} (${numRows} rows, cols A-${lastColumn})`);

  const rows = await fetchSheetDataCached(SHEET_ID, range, signal);

  if (!rows || rows.length === 0) {
    throw new Error(`Failed to fetch Cutting data for rows ${startRow}-${endRow}`);
  }

  return rows;
}

// ============================
// BARCODE STORAGE FUNCTIONS WITH VERSION SUPPORT
// ============================

async function checkLotExistsForConfiguration(lotNumber, configFingerprint) {
  try {
    const url = `${BARCODE_STORAGE_SCRIPT_URL}?action=getLotDataByConfig&lotNumber=${encodeURIComponent(lotNumber)}&config=${encodeURIComponent(configFingerprint)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('🔍 [CHECK] Error checking configuration:', error);
    return { success: false, exists: false };
  }
}

async function getAllLotVersions(lotNumber) {
  try {
    const url = `${BARCODE_STORAGE_SCRIPT_URL}?action=getAllLotVersions&lotNumber=${encodeURIComponent(lotNumber)}`;
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('🔍 [VERSIONS] Error getting versions:', error);
    return { success: false, versions: [] };
  }
}
async function saveLotToBarcodeStorage(lotData) {
  const backendUrl = `${BACKEND_ENDPOINT_URL}?action=saveLotData`;

  try {
    console.log('📤 [SAVE] Saving lot data via Express Backend Server:', lotData.lotNumber);

    const formData = new URLSearchParams();
    formData.append('action', 'saveLotData');
    formData.append('data', JSON.stringify(lotData));

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [SAVE] Saved via Express Backend Server:', result);
      return result;
    } else {
      throw new Error(`Server returned HTTP ${response.status}`);
    }
  } catch (backendErr) {
    console.error('📤 [SAVE] Error saving lot data via Backend Server:', backendErr);
    return { success: false, error: backendErr.message };
  }
}

async function checkLotExists(lotNumber) {
  try {
    const url = `${BARCODE_STORAGE_SCRIPT_URL}?action=getLotData&lotNumber=${encodeURIComponent(lotNumber)}`;
    const response = await fetch(url);
    const result = await response.json();

    if (result.success && result.data?.exists) {
      // Return full data including barcodeId
      return {
        success: true,
        exists: true,
        data: {
          exists: true,
          lotNumber: result.data.lotNumber,
          barcodeId: result.data.barcodeId,
          generatedDate: result.data.generatedDate,
          totalStickers: result.data.totalStickers,
          version: result.data.version
        }
      };
    }

    // Also check the Google Sheet directly as fallback
    return await fetchBarcodeFromSheet(lotNumber);

  } catch (error) {
    console.error('🔍 [CHECK] Error checking lot:', error);
    return await fetchBarcodeFromSheet(lotNumber);
  }
}
async function fetchBarcodeFromSheet(lotNumber) {
  try {
    const range = `${BARCODE_TAB}!A:AF`;
    const backendUrl = `${BACKEND_BASE_URL}/api/sheet-data?sheetId=${encodeURIComponent(BARCODE_SHEET_ID)}&range=${encodeURIComponent(range)}`;
    const response = await fetch(backendUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch barcode sheet: ${response.status}`);
    }

    const data = await response.json();
    const rows = data?.values || data?.rows || [];

    if (rows.length < 2) {
      return { success: true, exists: false, data: null };
    }

    const headers = rows[0].map(h => norm(h).toLowerCase());
    const lotNumberCol = headers.findIndex(h => h.includes('lot number') || h === 'lot number');
    const barcodeIdCol = headers.findIndex(h => h.includes('barcode id') || h === 'barcodeid');
    const generatedDateCol = headers.findIndex(h => h.includes('generated date') || h === 'generateddate');
    const totalStickersCol = headers.findIndex(h => h.includes('total stickers') || h === 'totalstickers');

    const searchLot = norm(lotNumber);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const rowLotNumber = lotNumberCol !== -1 ? norm(row[lotNumberCol]) : '';

      if (rowLotNumber === searchLot) {
        return {
          success: true,
          exists: true,
          data: {
            exists: true,
            lotNumber: rowLotNumber,
            barcodeId: barcodeIdCol !== -1 ? row[barcodeIdCol] : null,
            generatedDate: generatedDateCol !== -1 ? row[generatedDateCol] : null,
            totalStickers: totalStickersCol !== -1 ? row[totalStickersCol] : null
          }
        };
      }
    }

    return { success: true, exists: false, data: null };

  } catch (error) {
    console.error('📊 [SHEET] Error fetching from sheet:', error);
    return { success: false, exists: false, error: error.message };
  }
}

async function updateLotPrintStatus(lotNumber) {
  try {
    const formData = new URLSearchParams();
    formData.append('action', 'updatePrintStatus');
    formData.append('data', JSON.stringify({ lotNumber }));

    const response = await fetch(BARCODE_STORAGE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    return await response.json();
  } catch (error) {
    console.error('📝 [UPDATE] Error updating print status:', error);
    return { success: false, error: error.message };
  }
}
// Add this component near the Lot Information section
const ExistingBarcodeWarning = ({ existingBarcode, lotNumber }) => {
  return null;
};

const testAppsScript = async () => {
  try {
    const formData = new URLSearchParams();
    formData.append('action', 'test');
    formData.append('data', JSON.stringify({ test: true, timestamp: new Date().toISOString() }));

    const response = await fetch(BARCODE_STORAGE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      alert('✅ Apps Script is working!\n\nResponse: ' + JSON.stringify(result, null, 2));
    } else {
      alert('⚠️ Apps Script returned error:\n\n' + result.message);
    }
    return result;
  } catch (error) {
    console.error('🧪 [TEST] Test error:', error);
    alert('❌ Cannot connect to Apps Script:\n\n' + error.message);
    return { success: false, error: error.message };
  }
};

// ============================
// ISSUES SHEET FETCHER WITH BRAND & PACKING SUPERVISOR
// ============================
async function fetchPackingInfo(lotNo, signal) {
  const range = encodeURIComponent(`${ISSUES_TAB}!A1:Z`);

  try {
    const rows = await fetchSheetDataCached(ISSUES_SHEET_ID, range, signal);

    if (!rows || rows.length < 2) {
      console.log('No rows found in Issues sheet');
      return null;
    }

    const headers = rows[0].map(norm);
    console.log('Issues sheet headers:', headers);

    const lotNumberCol = headers.findIndex(h =>
      includes(h, 'lot number') || includes(h, 'lot no') || includes(h, 'lot')
    );
    const packingSupervisorCol = headers.findIndex(h =>
      includes(h, 'packing supervisor') || includes(h, 'packing') || includes(h, 'supervisor')
    );
    const packingDateCol = headers.findIndex(h =>
      includes(h, 'packing date') || includes(h, 'date')
    );
    const totalPcsCol = headers.findIndex(h =>
      includes(h, 'total pcs') || includes(h, 'total')
    );
    const brandCol = headers.findIndex(h =>
      includes(h, 'brand') || includes(h, 'brand name')
    );

    console.log('Column indexes:', {
      lotNumberCol,
      packingSupervisorCol,
      packingDateCol,
      totalPcsCol,
      brandCol
    });

    if (lotNumberCol === -1) {
      console.log('Lot number column not found');
      return null;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const rowLotNo = norm(row[lotNumberCol]);

      if (rowLotNo === norm(lotNo)) {
        const packingInfo = {
          lotNumber: rowLotNo,
          packingSupervisor: packingSupervisorCol !== -1 ? norm(row[packingSupervisorCol]) : null,
          packingDate: packingDateCol !== -1 ? printableDate(row[packingDateCol]) : null,
          totalPcs: totalPcsCol !== -1 ? parseInt(row[totalPcsCol]) || 0 : null,
          brand: brandCol !== -1 ? norm(row[brandCol]) : null
        };
        console.log('Found packing info:', packingInfo);
        return packingInfo;
      }
    }

    console.log(`Lot ${lotNo} not found in Issues sheet`);
    return null;

  } catch (error) {
    console.error('Error fetching packing info:', error);
    return null;
  }
}

// ============================
// LOT MATRIX FETCHER
// ============================
async function fetchLotMatrixViaSheetsApi(lotNo, signal) {
  const cacheKey = generateLotMatrixCacheKey(lotNo);

  const cached = lotMatrixCache.get(cacheKey);
  if (cached) {
    console.log('📦 Using cached matrix data for:', lotNo);
    return cached;
  }

  const searchKey = digitsOnly(lotNo);

  console.log('🔍 Looking up lot in Index:', searchKey);
  const lotIndex = await getLotIndex(searchKey, signal);

  let result;

  if (lotIndex) {
    console.log('✅ Found in Index! Fetching rows', lotIndex.startRow, 'to', lotIndex.startRow + lotIndex.numRows - 1);
    const cuttingSection = await fetchCuttingSection(lotIndex, signal);
    result = parseMatrixWithIndexInfo(cuttingSection, lotIndex);

    if (result && result.rows && result.rows.length > 0) {
      result.source = 'cutting';
      result.brand = lotIndex.brand || '';
      result.style = lotIndex.style || result.style;
      result.fabric = lotIndex.fabric || result.fabric;
      result.garmentType = lotIndex.garmentType || result.garmentType;
      result.supervisor = lotIndex.supervisor || '';
    } else {
      throw new Error(`Failed to parse matrix data for lot ${searchKey}`);
    }
  } else {
    console.warn('Lot not found in Index, falling back to full search:', searchKey);
    try {
      result = await searchInCuttingSheet(searchKey, signal);
      result.source = 'cutting';
    } catch (err) {
      console.warn('Cutting fallback failed:', err?.message);
      throw new Error(`Lot ${searchKey} not found in Index or Cutting sheet`);
    }
  }

  if (!result || !result.rows || result.rows.length === 0) {
    throw new Error(`No data found for lot ${lotNo}`);
  }

  lotMatrixCache.set(cacheKey, result);

  return result;
}

function parseMatrixWithIndexInfo(rows, lotIndex) {
  let lotNumber = lotIndex.lotNumber;
  let style = lotIndex.style || '';
  let fabric = lotIndex.fabric || '';
  let garmentType = lotIndex.garmentType || '';
  let brand = lotIndex.brand || '';
  let supervisor = lotIndex.supervisor || '';
  const headerCols = lotIndex.headerCols || 7;

  let headerIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || [];
    const hasColor = r.some(c => includes(c, 'color'));
    const hasCT = r.some(c => includes(c, 'cutting table') || includes(c, 'table'));
    if ((hasColor && hasCT)) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i] || [];
      const textCols = r.filter(c => typeof c === 'string' && c.trim().length > 2);
      const numberCols = r.filter(c => !isNaN(parseFloat(c)) && isFinite(c));
      if (textCols.length >= 2 && numberCols.length >= 2) { headerIdx = i; break; }
    }
  }

  if (headerIdx === -1) {
    return null;
  }

  const header = rows[headerIdx].map(norm);

  let idxColor = header.findIndex(c => includes(c, 'color'));
  let idxCT = header.findIndex(c => includes(c, 'cutting table') || includes(c, 'table'));

  if (idxColor === -1) {
    for (let i = 0; i < header.length; i++) {
      if (header[i] && typeof header[i] === 'string' && header[i].length > 2) { idxColor = i; break; }
    }
  }
  if (idxCT === -1) {
    for (let i = (idxColor !== -1 ? idxColor + 1 : 0); i < header.length; i++) {
      if (header[i] && (includes(header[i], 'table') || includes(header[i], 'ct'))) { idxCT = i; break; }
    }
  }

  const sizeCols = [];
  const startIdx = idxCT !== -1 ? idxCT + 1 : idxColor !== -1 ? idxColor + 1 : 0;
  const endIdx = Math.min(header.length, headerCols);

  for (let i = startIdx; i < endIdx; i++) {
    const colName = norm(header[i]);
    if (colName && !includes(colName, 'total') && !includes(colName, 'alter')) {
      sizeCols.push({ key: colName, index: i });
    } else if (!colName) {
      sizeCols.push({ key: `Size${i - startIdx + 1}`, index: i });
    }
  }

  if (sizeCols.length === 0) {
    for (let i = startIdx; i < endIdx; i++) {
      for (let j = headerIdx + 1; j < Math.min(headerIdx + 5, rows.length); j++) {
        const cellValue = rows[j]?.[i];
        if (cellValue && !isNaN(parseFloat(cellValue)) && isFinite(cellValue)) {
          const colName = norm(header[i]) || `Size${i - startIdx + 1}`;
          sizeCols.push({ key: colName, index: i });
          break;
        }
      }
    }
  }

  const sizeKeys = sizeCols.map(s => s.key);
  const body = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const color = idxColor !== -1 && row[idxColor] !== undefined ? norm(row[idxColor]) : '';
    if (!color) { if (body.length > 0) break; continue; }
    if (includes(color, 'total')) break;

    const cuttingTable = idxCT !== -1 && row[idxCT] !== undefined ? toNumOrNull(row[idxCT]) : null;
    const sizeMap = {};
    let rowTotal = 0;
    let hasData = false;

    for (const s of sizeCols) {
      const qty = row[s.index] !== undefined ? toNumOrNull(row[s.index]) : null;
      sizeMap[s.key] = qty;
      if (qty !== null) { rowTotal += qty; hasData = true; }
    }

    if (hasData) {
      body.push({ color, cuttingTable, sizes: sizeMap, totalPcs: rowTotal });
    }
  }

  body.sort((a, b) => a.color.localeCompare(b.color));

  if (body.length === 0) return null;

  const totals = { perSize: {}, grand: 0 };
  for (const k of sizeKeys) totals.perSize[k] = 0;
  for (const row of body) {
    for (const k of sizeKeys) totals.perSize[k] += row.sizes[k] ?? 0;
    totals.grand += row.totalPcs ?? 0;
  }

  return {
    lotNumber,
    style,
    fabric,
    garmentType,
    brand,
    supervisor,
    sizes: sizeKeys,
    rows: body,
    totals
  };
}

async function searchInCuttingSheet(lotNo, signal) {
  const range = encodeURIComponent('Cutting!A1:Z');
  const rows = await fetchSheetDataCached(SHEET_ID, range, signal);

  const section = sliceSectionForLot(rows, lotNo);

  if (section?.length) {
    const parsed = parseMatrix(section, lotNo);
    if (parsed && parsed.rows.length) {
      return parsed;
    }
  }

  throw new Error('Lot not found in Cutting sheet');
}

function sliceSectionForLot(values, lotNo) {
  const rows = values;
  let start = -1;

  for (let i = 0; i < Math.min(rows.length, 200); i++) {
    const line = (rows[i] || []).join(' ');
    if (includes(line, 'cutting matrix') && includes(line, `lot ${lotNo}`)) { start = i; break; }
  }
  if (start === -1) {
    for (let i = 0; i < Math.min(rows.length, 200); i++) {
      const r = rows[i] || [];
      if (includes(r[0], 'lot number') && norm(r[1]) === norm(lotNo)) { start = Math.max(0, i - 1); break; }
    }
  }
  if (start === -1) return null;
  return rows.slice(start, Math.min(start + 80, rows.length));
}

function toNumOrNull(v) {
  const t = norm(v);
  if (t === '') return null;
  const n = parseFloat(t.replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseMatrix(rows, lotNo) {
  let lotNumber = norm(lotNo);
  let style = '';
  let fabric = '';
  let garmentType = '';
  let brand = '';
  let supervisor = '';

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] || [];
    if (includes(r[0], 'lot number')) {
      if (r[1]) lotNumber = norm(r[1]);
      const idxStyle = r.findIndex((c) => includes(c, 'style'));
      if (idxStyle !== -1 && r[idxStyle + 1]) style = norm(r[idxStyle + 1]);
    }
    if (includes(r[0], 'fabric')) {
      if (r[1]) fabric = norm(r[1]);
      const idxGT = r.findIndex((c) => includes(c, 'garment type'));
      if (idxGT !== -1 && r[idxGT + 1]) garmentType = norm(r[idxGT + 1]);
    }
    if (includes(r[0], 'brand')) {
      if (r[1]) brand = norm(r[1]);
    }
  }

  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const hasColor = r.some((c) => includes(c, 'color'));
    const hasCT = r.some((c) => includes(c, 'cutting table'));
    if (hasColor && hasCT) { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    return { lotNumber, style, fabric, garmentType, brand, supervisor, sizes: [], rows: [], totals: { perSize: {}, grand: 0 } };
  }

  const header = rows[headerIdx].map(norm);
  const idxColor = header.findIndex((c) => includes(c, 'color'));
  const idxCT = header.findIndex((c) => includes(c, 'cutting table'));

  const sizeCols = [];
  for (let i = idxCT + 1; i < header.length; i++) {
    if (norm(header[i])) sizeCols.push({ key: header[i], index: i });
  }
  const sizeKeys = sizeCols.map((s) => s.key);

  const body = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const first = norm(row[idxColor]);
    if (!first) { if (body.length) break; continue; }
    if (includes(first, 'total')) break;

    const color = first;
    const cuttingTable = toNumOrNull(row[idxCT]);
    const sizeMap = {};
    let rowTotal = 0;
    for (const s of sizeCols) {
      const qty = toNumOrNull(row[s.index]);
      sizeMap[s.key] = qty;
      rowTotal += (qty ?? 0);
    }
    body.push({ color, cuttingTable, sizes: sizeMap, totalPcs: rowTotal });
  }

  body.sort((a, b) => a.color.localeCompare(b.color));

  const totals = { perSize: {}, grand: 0 };
  for (const k of sizeKeys) totals.perSize[k] = 0;
  for (const row of body) {
    for (const k of sizeKeys) totals.perSize[k] += row.sizes[k] ?? 0;
    totals.grand += row.totalPcs ?? 0;
  }

  return { lotNumber, style, fabric, garmentType, brand, supervisor, sizes: sizeKeys, rows: body, totals };
}

// ============================
// SETS CALCULATION FUNCTIONS
// ============================
function calculateSetsAndStickers(totalsPerSize) {
  if (!totalsPerSize || Object.keys(totalsPerSize).length === 0) {
    return { sets: 0, stickers: 0, setRatio: null, piecesPerSet: 0, sizeQuantities: [] };
  }

  const sizeQuantities = Object.values(totalsPerSize).map(qty => qty || 0);

  if (sizeQuantities.length === 0 || sizeQuantities.every(q => q === 0)) {
    return { sets: 0, stickers: 0, setRatio: null, piecesPerSet: 0, sizeQuantities };
  }

  const validQuantities = sizeQuantities.filter(q => q > 0);
  if (validQuantities.length === 0) {
    return { sets: 0, stickers: 0, setRatio: null, piecesPerSet: 0, sizeQuantities };
  }

  const sets = Math.min(...validQuantities);

  if (sets === 0) {
    return { sets: 0, stickers: 0, setRatio: null, piecesPerSet: 0, sizeQuantities };
  }

  const ratio = sizeQuantities.map(q => q / sets);
  const ratioSimplified = ratio.map(r => Math.round(r * 10) / 10);

  const ratioString = ratioSimplified.map(r => r.toString()).join(':');
  const piecesPerSet = ratioSimplified.reduce((sum, val) => sum + val, 0);
  const stickers = sets;

  return {
    sets,
    stickers,
    setRatio: ratioString,
    piecesPerSet,
    sizeQuantities
  };
}

function adjustStickersByPercentage(stickers, percentage) {
  if (!stickers || stickers === 0) return 0;
  const validPercentage = Math.min(Math.max(0, percentage), 100);
  const multiplier = 1 + (validPercentage / 100);
  return Math.ceil(stickers * multiplier);
}

// ============================
// STICKER GENERATOR WITH VERSION SUPPORT
// ============================
// ============================
// STICKER GENERATOR WITH CLEAR, SCANNABLE BARCODES
// ============================
// ============================
// IMPROVED STICKER GENERATOR WITH HIGH-QUALITY, SCANNABLE BARCODES
// ============================
class StickerGenerator {
  static generateBatchId(lotNumber, groupSuffix = null) {
    const cleanLot = lotNumber.replace(/[^A-Za-z0-9]/g, '');
    if (groupSuffix) {
      const pcsValue = groupSuffix.match(/\d+/)?.[0] || '';
      return `LOT${cleanLot}${pcsValue}`;
    }
    return `LOT${cleanLot}`;
  }

  static async renderBarcode(canvas, data, width = 300, height = 80) {
    return new Promise((resolve) => {
      try {
        // Set canvas to higher resolution for better print quality
        const ctx = canvas.getContext('2d');

        // Use higher resolution canvas (2x for retina/print)
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(scale, scale);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // PROFESSIONAL BARCODE SETTINGS - Optimized for printing
        JsBarcode(canvas, data, {
          format: "CODE128",
          width: 3,              // Wider bars for better scanning (increased from 2)
          height: 50,           // Taller barcode for easier scanning
          displayValue: false,
          fontSize: 14,         // Larger, readable text
          margin: 8,            // More margin around barcode
          textMargin: 4,
          font: "monospace",
          textAlign: "center",
          lineColor: "#000000",
          background: "#ffffff",
          flat: true,           // Flat rendering for crisp lines
          valid: function (valid) {
            if (!valid) console.warn('Invalid barcode data:', data);
          }
        });

        // Ensure the barcode renders properly
        setTimeout(() => resolve(), 150);
      } catch (error) {
        console.error('Barcode render error:', error);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(data, 20, 40);
        resolve();
      }
    });
  }

  // Generate barcode as high-quality data URL
  static async generateHighQualityBarcode(data, width = 300, height = 80) {
    const canvas = document.createElement('canvas');
    await this.renderBarcode(canvas, data, width, height);
    return canvas.toDataURL('image/png', 1.0);
  }
}

// ============================
// VERSION HISTORY COMPONENT
// ============================
const VersionHistory = ({ lotNumber, onVersionSelect }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const loadVersions = useCallback(async () => {
    if (!lotNumber) return;
    setLoading(true);
    const result = await getAllLotVersions(lotNumber);
    if (result.success && result.data?.versions) {
      setVersions(result.data.versions);
    }
    setLoading(false);
  }, [lotNumber]);

  useEffect(() => {
    if (showVersions && lotNumber) {
      loadVersions();
    }
  }, [showVersions, lotNumber, loadVersions]);

  if (!lotNumber) return null;

  return (
    <div className="version-history" style={{ marginTop: '16px' }}>
      <button
        onClick={() => setShowVersions(!showVersions)}
        className="base-btn ghost-btn"
        style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }}
      >
        <FiLayers style={{ marginRight: '4px' }} />
        {showVersions ? 'Hide' : 'Show'} Existing Versions ({versions.length})
      </button>

      {showVersions && (
        <div style={{ marginTop: '8px', fontSize: '12px', maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center' }}>Loading versions...</div>
          ) : versions.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No existing versions found</div>
          ) : (
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Barcode ID</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Stickers</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>PCS/Set</th>
                  <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => onVersionSelect?.(v)}>
                    <td style={{ padding: '8px', fontFamily: 'monospace', fontSize: '10px' }}>
                      {v.barcodeId || v.version}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{v.totalStickers}</td>
                    <td style={{ padding: '8px' }}>{v.piecesPerSet || '-'}</td>
                    <td style={{ padding: '8px', fontSize: '10px' }}>{v.generatedDate ? new Date(v.generatedDate).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ============================
// MAIN REACT COMPONENT
// ============================
export default function BarcodeGenerator() {
  const [lotInput, setLotInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [matrix, setMatrix] = useState(null);
  const [packingInfo, setPackingInfo] = useState(null);
  const [error, setError] = useState('');
  const [stickerPercentage, setStickerPercentage] = useState(1);
  const [selectedStickerType, setSelectedStickerType] = useState('standard');
  const [showStickerPreview, setShowStickerPreview] = useState(false);
  const [generatedStickers, setGeneratedStickers] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isGeneratingStickers, setIsGeneratingStickers] = useState(false);
  const [showDesignStudio, setShowDesignStudio] = useState(false);
  const [currentStickerData, setCurrentStickerData] = useState(null);
  const [labelWidth, setLabelWidth] = useState('61');
  const [labelHeight, setLabelHeight] = useState('40.6');
  const [printMode, setPrintMode] = useState('simple');
  const [saveStatus, setSaveStatus] = useState(null);
  const [existingBarcode, setExistingBarcode] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printCount, setPrintCount] = useState(null);
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [setsMode, setSetsMode] = useState('auto');
  const [manualSetsData, setManualSetsData] = useState(null);
  const [currentSetData, setCurrentSetData] = useState(null);
  const [batchId, setBatchId] = useState(null);
  const [batchBarcodeImages, setBatchBarcodeImages] = useState({});
  const [cachedBarcodeImage, setCachedBarcodeImage] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const abortRef = useRef(null);
  const timeoutsRef = useRef([]);
  const stickersPerPage = 12;

  // Cleanup function for timeouts
  const addTimeout = useCallback((timeoutId) => {
    timeoutsRef.current.push(timeoutId);
  }, []);

  // Cache cleanup on component mount
  useEffect(() => {
    const interval = setInterval(() => {
      sheetDataCache.cleanup();
      lotMatrixCache.cleanup();
      issuesCache.cleanup();
    }, 60000);

    return () => {
      clearInterval(interval);
      timeoutsRef.current.forEach(clearTimeout);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const canSearch = useMemo(() => norm(lotInput).length > 0 && !loading, [lotInput, loading]);

  // Calculate sets and stickers based on matrix data
  const setsCalculation = useMemo(() => {
    if (!matrix || !matrix.totals || !matrix.totals.perSize) {
      return {
        sets: 0,
        stickers: 0,
        setRatio: null,
        adjustedStickers: 0,
        piecesPerSet: 0,
        sizeQuantities: [],
        mode: 'auto',
        groups: []
      };
    }

    const sizeQuantities = Object.values(matrix.totals.perSize);

    if (sizeQuantities.length === 0) {
      return {
        sets: 0,
        stickers: 0,
        setRatio: null,
        adjustedStickers: 0,
        piecesPerSet: 0,
        sizeQuantities: [],
        mode: 'auto',
        groups: []
      };
    }

    if (manualSetsData && setsMode === 'manual' && manualSetsData.manualSets) {
      // Calculate stickers per group
      const groups = manualSetsData.manualSets.map(group => ({
        id: group.id,
        name: group.name,
        piecesPerSet: group.piecesPerSet,
        numberOfSets: group.numberOfSets,
        totalStickers: group.numberOfSets,
        sizeDistribution: group.sizes,
        isOversized: group.isOversized || false,
        oversizedSizes: group.oversizedSizes || ''
      }));

      const totalStickers = groups.reduce((sum, g) => sum + g.totalStickers, 0);
      const adjustedTotalStickers = adjustStickersByPercentage(totalStickers, stickerPercentage);

      return {
        sets: totalStickers,
        stickers: totalStickers,
        setRatio: manualSetsData.ratio ? manualSetsData.ratio.join(':') : '0',
        piecesPerSet: manualSetsData.piecesPerSet,
        adjustedStickers: adjustedTotalStickers,
        currentPercentage: stickerPercentage,
        sizeQuantities,
        mode: 'manual',
        groups: groups
      };
    }

    const baseCalculation = calculateSetsAndStickers(matrix.totals.perSize);
    const adjustedStickers = adjustStickersByPercentage(baseCalculation.stickers, stickerPercentage);

    return {
      ...baseCalculation,
      adjustedStickers,
      currentPercentage: stickerPercentage,
      sizeQuantities,
      mode: 'auto',
      groups: []
    };
  }, [matrix, stickerPercentage, manualSetsData, setsMode]);

  // Generate barcode for a specific group
  const generateGroupBarcode = useCallback(async (group, lotNumber) => {
    const groupSuffix = `${group.piecesPerSet}PCS`;
    const barcodeId = generateBarcodeId(lotNumber, groupSuffix);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 200;
    tempCanvas.height = 40;
    await StickerGenerator.renderBarcode(tempCanvas, barcodeId, 200, 40);
    const barcodeImage = tempCanvas.toDataURL('image/png', 1.0);

    return { barcodeId, barcodeImage };
  }, []);

  const handleGenerateStickers = useCallback(async () => {
    if (!matrix) {
      alert('No lot data found. Please search for a valid lot first.');
      return;
    }

    if (setsMode === 'manual' && (!manualSetsData || !manualSetsData.manualSets || manualSetsData.manualSets.length === 0)) {
      alert('Please configure manual sets first.');
      return;
    }

    if (setsMode === 'auto' && setsCalculation.adjustedStickers === 0) {
      alert('No stickers to generate.');
      return;
    }

    setShowLayoutDialog(true);
  }, [matrix, setsCalculation.adjustedStickers, setsMode, manualSetsData]);

  const handleLayoutSelect = useCallback(async (layout) => {
    setSelectedLayout(layout);
    setShowLayoutDialog(false);
    setIsGeneratingStickers(true);

    try {
      const brand = matrix.brand || matrix.style || 'Brand';
      const lotNumber = matrix.lotNumber;

      let allStickers = [];
      const barcodeImages = {};
      const savedRows = [];

      // Get color details from matrix rows
      const colorDetails = {};
      matrix.rows.forEach(row => {
        colorDetails[row.color] = row.sizes || {};
      });

      // Get size quantities as object
      const sizeQuantities = {};
      matrix.sizes.forEach(size => {
        sizeQuantities[size] = matrix.totals.perSize[size] || 0;
      });

      if (setsMode === 'manual' && manualSetsData && manualSetsData.manualSets) {
        // Letter suffixes: A, B, C, D, E, F, G, H, I, J
        const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

        for (let idx = 0; idx < manualSetsData.manualSets.length; idx++) {
          const group = manualSetsData.manualSets[idx];
          const groupLetter = groupLetters[idx]; // A, B, C, etc.
          const barcodeId = generateBarcodeId(lotNumber, groupLetter);

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 200;
          tempCanvas.height = 40;
          await StickerGenerator.renderBarcode(tempCanvas, barcodeId, 200, 40);
          const barcodeImage = tempCanvas.toDataURL('image/png', 1.0);
          barcodeImages[group.id] = barcodeImage;

          // Format Garment Type with Oversized Sizes in brackets if checked
          let baseGarment = matrix.garmentType || packingInfo?.garmentType || matrix.style || '';
          let groupGarmentType = baseGarment;
          if (group.isOversized && group.oversizedSizes && group.oversizedSizes.trim()) {
            const cleanSizes = group.oversizedSizes.trim().replace(/^\(|\)$/g, '');
            groupGarmentType = baseGarment ? `${baseGarment} (${cleanSizes})` : `(${cleanSizes})`;
          }

          // Create stickers for this group
          const groupStickers = [];
          for (let i = 1; i <= group.numberOfSets; i++) {
            groupStickers.push({
              id: `${group.id}-${i}`,
              lotNumber,
              brand,
              barcodeId: barcodeId,
              groupName: group.name,
              piecesPerSet: group.piecesPerSet,
              groupId: group.id,
              groupLetter: groupLetter,
              stickerNumber: i,
              garmentType: groupGarmentType,
              isOversized: group.isOversized,
              oversizedSizes: group.oversizedSizes
            });
          }
          allStickers = [...allStickers, ...groupStickers];

          // Calculate pieces used by this group
          let groupTotalPieces = 0;
          if (group.sizeDistribution) {
            groupTotalPieces = Object.values(group.sizeDistribution).reduce((sum, qty) => sum + (qty || 0), 0) * group.numberOfSets;
          } else {
            groupTotalPieces = group.piecesPerSet * group.numberOfSets;
          }

          // Calculate size quantities for this specific group
          const groupSizeQuantities = {};
          if (group.sizeDistribution) {
            matrix.sizes.forEach(size => {
              const piecesPerSize = group.sizeDistribution[size] || 0;
              groupSizeQuantities[size] = piecesPerSize * group.numberOfSets;
            });
          } else {
            // Distribute proportionally based on total available pieces
            const totalAvailablePieces = matrix.totals.grand;
            matrix.sizes.forEach(size => {
              const sizeQty = sizeQuantities[size] || 0;
              const proportion = sizeQty / totalAvailablePieces;
              groupSizeQuantities[size] = Math.round(groupTotalPieces * proportion);
            });
          }

          // Calculate adjusted stickers for this group with percentage
          const groupAdjustedStickers = adjustStickersByPercentage(group.numberOfSets, stickerPercentage);

          // Prepare data for this group - MATCHING YOUR SHEET STRUCTURE
          const groupData = {
            // Basic Information
            barcodeId: barcodeId,
            lotNumber: lotNumber,
            status: "Generated",
            generatedDate: new Date().toISOString(),
            printedDate: null,
            completedDate: null,
            verificationCode: generateVerificationCode(lotNumber),
            generatedBy: "System",

            // Product Information
            brand: matrix.brand || packingInfo?.brand || '',
            style: (group.isOversized && group.oversizedSizes)
              ? `${matrix.style || ''} (${group.oversizedSizes.trim().replace(/^\(|\)$/g, '')})`.trim()
              : (matrix.style || ''),
            fabric: matrix.fabric || '',
            garmentType: groupGarmentType,

            // Quantity Information
            totalPieces: groupTotalPieces,
            colors: matrix.rows.map(r => r.color),
            sizes: matrix.sizes,
            sizeQuantities: groupSizeQuantities,
            colorDetails: colorDetails,
            cuttingTables: matrix.rows.map(r => r.cuttingTable).filter(ct => ct),

            // Set Information
            setRatio: group.setRatio || null,
            piecesPerSet: group.piecesPerSet,
            numberOfSets: group.numberOfSets,
            baseStickers: group.numberOfSets,
            extraPercentage: stickerPercentage,
            totalStickers: groupAdjustedStickers,

            // Packing Information
            packingSupervisor: packingInfo?.packingSupervisor || '',
            packingDate: packingInfo?.packingDate || '',
            totalPacked: groupTotalPieces,

            // Status & Notes
            qualityStatus: "Pending",
            notes: JSON.stringify({
              mode: "manual",
              groupType: "separate",
              groupName: group.name,
              groupLetter: groupLetter,
              sizeDistribution: group.sizeDistribution || {},
              parentLot: lotNumber,
              totalGroups: manualSetsData.manualSets.length,
              groupSequence: idx + 1
            })
          };

          // Save this group to sheet
          setSaveStatus({ saving: true, success: false, message: `Saving Group ${groupLetter} (${group.name})...` });
          const saveResult = await saveLotToBarcodeStorage(groupData);

          if (saveResult.success) {
            savedRows.push({
              group: group.name,
              groupLetter: groupLetter,
              barcodeId: barcodeId,
              success: true
            });
            console.log(`✅ Saved Group ${groupLetter} with barcode ${barcodeId}`);
          } else {
            savedRows.push({
              group: group.name,
              groupLetter: groupLetter,
              barcodeId: barcodeId,
              success: false,
              error: saveResult.message
            });
            console.error(`❌ Failed to save Group ${groupLetter}:`, saveResult.message);
          }
        }

        setBatchId(`LOT-${lotNumber}-MULTI-GROUP`);

        // Show summary
        const successCount = savedRows.filter(r => r.success).length;
        const failCount = savedRows.filter(r => !r.success).length;
        const barcodeList = savedRows.map(r => r.barcodeId).join(', ');

        if (failCount === 0) {
          setSaveStatus({
            saving: false,
            success: true,
            message: `✓ ${successCount} group(s) saved! Barcodes: ${barcodeList}`
          });
        } else {
          setSaveStatus({
            saving: false,
            success: false,
            message: `⚠️ ${successCount} saved, ${failCount} failed`
          });
        }
        setTimeout(() => setSaveStatus(null), 5000);

      } else {
        // Auto mode - Single group with letter 'A'
        const barcodeId = generateBarcodeId(lotNumber, 'A');
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 200;
        tempCanvas.height = 40;
        await StickerGenerator.renderBarcode(tempCanvas, barcodeId, 200, 40);
        const barcodeImage = tempCanvas.toDataURL('image/png', 1.0);

        barcodeImages['default'] = barcodeImage;
        setBatchId(barcodeId);

        const piecesPerSet = Math.round(setsCalculation.piecesPerSet);

        for (let i = 1; i <= setsCalculation.adjustedStickers; i++) {
          allStickers.push({
            id: i,
            lotNumber,
            brand,
            barcodeId: barcodeId,
            piecesPerSet: piecesPerSet,
            stickerNumber: i
          });
        }

        // Prepare data for auto mode
        const autoData = {
          barcodeId: barcodeId,
          lotNumber: lotNumber,
          status: "Generated",
          generatedDate: new Date().toISOString(),
          printedDate: null,
          completedDate: null,
          verificationCode: generateVerificationCode(lotNumber),
          generatedBy: "System",
          brand: matrix.brand || packingInfo?.brand || '',
          style: matrix.style || '',
          fabric: matrix.fabric || '',
          garmentType: matrix.garmentType || '',
          totalPieces: matrix.totals.grand,
          colors: matrix.rows.map(r => r.color),
          sizes: matrix.sizes,
          sizeQuantities: sizeQuantities,
          colorDetails: colorDetails,
          cuttingTables: matrix.rows.map(r => r.cuttingTable).filter(ct => ct),
          setRatio: setsCalculation.setRatio || '0',
          piecesPerSet: piecesPerSet,
          numberOfSets: setsCalculation.sets,
          baseStickers: setsCalculation.stickers,
          extraPercentage: stickerPercentage,
          totalStickers: allStickers.length,
          packingSupervisor: packingInfo?.packingSupervisor || '',
          packingDate: packingInfo?.packingDate || '',
          totalPacked: packingInfo?.totalPcs || matrix.totals.grand,
          qualityStatus: "Pending",
          notes: `Auto mode - ${stickerPercentage}% extra`
        };

        setSaveStatus({ saving: true, success: false, message: 'Saving to sheet...' });
        const saveResult = await saveLotToBarcodeStorage(autoData);

        if (saveResult.success) {
          setSaveStatus({
            saving: false,
            success: true,
            message: `✓ Saved! Barcode: ${autoData.barcodeId}`
          });
          setTimeout(() => setSaveStatus(null), 3000);
        } else {
          setSaveStatus({
            saving: false,
            success: false,
            message: `⚠️ ${saveResult.message || 'Save failed'}`
          });
        }
      }

      setGeneratedStickers(allStickers);
      setShowPreviewModal(true);

    } catch (error) {
      console.error('Error generating stickers:', error);
      setSaveStatus({
        saving: false,
        success: false,
        message: `❌ Error: ${error.message}`
      });
      alert('Failed to generate stickers. Please try again.');
    } finally {
      setIsGeneratingStickers(false);
    }
  }, [matrix, setsCalculation, setsMode, manualSetsData, stickerPercentage, selectedLayout, packingInfo]);

  const handlePrintWithCount = useCallback(async (count) => {
    setShowPrintDialog(false);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
      const stickersToPrint = generatedStickers.slice(0, count);
      const layoutId = selectedLayout?.id || 'simple';
      const lotNumber = matrix?.lotNumber;
      const totalColors = matrix?.rows?.filter(row => (row.totalPcs || 0) > 0).length || 0;
      const currentYear = new Date().getFullYear();

      const stitchingInitials = getInitialsWithRole(matrix?.supervisor, 'S');
      const packingInitials = getInitialsWithRole(packingInfo?.packingSupervisor, 'P');

      const initialsText = [stitchingInitials, packingInitials]
        .filter(initials => initials && initials !== '—' && initials !== 'S' && initials !== 'P')
        .join('/');

      // Generate high-quality barcode images for all stickers
      const stickersWithHighQualityBarcodes = await Promise.all(
        stickersToPrint.map(async (sticker) => {
          const barcodeId = sticker.barcodeId;
          // Generate fresh high-quality barcode
          const highQualityBarcode = await StickerGenerator.generateHighQualityBarcode(barcodeId, 350, 90);
          return { ...sticker, highQualityBarcode };
        })
      );

      const generateStickerHTML = (sticker) => {
        const piecesPerSet = sticker.piecesPerSet;
        const barcodeImage = sticker.highQualityBarcode;

        if (layoutId === 'detailed') {
          return `
          <style>
            @page {
              size: 61mm 40.6mm;
              margin: 0;
            }
            body { margin: 0; background: white; }
            
            @media print {
              * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .detailed-label {
                break-inside: avoid;
                page-break-inside: avoid;
              }
            }
            
            .detailed-label {
              font-family: 'Inter', 'Segoe UI', Arial, Helvetica, sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            .barcode-img {
              image-rendering: crisp-edges;
              image-rendering: pixelated;
              image-rendering: -webkit-optimize-contrast;
            }
          </style>

          <div class="detailed-label" style="
            width: 61mm;
            height: 40.6mm;
            background-color: #ffffff;
            display: flex;
            flex-direction: column-reverse;
            padding: 6px 8px;
            box-sizing: border-box;
          ">
            <div style="
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              margin: 2px 0;
              background: white;
              padding: 2px 0;
            ">
              <img src="${barcodeImage}" alt="barcode" class="barcode-img" style="width: 180px; height: auto; display: block;" />
            </div>

            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 8px; flex-direction: row;">
              
              <div style="text-align: left; font-size: 9px; line-height: 1.4;">
                
                <div style="margin-bottom: 2px; font-size: 9px; color: #000000;">
                  <span style="font-weight: bold;">IM#442455</span>
                  ${initialsText ? `<span style="margin-left: 4px; font-weight: normal;">${initialsText}</span>` : ''}
                </div>
                
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 10px;">PRODUCT: </span> 
       
                </div>
              
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 11px;">STYLE: </span> 
                  <span style="font-size: 12px;font-weight: bold">AVCHG${lotNumber}</span>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 10px;">PACKED-YY: </span> 
                   <span style="font-size: 10px;font-weight: bold">${currentYear}</span>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 10px;">NET QTY: </span> 
                   <span style="font-size: 10px;font-weight: bold">${piecesPerSet}N</span>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 10px;">COLOUR: </span> 
                   <span style="font-size: 10px;font-weight: bold">${totalColors}</span>
                </div>
              </div>

              <div style="text-align: right; margin-top: 2px;">
                <div style="margin-bottom: 1px; font-size: 9px; color: #000000;">
                  <span style="font-weight: bold;">LYSW514511301</span>
                </div>
                <div style="margin-bottom: 3px;">
                  <span style="font-weight: bold; font-size: 22px; color: #000000;">${piecesPerSet}</span>
                </div>
              </div>

            </div>
          </div>
        `;
        } else if (layoutId === 'compact') {
          return `
          <div style="width: 61mm; height: 40.6mm; background-color: #ffffff; border: 1px solid #000000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; box-sizing: border-box;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">LOT-${lotNumber}</div>
            <div style="font-size: 10px; margin-bottom: 6px;">PCS: ${piecesPerSet}</div>
            <div style="font-size: 8px; margin-bottom: 4px;">${totalColors} Colors</div>
            ${packingInfo?.brand ? `<div style="font-size: 8px; margin-bottom: 4px;">${packingInfo.brand}</div>` : ''}
            <img src="${barcodeImage}" alt="barcode" style="width: 170px; height: auto; display: block;" />
          </div>
        `;
        } else if (layoutId === 'colorful') {
          const colors = ['#f0f9ff', '#f0fdf4', '#fef3c7', '#fce7f3', '#f3e8ff'];
          const colorIndex = (sticker.id || sticker.stickerNumber) % colors.length;
          return `
          <div style="width: 61mm; height: 40.6mm; background-color: ${colors[colorIndex]}; border: 2px solid #000000; padding: 6px; display: flex; flex-direction: column; box-sizing: border-box;">
            <div style="background-color: #000000; color: #ffffff; padding: 2px 4px; font-size: 10px; font-weight: bold; margin-bottom: 4px; text-align: center;">LOT-${lotNumber}</div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
              <div style="text-align: center; font-weight: bold; margin-bottom: 4px; font-size: 11px;">${piecesPerSet} PCS/SET</div>
              <div style="text-align: center; font-size: 10px; margin-bottom: 4px;">${totalColors} Colors</div>
              ${packingInfo?.brand ? `<div style="text-align: center; font-size: 9px; margin-bottom: 4px;">${packingInfo.brand}</div>` : ''}
              <div style="text-align: center; margin: 4px 0;">
                <img src="${barcodeImage}" alt="barcode" style="width: 170px; height: auto; display: inline-block;" />
              </div>
              <div style="font-size: 8px; text-align: center; margin-top: 4px;">${(matrix?.style || matrix?.garmentType || '').substring(0, 20)}</div>
            </div>
            ${packingInfo?.packingSupervisor ? `<div style="font-size: 7px; text-align: right; border-top: 1px solid #ccc; margin-top: 4px; padding-top: 2px;">${packingInfo.packingSupervisor}</div>` : ''}
          </div>
        `;
        } else {
          // IMPROVED SIMPLE LAYOUT with bold text, shifted down, larger top header, color moved further up
          return `
    <style>
      @page {
        size: 61mm 40.6mm;
        margin: 0;
      }
      body { margin: 0; background: white; }
      @media print {
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
      .barcode-img {
        image-rendering: crisp-edges;
        image-rendering: pixelated;
        image-rendering: -webkit-optimize-contrast;
      }
    </style>
    <div style="
      width: 61mm; 
      height: 40.6mm; 
      background-color: #ffffff; 
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif; 
      display: flex; 
      flex-direction: column; 
      padding: 16px 10px 6px 10px; 
      box-sizing: border-box; 
      position: relative;
    ">
      <!-- Top spacer to push content down -->
      <div style="height: 8px;"></div>
      
      <!-- Top row with reference numbers - larger font and bold -->
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: flex-start; 
        width: 100%; 
        margin-bottom: 0px;
      ">
        <div style="text-align: left;">
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${currentYear}/1100/100</div>
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${initialsText || '—'} 16894</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">SRN 7846252</div>
          <div style="font-size: 11px; font-weight: 700; color: #000000; line-height: 1.3;">${currentYear}/110</div>
        </div>
      </div>
      
      <!-- Color code line - shifted further up (negative/zero top margin) -->
      ${totalColors > 0 ? `
        <div style="
          font-size: 11px; 
          font-weight: 700; 
          color: #000000; 
          text-align: left; 
          margin: -2px 0 8px 0;
        ">CL-${totalColors}</div>
      ` : '<div style="height: 4px;"></div>'}
      
      <!-- Barcode section -->
      <div style="
        display: flex; 
        justify-content: center; 
        align-items: center; 
        width: 100%; 
        margin: 6px 0 10px 0;
      ">
        <img src="${barcodeImage}" alt="barcode" class="barcode-img" style="width: 190px; height: auto; display: block;" />
      </div>
      
      <!-- Bottom spacer before bottom content -->
      <div style="height: 6px;"></div>
      
      <!-- Bottom row with lot number and PCS - extra bold -->
      <div style="
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        width: 100%; 
        margin-top: 6px;
        padding-top: 2px;
      ">
        <div style="
          font-size: 20px; 
          font-weight: 900; 
          color: #000000; 
          text-align: left;
          letter-spacing: 0.5px;
        ">200${lotNumber}</div>
        <div style="
          font-size: 16px; 
          font-weight: 900; 
          color: #000000; 
          text-align: right;
          letter-spacing: 0.5px;
        ">PCS: ${piecesPerSet}</div>
      </div>
    </div>
  `;
        }
      };

      const stickersHtml = stickersWithHighQualityBarcodes.map((sticker) => generateStickerHTML(sticker)).join('');

      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Stickers - ${selectedLayout?.name || 'Simple'} Layout - Lot ${matrix?.lotNumber}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              background: white;
              padding: 2mm;
              font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            }
            
            .sticker-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 1mm;
              justify-content: flex-start;
            }
            
            @media print {
              body {
                background: white;
                padding: 0;
                margin: 0;
              }
              
              .sticker-grid > div {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              
              @page {
                size: 61mm 40.6mm;
                margin: 1mm;
              }
            }
            
            img {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              image-rendering: crisp-edges;
              image-rendering: pixelated;
            }
          </style>
        </head>
        <body>
          <div class="sticker-grid">
            ${stickersHtml}
          </div>
          <script>
            // Ensure all images are loaded before printing
            const images = document.querySelectorAll('img');
            let loadedCount = 0;
            
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount === images.length) {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 1500);
                }, 500);
              }
            }
            
            if (images.length === 0) {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 1500);
              }, 500);
            } else {
              images.forEach(img => {
                if (img.complete) {
                  checkAllLoaded();
                } else {
                  img.addEventListener('load', checkAllLoaded);
                  img.addEventListener('error', checkAllLoaded);
                }
              });
            }
          <\/script>
        </body>
      </html>
    `);
      printWindow.document.close();
      printWindow.focus();
    } else {
      alert('Please allow pop-ups for this site to print stickers.');
    }
  }, [generatedStickers, matrix, packingInfo, selectedLayout]);

  const handleSimplePrint = useCallback(() => {
    if (!generatedStickers.length) {
      alert('No stickers to print. Please generate stickers first.');
      return;
    }

    setPrintCount(generatedStickers.length);
    setShowPrintDialog(true);
  }, [generatedStickers]);

  const handlePrintStickers = useCallback(() => {
    handleSimplePrint();
  }, [handleSimplePrint]);

  const handleStickerPercentageChange = useCallback((percentage) => {
    const validPercentage = Math.min(Math.max(0, percentage), 100);
    setStickerPercentage(validPercentage);
  }, []);

  const handleSetsChange = useCallback((data) => {
    setCurrentSetData(data);
    setSetsMode(data.mode);

    if (data.mode === 'manual') {
      setManualSetsData({
        sets: data.sets,
        ratio: data.ratio,
        piecesPerSet: data.piecesPerSet,
        manualSets: data.manualSets,
        sizeBreakdown: data.sizeBreakdown,
        totalPieces: data.totalPieces
      });
    } else {
      setManualSetsData(null);
    }
  }, []);

  const handleVersionSelect = useCallback((version) => {
    console.log('Selected version:', version);
  }, []);

  // OPTIMIZED SEARCH HANDLER
  const handleSearch = async (e) => {
    e?.preventDefault?.();
    if (!canSearch) return;

    setError('');
    setMatrix(null);
    setPackingInfo(null);
    setLoading(true);
    setLoadingStage('Initializing...');
    setLoadingProgress(0);
    setStickerPercentage(1);
    setSelectedStickerType('standard');
    setShowStickerPreview(false);
    setGeneratedStickers([]);
    setCurrentPage(0);
    setBatchId(null);
    setBatchBarcodeImages({});
    setCachedBarcodeImage(null);
    setSetsMode('auto');
    setManualSetsData(null);
    setCurrentSetData(null);
    setSaveStatus(null);
    setExistingBarcode(null);
    setSelectedLayout(null);
    setShowPreviewModal(false);
    setHasError(false);
    setCurrentVersion(null);

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const lotNumber = norm(lotInput);

      setLoadingStage('Locating lot in index...');
      setLoadingProgress(15);

      setLoadingStage('Fetching cutting matrix data...');
      setLoadingProgress(30);

      const matrixData = await fetchLotMatrixViaSheetsApi(lotNumber, ctrl.signal);

      setLoadingProgress(70);

      setMatrix(matrixData);

      setLoadingStage('Fetching packing information...');
      setLoadingProgress(85);
      const packing = await fetchPackingInfo(lotNumber, ctrl.signal);
      if (packing) {
        console.log('Packing info loaded:', packing);
        setPackingInfo(packing);
      } else {
        console.log('No packing info found for lot:', lotNumber);
      }

      setLoadingProgress(100);

    } catch (err) {
      console.error('❌ Search error:', err);
      if (err.name !== 'AbortError') {
        setError(err?.message || "Failed to fetch data.");
        setHasError(true);
      }
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingStage('');
    }
  };
  const handleClear = () => {
    setLotInput('');
    setMatrix(null);
    setPackingInfo(null);
    setError('');
    setStickerPercentage(1);
    setSelectedStickerType('standard');
    setShowStickerPreview(false);
    setGeneratedStickers([]);
    setCurrentPage(0);
    setBatchId(null);
    setBatchBarcodeImages({});
    setCachedBarcodeImage(null);
    setShowDesignStudio(false);
    setSetsMode('auto');
    setManualSetsData(null);
    setCurrentSetData(null);
    setSaveStatus(null);
    setExistingBarcode(null);
    setSelectedLayout(null);
    setShowPreviewModal(false);
    setHasError(false);
    setCurrentVersion(null);
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const handleBack = () => {
    if (window.history?.length > 1) window.history.back();
    else window.close?.();
  };

  const displaySizes = useMemo(() => {
    if (!matrix) return [];
    return matrix.sizes || [];
  }, [matrix]);

  // ============================
  // RENDER
  // ============================
  return (
    <div className="wrap">
      <div className="header-paper">
        <div className="title-section">
          <div className="title-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h2>BARCODE GENERATOR</h2>
            <p>Search a Lot No. to generate black & white stickers</p>
          </div>
        </div>

        <div className="search-section">
          <form className="form" onSubmit={handleSearch}>
            <div className="search-box">
              <FiSearch />
              <input
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                placeholder="Enter Lot No (e.g., 64003)"
                autoFocus
                aria-label="Lot Number Input"
              />
            </div>

            <div className="btn-row">
              <button
                className="base-btn ghost-btn"
                type="button"
                onClick={handleBack}
                title="Back"
                aria-label="Go Back"
              >
                <FiArrowLeft /> Back
              </button>

              <button
                type="button"
                onClick={testAppsScript}
                className="base-btn ghost-btn"
                style={{ background: '#6b7280', color: 'white' }}
                aria-label="Test Script Connection"
              >
                Test Script
              </button>

              <button
                className="base-btn primary-btn"
                type="submit"
                disabled={!canSearch}
                aria-label="Search Lot"
              >
                {loading ? <div className="spinner"></div> : <><FiSearch /> Search</>}
              </button>

              <button
                className="base-btn ghost-btn"
                type="button"
                onClick={handleClear}
                aria-label="Reset Form"
              >
                <FiRefreshCw /> Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Loading Overlay with Progress */}
      {loading && (
        <div className="loading-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="loading-card" style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            minWidth: '300px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <div className="loading-text" style={{ marginBottom: '12px', fontWeight: 500 }}>
              {loadingStage || 'Loading...'}
            </div>
            {loadingProgress > 0 && (
              <div className="progress-bar" style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#e2e8f0',
                borderRadius: '3px',
                overflow: 'hidden',
                marginTop: '12px'
              }}>
                <div className="progress-fill" style={{
                  width: `${loadingProgress}%`,
                  height: '100%',
                  backgroundColor: '#3b82f6',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}
            <div className="loading-tip" style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '16px'
            }}>
              💡 Fetching data from server...
            </div>
          </div>
        </div>
      )}

      {error && !hasError && (
        <div className="error-card" role="alert">
          <FiAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {saveStatus && (
        <div className="save-status" style={{
          marginBottom: '16px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: saveStatus.saving ? '#e8f4fd' : saveStatus.success ? '#d1fae5' : '#fee2e2',
          color: saveStatus.saving ? '#1e40af' : saveStatus.success ? '#065f46' : '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }} role="status">
          {saveStatus.saving ? <FiDatabase className="spin" /> : saveStatus.success ? <FiCheck /> : <FiAlertTriangle />}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {matrix ? (
        <div className="content-grid">
          <div className="info-panel">
            <div className="panel-header">
              <FiInfo />
              <h3>Lot Information</h3>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <div className="info-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h8" />
                  </svg>
                </div>
                <div>
                  <div className="info-label">Lot Number</div>
                  <div className="info-value">{matrix.lotNumber || '—'}</div>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-4.83 4.83a4 4 0 0 1-5.66 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01" />
                  </svg>
                </div>
                <div>
                  <div className="info-label">Item Name</div>
                  <div className="info-value">{matrix.style || matrix.garmentType || '—'}</div>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div>
                  <div className="info-label">Fabric</div>
                  <div className="info-value">{matrix.fabric || '—'}</div>
                </div>
              </div>
              <div className="info-item">
                <div className="info-icon">
                  <FiUser />
                </div>
                <div>
                  <div className="info-label">Supervisor</div>
                  <div className="info-value">{matrix.supervisor || '—'}</div>
                </div>
              </div>
              {matrix.brand && (
                <div className="info-item">
                  <div className="info-icon">
                    <FiTag />
                  </div>
                  <div>
                    <div className="info-label">Brand</div>
                    <div className="info-value">{matrix.brand}</div>
                  </div>
                </div>
              )}
              {packingInfo && packingInfo.packingSupervisor && (
                <div className="info-item">
                  <div className="info-icon">
                    <FiUser />
                  </div>
                  <div>
                    <div className="info-label">Packing Supervisor</div>
                    <div className="info-value">{packingInfo.packingSupervisor}</div>
                  </div>
                </div>
              )}
              {packingInfo && packingInfo.packingDate && (
                <div className="info-item">
                  <div className="info-icon">
                    <FiCalendar />
                  </div>
                  <div>
                    <div className="info-label">Packing Date</div>
                    <div className="info-value">{packingInfo.packingDate}</div>
                  </div>
                </div>
              )}
              {packingInfo && packingInfo.brand && !matrix.brand && (
                <div className="info-item">
                  <div className="info-icon">
                    <FiTag />
                  </div>
                  <div>
                    <div className="info-label">Brand</div>
                    <div className="info-value">{packingInfo.brand}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Version History Component */}
            <VersionHistory
              lotNumber={matrix?.lotNumber}
              onVersionSelect={handleVersionSelect}
            />

            {setsCalculation.sizeQuantities && setsCalculation.sizeQuantities.length > 0 && (
              <SetsManager
                sizeQuantities={setsCalculation.sizeQuantities}
                sizeLabels={matrix.sizes || []}
                initialStickerPercentage={stickerPercentage}
                onStickerPercentageChange={handleStickerPercentageChange}
                onSetsChange={handleSetsChange}
              />
            )}

            <div className="summary-card">
              <div className="summary-item">
                <div className="summary-label">Total Pieces</div>
                <div className="summary-value">{matrix.totals.grand}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">Colors</div>
                <div className="summary-value">{matrix.rows.length}</div>
              </div>
              <div className="summary-item">
                <div className="summary-label">Sizes</div>
                <div className="summary-value">{matrix.sizes.length}</div>
              </div>
            </div>
          </div>


          <div className="table-panel">
            <div className="panel-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <h3>Cutting Matrix</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th>Cutting Table</th>
                    {displaySizes.map((s, i) => (
                      <th key={`${s || 'size'}-${i}`}>{s || '\u00A0'}</th>
                    ))}
                    <th>Total Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.color}</td>
                      <td className="num">{r.cuttingTable ?? ''}</td>
                      {displaySizes.map((s, i) => (
                        <td key={`${r.color}-${s || 'size'}-${i}`} className="num">
                          {r.sizes?.[s] ?? ''}
                        </td>
                      ))}
                      <td className="num strong">{r.totalPcs ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="strong">Total</td>
                    <td className="num">—</td>
                    {displaySizes.map((s, i) => (
                      <td key={`total-${s || 'size'}-${i}`} className="num strong">
                        {matrix.totals.perSize?.[s] ?? 0}
                      </td>
                    ))}
                    <td className="num strong">{matrix.totals.grand}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {((setsMode === 'auto' && setsCalculation.sets > 0) || (setsMode === 'manual' && manualSetsData)) && (
              <div className="sticker-count-box">
                <div className="sticker-count-header">
                  <FiTag />
                  <h4>Count of Stickers</h4>
                  {currentVersion && currentVersion !== 'default' && (
                    <span style={{ fontSize: '11px', color: '#8b5cf6', marginLeft: '8px' }}>
                      Barcode: {batchId || currentVersion}
                    </span>
                  )}
                </div>

                {setsMode === 'manual' && setsCalculation.groups && setsCalculation.groups.length > 0 ? (
                  // Display groups with their individual sticker counts
                  <div>
                    {setsCalculation.groups.map((group, idx) => (
                      <div key={idx} className="sticker-count-item" style={{ marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                        <div className="sticker-count-label">
                          {group.name || `Group ${idx + 1}`}
                          {group.isOversized && group.oversizedSizes && (
                            <span style={{ fontSize: '11px', color: '#7c3aed', marginLeft: '6px', fontWeight: 'bold' }}>
                              ({group.oversizedSizes.trim().replace(/^\(|\)$/g, '')})
                            </span>
                          )}
                        </div>
                        <div className="sticker-count-number">{group.numberOfSets} stickers</div>
                        <div className="sticker-count-subtext">{group.piecesPerSet} PCS per set</div>
                      </div>
                    ))}
                    <div className="sticker-count-item" style={{ backgroundColor: '#e0f2fe', padding: '8px', borderRadius: '8px', marginTop: '8px' }}>
                      <div className="sticker-count-label">Total Stickers</div>
                      <div className="sticker-count-number">{setsCalculation.adjustedStickers}</div>
                      <div className="sticker-count-subtext">With {stickerPercentage}% extra</div>
                    </div>
                  </div>
                ) : (
                  <div className="sticker-count-display">
                    <div className="sticker-count-item">
                      <div className="sticker-count-label">Base Stickers</div>
                      <div className="sticker-count-number">{setsCalculation.stickers}</div>
                      <div className="sticker-count-subtext">Based on {setsCalculation.sets} complete sets</div>
                    </div>

                    <div className="sticker-count-item">
                      <div className="sticker-count-label">With {stickerPercentage}% Extra</div>
                      <div className="sticker-count-number">{setsCalculation.adjustedStickers}</div>
                      <div className="sticker-count-subtext">+{Math.ceil(setsCalculation.stickers * stickerPercentage / 100)} extra stickers</div>
                    </div>

                    <div className="sticker-count-item">
                      <div className="sticker-count-label">Pieces per Set</div>
                      <div className="sticker-count-number">{Math.round(setsCalculation.piecesPerSet)}</div>
                      <div className="sticker-count-subtext">Size ratio: {setsCalculation.setRatio}</div>
                    </div>
                  </div>
                )}

                <div className="sticker-selection">
                  <button
                    className="generate-button"
                    onClick={handleGenerateStickers}
                    disabled={isGeneratingStickers}
                    aria-label="Generate Stickers"
                  >
                    {isGeneratingStickers ? <div className="spinner spinner-lg"></div> : <FiEye />}
                    {isGeneratingStickers
                      ? 'Generating...'
                      : `Preview & Generate ${setsCalculation.adjustedStickers} Stickers`}
                  </button>

                  <button
                    className="generate-button"
                    onClick={handlePrintStickers}
                    disabled={generatedStickers.length === 0}
                    aria-label="Print Stickers"
                  >
                    <FiPrinter /> Browser Print
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginTop: '8px' }}>
                  * Black & White Stickers (2.4" × 1.6") with bold scannable barcode
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        !loading && !error && (
          <div className="hint-card">
            <FiInfo />
            <span>
              💡 Tip: Enter a lot number to generate black & white stickers.<br />
              Each sticker includes:<br />
              • Lot Number<br />
              • Item Name<br />
              • Pieces per Set (PCS/SET)<br />
              • Bold Scannable Barcode (centered)
            </span>
          </div>
        )
      )}

      {/* Layout Selection Dialog */}
      <LayoutSelectionDialog
        isOpen={showLayoutDialog}
        onClose={() => setShowLayoutDialog(false)}
        onSelectLayout={handleLayoutSelect}
        totalStickers={setsCalculation.adjustedStickers}
      />

      {/* Sticker Preview Modal */}
      {showPreviewModal && generatedStickers.length > 0 && (
        <StickerPreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setShowStickerPreview(false);
          }}
          stickers={generatedStickers}
          matrix={matrix}
          setsCalculation={setsCalculation}
          batchId={batchId}
          packingInfo={packingInfo}
          selectedLayout={selectedLayout}
          onPrint={handleSimplePrint}
        />
      )}

      <PrintDialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        totalStickers={printCount || generatedStickers.length}
        onPrint={handlePrintWithCount}
        isPrinting={false}
      />
    </div>
  );
}
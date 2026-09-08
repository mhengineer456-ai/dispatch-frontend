// PartyBill.js - Blue & White Theme with Traditional Layout
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // Add this import
import "./PartyBill.css";

// Import jsPDF directly (not dynamically)
import jsPDF from 'jspdf';

// Google Apps Script URL - REPLACE WITH YOUR DEPLOYED WEB APP URL
const APPS_SCRIPT_URL = process.env.REACT_APP_BILL_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwSOsKfAlKYq-wYGFa4KWnGwryK1T0ViJYigil8pCbZz_xkK3gv0tqtCgB-k54rRVfa/exec";

// Bills Sheet ID - Replace with your Bills sheet ID
const BILLS_SHEET_ID = process.env.REACT_APP_SPREADSHEET_ID || "1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk";
const BILLS_SHEET_NAME = "Bills";

// Main Google Sheet configuration for reading product data
const SHEET_ID = process.env.REACT_APP_PRODUCT_SHEET_ID || "1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8";
const SHEET_NAME = "LotBarcodeData";

// OLD LOT Sheet configuration
const OLD_LOT_SHEET_NAME = "OLD LOTS";

// Global API Key
const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";

// Helper utility to reliably extract Part No regardless of header naming variations and whitespace
const extractPartNo = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.partNo && String(obj.partNo).trim()) return String(obj.partNo).trim();
  if (obj.part_no && String(obj.part_no).trim()) return String(obj.part_no).trim();
  if (obj['PART NO.'] && String(obj['PART NO.']).trim()) return String(obj['PART NO.']).trim();
  if (obj['Part No.'] && String(obj['Part No.']).trim()) return String(obj['Part No.']).trim();
  if (obj['Part No'] && String(obj['Part No']).trim()) return String(obj['Part No']).trim();
  if (obj['PART NO'] && String(obj['PART NO']).trim()) return String(obj['PART NO']).trim();
  if (obj['Part Number'] && String(obj['Part Number']).trim()) return String(obj['Part Number']).trim();
  if (obj['PART NUMBER'] && String(obj['PART NUMBER']).trim()) return String(obj['PART NUMBER']).trim();

  for (const key of Object.keys(obj)) {
    const cleanKey = key.trim().toUpperCase().replace(/[\.\_\-\#]/g, ' ').replace(/\s+/g, ' ');
    if (cleanKey === 'PART NO' || cleanKey === 'PARTNO' || cleanKey === 'PART NUMBER' || cleanKey === 'PART') {
      const val = obj[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }
  return '';
};

// Helper utility to reliably extract Rate regardless of header variations
const extractRate = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  if (obj.rate !== undefined && obj.rate !== null && String(obj.rate).trim() !== '') return String(obj.rate).trim();
  if (obj['RATE'] && String(obj['RATE']).trim()) return String(obj['RATE']).trim();
  if (obj['Rate'] && String(obj['Rate']).trim()) return String(obj['Rate']).trim();

  for (const key of Object.keys(obj)) {
    const cleanKey = key.trim().toUpperCase().replace(/[\.\_\-]/g, ' ').replace(/\s+/g, ' ');
    if (cleanKey === 'RATE' || cleanKey === 'UNIT RATE' || cleanKey === 'PRICE') {
      const val = obj[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }
  return '';
};

// Safe JSON parser to prevent SyntaxError on non-JSON strings (e.g. 'FINAL')
const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  const str = String(val).trim();
  if (!str.startsWith('{') && !str.startsWith('[')) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

const PartyBill = ({ parties, bills, selectedParty, onSubmit, onBack, currentUser }) => {
  // Initialize billForm with selectedParty if provided
  const [billForm, setBillForm] = useState({
    partyName: selectedParty?.name || "",
    billDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    items: [],
    notes: ""
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug modal state
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);

  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [tempBillData, setTempBillData] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editItemData, setEditItemData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Lot search suggestions
  const [lotSearchTerm, setLotSearchTerm] = useState("");
  const [lotSuggestions, setLotSuggestions] = useState([]);
  const [showLotSuggestions, setShowLotSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const suggestionsRef = useRef(null);
  const [isProcessingDraft, setIsProcessingDraft] = useState(false);

  // Lot Details Modal state
  const [isLotDetailsModalOpen, setIsLotDetailsModalOpen] = useState(false);
  const [lotDetailsData, setLotDetailsData] = useState([]);
  const [loadingLotDetails, setLoadingLotDetails] = useState(false);
  const [selectedLotForDetails, setSelectedLotForDetails] = useState(null);

  // Use selectedParty from props if available, otherwise use state
  const [selectedPartyState, setSelectedPartyState] = useState(selectedParty || null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState([]);
  const [oldLotData, setOldLotData] = useState([]);
  const [dataLoadError, setDataLoadError] = useState(false);
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [savingToSheet, setSavingToSheet] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [lotSummary, setLotSummary] = useState([]);
  const [loadingLotSummary, setLoadingLotSummary] = useState(false);
  const [selectedLotForSummary, setSelectedLotForSummary] = useState(null);
  // Add these with your other state variables
  // Add these with your other state variables

  const [tempBillDataForDraft, setTempBillDataForDraft] = useState(null);
  const [isEditingExistingDraft, setIsEditingExistingDraft] = useState(false);
  const [existingDraftNumber, setExistingDraftNumber] = useState(null);
  const navigate = useNavigate();


  // On-screen keyboard state
  const [showNumericKeyboard, setShowNumericKeyboard] = useState(false);
  const [manualLotInput, setManualLotInput] = useState("");
  const [searchingManualLot, setSearchingManualLot] = useState(false);

  const barcodeInputRef = useRef(null);
  const modalBarcodeInputRef = useRef(null);
  const debugContainerRef = useRef(null);
  const manualLotInputRef = useRef(null);
  const modalLotSearchInputRef = useRef(null);

  // Product details for current scan
  const [currentProduct, setCurrentProduct] = useState({
    barcode: "",
    lotNumber: "",
    sets: "",
    setsPerPcs: "",
    loosePcs: 0,
    looseOperation: "add",
    brand: "",
    item: "",
    quantity: 1,
    totalPieces: "",
    colors: [],
    sizes: [],
    sizeQuantities: {},
    colorDetails: {},
    partNo: "",
    rate: ""
  });

  const [scannerDebug, setScannerDebug] = useState([]);

  // Get current user info
  const preparedBy = currentUser?.fullName || currentUser?.username || "System";
  const userRole = currentUser?.role === "admin" ? "Admin" : currentUser?.role === "user" ? "Staff" : "User";
  const userEmail = currentUser?.email || "";

  // ==================== LOT SUGGESTIONS FUNCTIONS ====================

  const searchLotsWithSuggestions = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      return;
    }

    const allProducts = [...sheetData, ...oldLotData];

    if (allProducts.length === 0) {
      addDebugMessage("No product data available for search", 'warning');
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    // Search in Lot Number field using includes (case-insensitive)
    const matches = allProducts.filter(product => {
      const lotNumber = product['Lot Number']?.toString().toLowerCase() || "";
      return lotNumber.includes(searchLower);
    });

    addDebugMessage(`Search for "${searchTerm}" found ${matches.length} matches`, 'info');

    if (matches.length > 0) {
      const firstFew = matches.slice(0, 5).map(p => `${p['Lot Number']} - ${p['Garment Type'] || p['Item Name']}`);
      addDebugMessage(`First few matches: ${firstFew.join(', ')}`, 'info');
    }

    // Create suggestions WITHOUT deduplication - keep all entries
    const suggestions = [];

    matches.forEach(product => {
      const lotNumber = product['Lot Number']?.toString() || "";
      if (!lotNumber) return;

      const description = product['Garment Type'] || product['Item Name'] || "";
      const brand = product['Brand'] || product['Party Name'] || "";
      const piecesPerSet = product['Pieces Per Set'] || product['PiecesPerSet'] || 0;

      // Create a unique ID for each entry
      const uniqueId = `${lotNumber}_${description}_${Date.now()}_${Math.random()}`;

      suggestions.push({
        id: uniqueId,
        lotNumber: lotNumber,
        barcode: product['Barcode ID'] || `LOT-${lotNumber}`,
        description: description,
        displayDescription: piecesPerSet > 0 ? `${description} ${piecesPerSet}S` : description,
        brand: brand,
        piecesPerSet: piecesPerSet,
        totalPieces: product['Total Pieces'] || 0,
        colors: product['Colors'] || [],
        sizes: product['Sizes'] || [],
        source: product['Source'] || (product['Party Name'] ? 'Main' : 'OLD LOT'),
        isOldLot: product['Source'] === 'OLD LOT' || !product['Party Name'],
        rawData: product, // Store the full product data
        partNo: extractPartNo(product),
        rate: extractRate(product)
      });
    });

    // Sort suggestions by lot number then by description
    suggestions.sort((a, b) => {
      // First sort by lot number
      const lotCompare = a.lotNumber.localeCompare(b.lotNumber, undefined, { numeric: true });
      if (lotCompare !== 0) return lotCompare;
      // Then by description for same lot number
      return a.description.localeCompare(b.description);
    });

    const limitedSuggestions = suggestions.slice(0, 30); // Show up to 30 entries

    setLotSuggestions(limitedSuggestions);
    setShowLotSuggestions(limitedSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);

    addDebugMessage(`Found ${suggestions.length} total entries for "${searchTerm}" (showing ${limitedSuggestions.length})`, 'success');
  };
  const selectLotFromSuggestion = (suggestion) => {
    addDebugMessage(`Selected: ${suggestion.lotNumber} - ${suggestion.description}`, 'success');

    const productData = {
      barcode: suggestion.barcode,
      lotNumber: suggestion.lotNumber,
      sets: "",
      setsPerPcs: suggestion.piecesPerSet,
      loosePcs: 0,
      looseOperation: "add",
      brand: suggestion.brand,
      item: suggestion.description,  // Use the specific description for this entry
      quantity: 0,
      totalPieces: suggestion.totalPieces,
      colors: suggestion.colors || [],
      sizes: suggestion.sizes || [],
      sizeQuantities: {},
      colorDetails: {},
      partNo: suggestion.partNo || extractPartNo(suggestion),
      rate: suggestion.rate || extractRate(suggestion)
    };

    setCurrentProduct(productData);
    setSelectedLotForSummary(suggestion.lotNumber);
    setManualLotInput(suggestion.lotNumber);
    setLotSearchTerm(suggestion.lotNumber);
    setShowLotSuggestions(false);

    playBeepSound();
    showToast(`Selected: ${suggestion.description}`, 'success');

    setTimeout(() => {
      const setsInput = document.querySelector('.blue-sets-input');
      if (setsInput) setsInput.focus();
    }, 100);
  };

  const handleLotInputKeyDown = (e) => {
    if (!showLotSuggestions || lotSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleManualLotSearch();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < lotSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestionIndex >= 0 && lotSuggestions[selectedSuggestionIndex]) {
        selectLotFromSuggestion(lotSuggestions[selectedSuggestionIndex]);
      } else {
        handleManualLotSearch();
      }
    } else if (e.key === 'Escape') {
      setShowLotSuggestions(false);
    }
  };
  const getNextDraftNumber = async () => {
    try {
      addDebugMessage(`Fetching next draft number...`);
      const numbers = [];

      const API_KEY = GOOGLE_API_KEY;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${BILLS_SHEET_ID}/values/DraftBills!A1:A500?key=${API_KEY}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const result = await response.json();
        if (result.values && result.values.length > 0) {
          result.values.forEach(row => {
            const idVal = String(row[0] || '').trim();
            if (idVal.startsWith('DL-')) {
              const numPart = idVal.replace('DL-', '');
              if (/^\d+$/.test(numPart)) {
                const num = parseInt(numPart, 10);
                if (!isNaN(num)) numbers.push(num);
              }
            }
          });
        }
      }

      let maxDraftNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
      const nextNumber = maxDraftNumber + 1;
      const formattedNumber = String(nextNumber).padStart(3, '0');
      const draftNumber = `DL-${formattedNumber}`;

      addDebugMessage(`Next draft number calculated: ${draftNumber}`, 'success');
      return draftNumber;

    } catch (error) {
      console.error("Error getting next draft number:", error);
      addDebugMessage(`Error: ${error.message}`, 'error');
      const fallbackNumber = `DL-001`;
      showToast(`Could not fetch draft number, using ${fallbackNumber}`, "warning");
      return fallbackNumber;
    }
  };

  // ==================== PACKING NUMBER FUNCTIONS ====================

  const getNextPackingNumber = async (prefix = 'PL') => {
    try {
      addDebugMessage(`Fetching last ${prefix} number from Google Sheets...`);
      const numbers = [];

      const targetSheet = prefix === 'DL' ? 'DraftBills' : (BILLS_SHEET_NAME || 'Bills');
      const API_KEY = GOOGLE_API_KEY;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${BILLS_SHEET_ID}/values/${targetSheet}!A1:A10000?key=${API_KEY}`;

      const response = await fetch(apiUrl);
      if (response.ok) {
        const result = await response.json();
        if (result.values && result.values.length > 0) {
          result.values.forEach(row => {
            const idVal = String(row[0] || '').trim();
            if (idVal.startsWith(`${prefix}-`)) {
              const numberPart = idVal.replace(`${prefix}-`, '');
              if (/^\d+$/.test(numberPart)) {
                const num = parseInt(numberPart, 10);
                if (!isNaN(num)) numbers.push(num);
              }
            }
          });
        }
      }

      let lastNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
      const nextNumber = lastNumber + 1;
      const formattedNumber = String(nextNumber).padStart(3, '0');
      const packingNumber = `${prefix}-${formattedNumber}`;

      addDebugMessage(`Generated new ${prefix} number: ${packingNumber}`, 'success');
      return packingNumber;

    } catch (error) {
      console.error("Error getting next packing number:", error);
      addDebugMessage(`Error: ${error.message}`, 'error');
      const fallbackNumber = `${prefix}-001`;
      showToast(`Could not fetch from sheet, using ${fallbackNumber}`, "warning");
      return fallbackNumber;
    }
  };

  // ==================== GOOGLE SHEETS STORAGE FUNCTIONS ====================

  const saveBillToGoogleSheet = async (billData) => {
    try {
      setSavingToSheet(true);
      setProcessingStage('sheet');

      // 🔍 DEBUG: Log bill data before sending
      console.log("📤 saveBillToGoogleSheet - Bill Data:", billData);
      console.log("📤 Items count:", billData.items?.length);
      if (billData.items && billData.items.length > 0) {
        console.log("📤 First item:", billData.items[0]);
        console.log("📤 First item PartNo:", billData.items[0].partNo);
        console.log("📤 First item Rate:", billData.items[0].rate);
      }
      addDebugMessage(`💾 Saving ${billData.items?.length || 0} items to Google Sheets`, 'info');

      const resolvePartNo = (item) => {
        if (item.partNo && String(item.partNo).trim()) return String(item.partNo).trim();

        let pNo = extractPartNo(item);
        if (pNo) return pNo;

        const lotNum = item.lotNumber ? String(item.lotNumber).trim() : '';
        if (lotNum) {
          const prodMatch = [...sheetData, ...oldLotData].find(p => {
            const pLot = p['Lot Number'] || p.lotNumber || '';
            return String(pLot).trim() === lotNum || String(pLot).trim().replace(/^LOT-/i, '') === lotNum.replace(/^LOT-/i, '');
          });
          if (prodMatch) {
            pNo = extractPartNo(prodMatch);
            if (pNo) return pNo;
          }

          const sumMatch = lotSummary.find(s => String(s.lotNumber).trim() === lotNum);
          if (sumMatch && sumMatch.partNo) return String(sumMatch.partNo).trim();
        }

        if (item.description) {
          const descMatch = String(item.description).match(/^(\d{3,6})\b/);
          if (descMatch) return descMatch[1];
        }

        return '';
      };

      const billDataWithPreparer = {
        ...billData,
        items: (billData.items || []).map(item => ({
          ...item,
          partNo: resolvePartNo(item),
          rate: item.rate || extractRate(item) || '1'
        })),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        preparedAt: new Date().toISOString(),
        status: 'FINAL',
        documentType: 'FINAL',
        action: 'createPackingList'
      };

      // Log what we're sending for debugging
      addDebugMessage(`Sending bill data with status: ${billDataWithPreparer.status}, docType: ${billDataWithPreparer.documentType}`, 'info');
      addDebugMessage(`Bill number: ${billDataWithPreparer.packingNumber || billDataWithPreparer.billNumber}`, 'info');

      // 🔍 DEBUG: Check if PartNo and Rate are in the data
      if (billDataWithPreparer.items && billDataWithPreparer.items.length > 0) {
        const sampleItem = billDataWithPreparer.items[0];
        console.log("📤 Sample item being sent:", {
          description: sampleItem.description,
          partNo: sampleItem.partNo,
          rate: sampleItem.rate
        });
        addDebugMessage(`📤 Sample item - PartNo: ${sampleItem.partNo || 'N/A'}, Rate: ${sampleItem.rate || 'N/A'}`, 'info');
      }

      // Use URLSearchParams format
      const formData = new URLSearchParams();
      formData.append('payload', JSON.stringify(billDataWithPreparer));

      // 🔍 DEBUG: Log the payload being sent
      const payloadString = JSON.stringify(billDataWithPreparer);
      console.log("📤 Payload length:", payloadString.length);
      console.log("📤 Payload preview:", payloadString.substring(0, 500) + "...");

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("📥 Server response:", result);

      if (result.success) {
        addDebugMessage(`✅ ${billData.documentType || 'FINAL'} bill saved`, 'success');
        showToast(`Bill saved to Google Sheets`, "success");
        await fetchLotSummary();
        return true;
      } else {
        throw new Error(result.error || 'Unknown error from server');
      }

    } catch (error) {
      console.error("❌ Error saving to Google Sheets:", error);
      addDebugMessage(`❌ Failed to save: ${error.message}`, 'error');
      showToast(`Failed to save: ${error.message}`, "error");
      setProcessingStage(null);
      return false;
    } finally {
      setSavingToSheet(false);
    }
  };
  // NEW FUNCTION: Save bill as draft
  const saveBillToDraftSheet = async (billData) => {
    try {
      setSavingToSheet(true);
      setProcessingStage('sheet');

      // 🔍 DEBUG: Log draft data
      console.log("📤 saveBillToDraftSheet - Draft Data:", billData);
      if (billData.items && billData.items.length > 0) {
        console.log("📤 First draft item:", billData.items[0]);
        console.log("📤 First draft item PartNo:", billData.items[0].partNo);
        console.log("📤 First draft item Rate:", billData.items[0].rate);
      }
      addDebugMessage(`💾 Saving draft with ${billData.items?.length || 0} items`, 'info');

      const draftData = {
        ...billData,
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        preparedAt: new Date().toISOString(),
        status: 'DRAFT',
        documentType: 'DRAFT'
      };

      const encodedData = encodeURIComponent(JSON.stringify(draftData));
      const urlEncodedData = `data=${encodedData}&type=draft`;

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlEncodedData
      });

      const result = await response.json();
      console.log("📥 Draft save response:", result);

      if (result.success) {
        addDebugMessage(`✅ Draft ${billData.packingNumber} saved to Draft Sheet`, 'success');
        showToast(`Draft saved with ID: ${billData.packingNumber}`, "success");
        return true;
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error("❌ Error saving draft:", error);
      addDebugMessage(`❌ Failed to save draft: ${error.message}`, 'error');
      showToast("Failed to save draft", "error");
      setProcessingStage(null);
      return false;
    } finally {
      setSavingToSheet(false);
    }
  };
  // DraftSavingOverlay component extracted to module scope
  // Update handleFinalAction to pass data as parameter
  const handleFinalAction = (action) => {
    if (savingToSheet || generatingPDF || isProcessingDraft) {
      console.warn("⚠️ Submission process already in progress, ignoring duplicate action click");
      return;
    }

    // 🔍 DEBUG: Log the data being passed
    console.log("🔍 handleFinalAction - action:", action);
    console.log("🔍 billForm items:", billForm.items);
    if (billForm.items && billForm.items.length > 0) {
      console.log("🔍 First billForm item PartNo:", billForm.items[0].partNo);
      console.log("🔍 First billForm item Rate:", billForm.items[0].rate);
    }
    addDebugMessage(`🎯 Action: ${action} with ${billForm.items?.length || 0} items`, 'info');

    if (action === 'draft') {
      // Pass billForm directly
      handleSaveAsDraft({ ...billForm });
    } else if (action === 'final') {
      setIsConfirmModalOpen(false);
      handleFinalSubmission();
    }
  };

  // Update handleSaveAsDraft to accept data parameter
  const handleSaveAsDraft = async (billData) => {
    if (!billData) {
      showToast("No draft data to save", "error");
      return;
    }

    if (savingToSheet || isProcessingDraft) {
      console.warn("⚠️ Draft save already in progress, ignoring duplicate click");
      return;
    }

    // 🔍 DEBUG: Log billData items
    console.log("🔍 handleSaveAsDraft - billData:", billData);
    console.log("🔍 Items count:", billData.items?.length);
    if (billData.items && billData.items.length > 0) {
      console.log("🔍 First item:", billData.items[0]);
      console.log("🔍 First item PartNo:", billData.items[0].partNo);
      console.log("🔍 First item Rate:", billData.items[0].rate);
    }
    addDebugMessage(`💾 Saving draft with ${billData.items?.length || 0} items`, 'info');

    setIsProcessingDraft(true);
    setSavingToSheet(true);
    setProcessingStage('sheet');

    try {
      const draftNumber = await getNextDraftNumber();
      addDebugMessage(`Creating draft with number: ${draftNumber}`, 'info');

      // 🔍 DEBUG: Map items and log each one
      const mappedItems = billData.items.map((item, index) => {
        const mappedItem = {
          id: item.id,
          barcode: item.barcode,
          lotNumber: item.lotNumber,
          brand: item.brand,
          description: item.description,
          sets: item.sets,
          setsPerPcs: item.setsPerPcs,
          loosePcs: item.loosePcs,
          looseOperation: item.looseOperation || "add",
          quantity: item.quantity,
          colors: item.colors || [],
          sizes: item.sizes || [],
          partNo: item.partNo || extractPartNo(item),
          rate: item.rate || extractRate(item)
        };

        console.log(`📦 Draft Item ${index + 1}:`, {
          description: mappedItem.description,
          partNo: mappedItem.partNo,
          rate: mappedItem.rate
        });

        return mappedItem;
      });

      const draftData = {
        billNumber: draftNumber,
        packingNumber: draftNumber,
        partyName: selectedPartyState?.name || billData.partyName,
        billDate: billData.billDate,
        dueDate: billData.dueDate || "",
        orderReference: billData.orderReference || "",
        items: mappedItems,
        notes: billData.notes || "",
        createdDate: new Date().toISOString(),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        status: 'DRAFT',
        documentType: 'DRAFT'
      };

      // 🔍 DEBUG: Log complete draft data
      console.log("📤 Draft data being saved:", JSON.stringify(draftData, null, 2));

      // 1. Save to Database / Sheet first
      addDebugMessage(`Saving draft data to database/sheet...`, 'info');
      setProcessingStage('sheet');
      const saved = await saveBillToDraftSheet(draftData);

      if (!saved) {
        throw new Error('Save operation failed on server');
      }

      // 2. Generate and download DRAFT PDF only after successful save
      setSavingToSheet(false);
      setGeneratingPDF(true);
      setProcessingStage('pdf');
      addDebugMessage(`Generating DRAFT PDF...`, 'info');
      const pdfGenerated = await generateDraftPDF(draftData);

      if (!pdfGenerated) {
        addDebugMessage(`Warning: Draft was saved, but PDF generation failed`, 'warning');
      }

      // 3. Mark complete & cleanup
      addDebugMessage(`✅ Draft saved successfully: ${draftNumber}`, 'success');
      setShowSuccessAnimation(true);
      setProcessingStage('complete');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setProcessingStage(null);
        setGeneratingPDF(false);
      }, 2000);

      if (onSubmit) onSubmit(draftData);

      // Reset form after saving draft
      setBillForm({
        partyName: selectedParty?.name || "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        items: [],
        notes: ""
      });

      if (!selectedParty) setSelectedPartyState(null);

      setCurrentProduct({
        barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
        looseOperation: "add",
        brand: "", item: "", quantity: 1, totalPieces: "",
        colors: [], sizes: [], sizeQuantities: {}, colorDetails: {},
        partNo: "", rate: ""
      });

      setTempBillDataForDraft(null);
      setTempBillData(null);
      setIsEditingExistingDraft(false);
      setExistingDraftNumber(null);

      showToast(`Draft ${draftNumber} saved to database and PDF downloaded!`, 'success');

      if (barcodeInputRef.current) barcodeInputRef.current.focus();
      await fetchLotSummary();

      setIsConfirmModalOpen(false);

    } catch (error) {
      console.error("❌ Error in handleSaveAsDraft:", error);
      addDebugMessage(`❌ Draft save failed: ${error.message}`, 'error');
      showToast(`Failed to save draft: ${error.message}`, "error");
      setProcessingStage(null);
      setGeneratingPDF(false);
      setSavingToSheet(false);
    } finally {
      setIsProcessingDraft(false);
    }
  };
  const generateDraftPDF = async (draftData) => {
    if (!draftData || !draftData.items || draftData.items.length === 0) {
      console.error("Invalid draft data");
      return false;
    }

    setGeneratingPDF(true);
    setProcessingStage('pdf');

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 15;
      const rightMargin = 15;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const uniqueLots = new Set(draftData.items.map(item => item.lotNumber)).size;
      const totalItems = draftData.items.length;
      const totalQuantity = draftData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalSets = draftData.items.reduce((sum, item) => sum + (parseInt(item.sets) || 0), 0);

      const MAX_ROWS_PER_PAGE = 12;

      const drawPageBorder = () => {
        doc.setLineWidth(0.5);
        doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
        doc.setLineWidth(0.3);
      };

      const drawHeader = (yPos) => {
        // DRAFT WATERMARK BACKGROUND
        doc.setFont("times", "bold");
        doc.setFontSize(60);
        doc.setTextColor(200, 200, 200);
        doc.text("DRAFT", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
        doc.setTextColor(0, 0, 0);

        // Main title
        doc.setFont("times", "bold");
        doc.setFontSize(26);
        doc.text("Packing List (DRAFT)", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;

        // DRAFT warning
        doc.setFontSize(12);
        doc.setTextColor(255, 0, 0);
        doc.text("*** DRAFT DOCUMENT - NOT FOR DISPATCH ***", pageWidth / 2, yPos, { align: "center" });
        doc.setTextColor(0, 0, 0);
        yPos += 8;

        // Add Bill To information
        const partyName = draftData.partyName || 'N/A';
        const maxWidth = contentWidth;

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);

        if (doc.getTextWidth(partyName) > maxWidth) {
          let remainingName = partyName;
          let lines = [];

          while (remainingName.length > 0) {
            let line = "";
            for (let i = 0; i < remainingName.length; i++) {
              const testLine = line + remainingName[i];
              if (doc.getTextWidth(testLine) <= maxWidth) {
                line = testLine;
              } else {
                break;
              }
            }
            lines.push(line);
            remainingName = remainingName.substring(line.length);
          }

          for (let i = 0; i < lines.length; i++) {
            doc.text(lines[i], pageWidth / 2, yPos, { align: "center" });
            yPos += 7;
          }
          yPos += 3;
        } else {
          doc.text(partyName, pageWidth / 2, yPos, { align: "center" });
          yPos += 6;
        }

        // Draw the main box
        const boxHeight = 45;
        doc.rect(leftMargin, yPos, contentWidth, boxHeight);

        const midPoint = leftMargin + (contentWidth / 2);
        doc.line(midPoint, yPos, midPoint, yPos + boxHeight);

        // LEFT SIDE CONTENT
        const leftLabelX = leftMargin + 5;
        const leftValueX = leftMargin + 42;
        const leftMaxWidth = midPoint - leftValueX - 3;

        doc.setFont("times", "bold");
        doc.setFontSize(10);

        doc.text("Date", leftLabelX, yPos + 7);
        doc.text(":", leftLabelX + 20, yPos + 7);
        doc.setFont("times", "normal");
        doc.text(`${draftData.billDate || new Date().toLocaleDateString()}`, leftValueX, yPos + 7);

        doc.setFont("times", "bold");
        doc.text("Order Ref", leftLabelX, yPos + 14);
        doc.text(":", leftLabelX + 20, yPos + 14);
        doc.setFont("times", "normal");
        let orderRef = `${draftData.orderReference || 'N/A'}`;
        if (doc.getTextWidth(orderRef) > leftMaxWidth) {
          orderRef = orderRef.substring(0, 20) + "...";
        }
        doc.text(orderRef, leftValueX, yPos + 14);

        doc.setFont("times", "bold");
        doc.text("Doc No", leftLabelX, yPos + 21);
        doc.text(":", leftLabelX + 20, yPos + 21);
        doc.setFont("times", "normal");
        doc.text(`${draftData.packingNumber || 'N/A'}`, leftValueX, yPos + 21);

        doc.setFont("times", "bold");
        doc.text("Generated By", leftLabelX, yPos + 28);
        doc.text(":", leftLabelX + 20, yPos + 28);
        doc.setFont("times", "normal");
        const preparedByText = `${draftData.preparedBy || preparedBy}`;
        const preparedByRole = `${draftData.preparedByRole || userRole}`;
        const fullPreparedText = `${preparedByText} (${preparedByRole})`;

        if (doc.getTextWidth(fullPreparedText) > leftMaxWidth) {
          doc.text(preparedByText, leftValueX, yPos + 28);
          doc.text(`(${preparedByRole})`, leftValueX, yPos + 35);
        } else {
          doc.text(fullPreparedText, leftValueX, yPos + 28);
        }

        doc.setFont("times", "bold");
        doc.text("Document Status", leftLabelX, yPos + 35);
        doc.text(":", leftLabelX + 20, yPos + 35);
        doc.setFont("times", "bold");
        doc.setTextColor(255, 0, 0);
        doc.text("DRAFT", leftValueX, yPos + 35);
        doc.setTextColor(0, 0, 0);

        // RIGHT SIDE CONTENT
        const rightLabelX = midPoint + 5;
        const rightValueX = midPoint + 40;

        doc.setFont("times", "bold");
        doc.setFontSize(10);

        doc.text("Total Lots", rightLabelX, yPos + 7);
        doc.text(":", rightLabelX + 20, yPos + 7);
        doc.setFont("times", "normal");
        doc.text(uniqueLots.toString(), rightValueX, yPos + 7);

        doc.setFont("times", "bold");
        doc.text("Total Items", rightLabelX, yPos + 14);
        doc.text(":", rightLabelX + 20, yPos + 14);
        doc.setFont("times", "normal");
        doc.text(totalItems.toString(), rightValueX, yPos + 14);

        doc.setFont("times", "bold");
        doc.text("Total Qty", rightLabelX, yPos + 21);
        doc.text(":", rightLabelX + 20, yPos + 21);
        doc.setFont("times", "normal");
        doc.text(`${totalQuantity} PCS`, rightValueX, yPos + 21);

        doc.setFont("times", "bold");
        doc.text("Total Sets", rightLabelX, yPos + 28);
        doc.text(":", rightLabelX + 20, yPos + 28);
        doc.setFont("times", "normal");
        doc.text(totalSets.toString(), rightValueX, yPos + 28);

        doc.setFont("times", "bold");
        doc.text("Document Type", rightLabelX, yPos + 35);
        doc.text(":", rightLabelX + 20, yPos + 35);
        doc.setFont("times", "bold");
        doc.setTextColor(255, 0, 0);
        doc.text("DRAFT COPY", rightValueX, yPos + 35);
        doc.setTextColor(0, 0, 0);

        return yPos + boxHeight + 8;
      };

      const drawTableHeader = (yPos) => {
        const tableColumns = [
          { header: "S.No", width: 10 },
          { header: "Lot Number", width: 20 },
          { header: "Brand", width: 25 },
          { header: "Description", width: 50 },
          { header: "Sets", width: 17 },
          { header: "Pc/Set", width: 17 },
          { header: "Loose Pc", width: 17 },
          { header: "Total Qty", width: 23 }
        ];

        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.setFillColor(240, 240, 240);
        doc.rect(leftMargin, yPos, contentWidth, 12, 'F');
        doc.rect(leftMargin, yPos, contentWidth, 12);

        let currentX = leftMargin;
        tableColumns.forEach(col => {
          const textWidth = doc.getTextWidth(col.header);
          const textX = currentX + (col.width / 2) - (textWidth / 2);
          doc.text(col.header, textX, yPos + 8);
          currentX += col.width;
          if (currentX < pageWidth - rightMargin) {
            doc.line(currentX, yPos, currentX, yPos + 12);
          }
        });

        return yPos + 12;
      };

      const drawTableRow = (item, index, yPos) => {
        const tableColumns = [
          { width: 10 }, { width: 20 }, { width: 25 }, { width: 50 },
          { width: 17 }, { width: 17 }, { width: 17 }, { width: 23 }
        ];

        const rowHeight = 12;
        doc.rect(leftMargin, yPos, contentWidth, rowHeight);

        let colX = leftMargin;
        tableColumns.forEach(col => {
          colX += col.width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + rowHeight);
          }
        });

        const values = [
          (index + 1).toString(),
          item.lotNumber || "",
          item.brand || "",
          (() => {
            let description = item.description || "";
            const maxChars = 33;
            if (description.length > maxChars) {
              description = description.substring(0, maxChars - 3) + "...";
            }
            return description;
          })(),
          (item.sets || 0).toString(),
          (item.setsPerPcs || 0).toString(),
          (item.loosePcs || 0).toString(),
          (item.quantity || 0).toString()
        ];

        doc.setFont("times", "normal");
        doc.setFontSize(10);

        let textX = leftMargin;
        values.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (tableColumns[colIndex].width / 2) - (textWidth / 2);
          doc.text(value, textXPos, yPos + 8);
          textX += tableColumns[colIndex].width;
        });

        return rowHeight;
      };

      const drawTableFooter = (yPos, isLastPage) => {
        yPos += 5;
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);

        if (isLastPage) {
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text("*** DRAFT DOCUMENT - NOT VALID FOR DISPATCH ***", pageWidth / 2, yPos + 7, { align: "center" });
          doc.setTextColor(0, 0, 0);
        }

        return yPos + 18;
      };

      const drawSignatures = (yPos) => {
        const footerY = pageHeight - 25;
        doc.setFont("times", "bold");
        doc.setFontSize(10);

        doc.setLineWidth(0.3);

        const sectionWidth = (contentWidth - 20) / 4;
        let currentX = leftMargin;

        doc.text("Prepared By", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(8);
        doc.text(`${draftData.preparedBy || preparedBy} (${draftData.preparedByRole || userRole})`, currentX + 5, footerY + 9);

        currentX += sectionWidth;
        doc.setFontSize(10);
        doc.text("Account Officer", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(8);
        doc.text("(Name & Signature)", currentX + 5, footerY + 9);

        currentX += sectionWidth;
        doc.setFontSize(10);
        doc.text("Checked By", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, currentX + sectionWidth - 5, footerY + 3);
        doc.setFontSize(8);
        doc.text("(Name & Signature)", currentX + 5, footerY + 9);

        currentX += sectionWidth;
        doc.setFontSize(10);
        doc.text("Authorized Signatory", currentX + 5, footerY);
        doc.line(currentX + 5, footerY + 3, pageWidth - rightMargin - 5, footerY + 3);
        doc.setFontSize(8);
        doc.text("(Name & Signature)", currentX + 5, footerY + 9);

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text("DRAFT COPY - For review only", pageWidth / 2, footerY - 18, { align: "center" });
        doc.setTextColor(0, 0, 0);
      };

      // Generate pages
      let itemsProcessed = 0;
      let pageCount = 0;

      while (itemsProcessed < draftData.items.length) {
        const remainingRows = draftData.items.length - itemsProcessed;
        const rowsOnThisPage = Math.min(MAX_ROWS_PER_PAGE, remainingRows);
        const isLastPage = (itemsProcessed + rowsOnThisPage) === draftData.items.length;

        let yPos = 15;

        if (pageCount > 0) {
          doc.addPage();
        }

        drawPageBorder();
        yPos = drawHeader(yPos);
        yPos = drawTableHeader(yPos);

        for (let i = 0; i < rowsOnThisPage; i++) {
          const item = draftData.items[itemsProcessed];
          const rowHeight = drawTableRow(item, itemsProcessed, yPos);
          yPos += rowHeight;
          itemsProcessed++;
        }

        yPos = drawTableFooter(yPos, isLastPage);

        if (isLastPage) {
          drawSignatures(yPos);
        } else {
          yPos += 5;
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text("... continued on next page", pageWidth / 2, yPos, { align: "center" });
          doc.setTextColor(0, 0, 0);
        }

        pageCount++;
      }

      // Add page numbers
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${totalPages} - DRAFT`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        doc.setTextColor(0, 0, 0);
      }

      const fileName = `DRAFT_${draftData.packingNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      return true;

    } catch (error) {
      console.error("Draft PDF Generation Error:", error);
      return false;
    }
  };


  const handleFinalSubmission = async () => {
    if (!tempBillData) {
      showToast("No bill data to submit", "error");
      return;
    }

    if (savingToSheet || generatingPDF) {
      console.warn("⚠️ Final submission process already in progress, ignoring duplicate click");
      return;
    }

    // 🔍 DEBUG: Log tempBillData before processing
    console.log("🔍 tempBillData items:", tempBillData.items);
    console.log("🔍 First item PartNo:", tempBillData.items[0]?.partNo);
    console.log("🔍 First item Rate:", tempBillData.items[0]?.rate);
    addDebugMessage(`📊 Processing ${tempBillData.items.length} items for final submission`, 'info');

    // 1. Show Database Saving Loading State First
    setSavingToSheet(true);
    setGeneratingPDF(false);
    setProcessingStage('sheet');

    try {
      const packingNumber = await getNextPackingNumber('PL');

      // 🔍 DEBUG: Map items and log each one
      const mappedItems = tempBillData.items.map((item, index) => {
        const mappedItem = {
          id: item.id,
          barcode: item.barcode,
          lotNumber: item.lotNumber,
          brand: item.brand,
          description: item.description,
          sets: item.sets,
          setsPerPcs: item.setsPerPcs,
          loosePcs: item.loosePcs,
          looseOperation: item.looseOperation || "add",
          quantity: item.quantity,
          colors: item.colors,
          sizes: item.sizes,
          partNo: item.partNo || "",
          rate: item.rate || "",
          priceList: item.priceList || ""
        };

        // 🔍 DEBUG: Log each mapped item
        console.log(`📦 Item ${index + 1} mapped:`, {
          description: mappedItem.description,
          partNo: mappedItem.partNo,
          rate: mappedItem.rate
        });
        addDebugMessage(`📦 Item ${index + 1}: ${mappedItem.description}, PartNo: ${mappedItem.partNo || 'N/A'}, Rate: ${mappedItem.rate || 'N/A'}`, 'info');

        return mappedItem;
      });

      const packingDataForStorage = {
        billNumber: packingNumber,
        packingNumber: packingNumber,
        partyName: selectedPartyState?.name || tempBillData.partyName,
        billDate: tempBillData.billDate,
        dueDate: tempBillData.dueDate,
        orderReference: tempBillData.orderReference || "",
        items: mappedItems,
        notes: tempBillData.notes,
        createdDate: new Date().toISOString(),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        status: 'FINAL',
        documentType: 'FINAL'
      };

      // 🔍 DEBUG: Log complete data being sent
      console.log("📤 Sending to server:", JSON.stringify(packingDataForStorage, null, 2));
      addDebugMessage(`📤 Saving ${packingDataForStorage.items.length} items to database...`, 'info');

      // 2. STORE IN DATABASE FIRST
      const saved = await saveBillToGoogleSheet(packingDataForStorage);

      if (!saved) {
        throw new Error('Failed to save bill to database / Google Sheets');
      }

      // 3. ONLY AFTER SUCCESSFUL STORAGE: GENERATE & DOWNLOAD PDF
      setSavingToSheet(false);
      setGeneratingPDF(true);
      setProcessingStage('pdf');
      addDebugMessage(`✅ Stored in database! Generating & downloading PDF...`, 'success');

      const pdfGenerated = await generatePackingList(packingDataForStorage);

      if (!pdfGenerated) {
        throw new Error('Bill was saved in database, but PDF generation failed');
      }

      // 4. Success animation and cleanup
      setShowSuccessAnimation(true);
      setProcessingStage('complete');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setProcessingStage(null);
        setGeneratingPDF(false);
      }, 2000);

      if (onSubmit) onSubmit(packingDataForStorage);

      // Reset form
      setBillForm({
        partyName: selectedParty?.name || "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        items: [],
        notes: ""
      });

      if (!selectedParty) setSelectedPartyState(null);

      setCurrentProduct({
        barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
        looseOperation: "add",
        brand: "", item: "", quantity: 1, totalPieces: "",
        colors: [], sizes: [], sizeQuantities: {}, colorDetails: {},
        partNo: "", rate: ""
      });

      setTempBillData(null);
      setTempBillDataForDraft(null);

      showToast(`Bill ${packingNumber} saved to database and PDF downloaded!`, 'success');

      if (barcodeInputRef.current) barcodeInputRef.current.focus();
      await fetchLotSummary();

      setIsConfirmModalOpen(false);

    } catch (error) {
      console.error("❌ Error in handleFinalSubmission:", error);
      addDebugMessage(`❌ Final submission failed: ${error.message}`, 'error');
      showToast(`Failed to save: ${error.message}`, "error");
      setProcessingStage(null);
      setGeneratingPDF(false);
      setSavingToSheet(false);
    }
  };
  // ==================== LOT DETAILS FUNCTIONS ====================

  const fetchLotDetails = async (lotNumber) => {
    setLoadingLotDetails(true);
    setSelectedLotForDetails(lotNumber);
    addDebugMessage(`Fetching details for lot: ${lotNumber}`);

    try {
      const billsData = await fetchBillsFromSheet();

      if (!billsData || billsData.length === 0) {
        addDebugMessage("No bills data found", 'warning');
        setLotDetailsData([]);
        return;
      }

      const lotDispatches = [];

      billsData.forEach(bill => {
        if (bill['Bill Data (JSON)']) {
          const billData = safeJsonParse(bill['Bill Data (JSON)']);
          if (billData && billData.items) {
            const matchingItems = billData.items.filter(item =>
              item.lotNumber === lotNumber
            ) || [];

            if (matchingItems.length > 0) {
              matchingItems.forEach(item => {
                lotDispatches.push({
                  packingNumber: billData.packingNumber,
                  partyName: billData.partyName,
                  dispatchDate: billData.billDate || billData.createdDate?.split('T')[0] || 'N/A',
                  quantity: item.quantity,
                  sets: item.sets || 0,
                  setsPerPcs: item.setsPerPcs || 0,
                  loosePcs: item.loosePcs || 0,
                  description: item.description,
                  brand: item.brand || '',
                  preparedBy: billData.preparedBy || 'Unknown'
                });
              });
            }
          }
        }
      });

      lotDispatches.sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate));

      setLotDetailsData(lotDispatches);
      addDebugMessage(`Found ${lotDispatches.length} dispatches for lot ${lotNumber}`, 'success');

    } catch (error) {
      console.error("Error fetching lot details:", error);
      addDebugMessage(`Failed to load lot details: ${error.message}`, 'error');
      setLotDetailsData([]);
    } finally {
      setLoadingLotDetails(false);
    }
  };

  const fetchBillsFromSheet = async () => {
    try {
      const API_KEY = GOOGLE_API_KEY;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${BILLS_SHEET_ID}/values/${BILLS_SHEET_NAME}?key=${API_KEY}`;

      addDebugMessage(`Fetching bills from: ${apiUrl}`, 'info');

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      addDebugMessage(`Sheet response received, rows: ${result.values?.length || 0}`, 'info');

      if (result.values && result.values.length > 1) {
        const headers = result.values[0];
        addDebugMessage(`Headers: ${headers.join(', ')}`, 'info');

        const rows = result.values.slice(1);

        const bills = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        addDebugMessage(`Parsed ${bills.length} bills from sheet`, 'success');
        return bills;
      }

      addDebugMessage(`No data found in sheet`, 'warning');
      return [];
    } catch (error) {
      console.error("Error fetching bills:", error);
      addDebugMessage(`Failed to fetch bills: ${error.message}`, 'error');
      return [];
    }
  };

  // ==================== LOT SUMMARY FUNCTIONS ====================

  const fetchLotSummaryWithData = async (allProductData) => {
    setLoadingLotSummary(true);
    addDebugMessage("Fetching lot summary from Bills sheet...");

    try {
      const billsData = await fetchBillsFromSheet();

      // Map to track dispatched quantities by PARENT lot
      const dispatchedMap = new Map();

      if (billsData && billsData.length > 0) {
        billsData.forEach(bill => {
          if (bill['Bill Data (JSON)']) {
            const billData = safeJsonParse(bill['Bill Data (JSON)']);
            if (billData && billData.items) {
              billData.items.forEach(item => {
                const lotNumber = item.lotNumber;
                if (lotNumber) {
                  // Get parent lot for grouping
                  const parentLot = getParentLotNumber(lotNumber);
                  const dispatchedQty = item.quantity || 0;
                  dispatchedMap.set(parentLot, (dispatchedMap.get(parentLot) || 0) + dispatchedQty);
                  addDebugMessage(`Dispatched: ${parentLot} (+${dispatchedQty}) from lot ${lotNumber}`, 'info');
                }
              });
            }
          }
        });
      }

      addDebugMessage(`Dispatched totals by parent lot: ${JSON.stringify(Object.fromEntries(dispatchedMap))}`, 'info');

      const summary = [];
      const processedLots = new Set();

      // FIRST: Group all products by parent lot number
      const groupedProducts = new Map();

      allProductData.forEach(product => {
        const lotNumber = product['Lot Number'];
        if (!lotNumber) return;

        const parentLot = getParentLotNumber(lotNumber);

        if (!groupedProducts.has(parentLot)) {
          groupedProducts.set(parentLot, []);
        }
        groupedProducts.get(parentLot).push(product);
      });

      addDebugMessage(`Grouped into ${groupedProducts.size} parent lots`, 'info');

      // Process each parent lot
      for (const [parentLot, products] of groupedProducts) {
        if (processedLots.has(parentLot)) continue;
        processedLots.add(parentLot);

        // Calculate total pieces from ALL sub-lots
        let totalPieces = 0;
        let itemName = '';
        let brand = '';
        let isOldLot = false;
        let allColors = [];
        let allSizes = [];
        let partNo = '';
        let rate = '';

        products.forEach(product => {
          // Calculate pieces for this sub-lot
          let pieces = product['Total Pieces'];
          if (!pieces || pieces === 0) {
            const piecesPerSet = parseInt(product['Pieces Per Set']) || 0;
            const numberOfSets = parseInt(product['Number of Sets']) || parseInt(product['Total Sets']) || 0;
            pieces = piecesPerSet * numberOfSets;
          }
          totalPieces += Number(pieces) || 0;

          // Use first product's details for display
          if (!itemName) {
            itemName = product['Garment Type'] || product['Item Name'] || '';
            brand = product['Party Name'] || product['Brand'] || '';
            isOldLot = product['Source'] === 'OLD LOT';
          }
          if (!partNo) {
            partNo = extractPartNo(product);
          }
          if (!rate) {
            rate = extractRate(product);
          }

          // Collect all colors and sizes
          if (product['Colors']) {
            let colors = product['Colors'];
            if (typeof colors === 'string') {
              try { colors = JSON.parse(colors); } catch (e) { colors = []; }
            }
            allColors = [...new Set([...allColors, ...colors])];
          }

          if (product['Sizes']) {
            let sizes = product['Sizes'];
            if (typeof sizes === 'string') {
              try { sizes = JSON.parse(sizes); } catch (e) { sizes = []; }
            }
            allSizes = [...new Set([...allSizes, ...sizes])];
          }
        });

        const dispatchedQty = dispatchedMap.get(parentLot) || 0;
        const availablePieces = isOldLot ? Infinity : Math.max(0, totalPieces - dispatchedQty);

        let status = 'PENDING';
        if (isOldLot) {
          status = 'OLD STOCK';
        } else if (totalPieces > 0) {
          if (availablePieces <= 0) status = 'COMPLETED';
          else if (dispatchedQty > 0) status = 'PARTIAL';
        }

        summary.push({
          lotNumber: parentLot,
          subLots: products.map(p => p['Lot Number']), // Store sub-lot numbers
          totalPieces: totalPieces,
          dispatchedQty: dispatchedQty,
          pendingPieces: isOldLot ? 0 : Math.max(0, totalPieces - dispatchedQty),
          availablePieces: availablePieces,
          status: status,
          isOldLot: isOldLot,
          itemName: itemName,
          brand: brand,
          colors: allColors,
          sizes: allSizes,
          partNo: partNo,
          rate: rate
        });

        addDebugMessage(`Parent Lot ${parentLot}: PartNo=${partNo || 'N/A'}, Total=${totalPieces} (from ${products.length} sub-lots), Dispatched=${dispatchedQty}, Available=${availablePieces === Infinity ? '∞' : availablePieces}, Status=${status}`, 'success');
      }

      // SECOND: Add any lots that appear only in dispatches (not in product database)
      for (const [parentLot, dispatchedQty] of dispatchedMap) {
        if (!processedLots.has(parentLot)) {
          summary.push({
            lotNumber: parentLot,
            subLots: [],
            totalPieces: 0,
            dispatchedQty: dispatchedQty,
            pendingPieces: 0,
            availablePieces: 0,
            status: 'COMPLETED',
            isOldLot: false,
            itemName: 'Unknown',
            brand: 'Unknown'
          });
          addDebugMessage(`Dispatch-only parent lot ${parentLot}: Dispatched=${dispatchedQty}`, 'info');
        }
      }

      // Sort summary: OLD STOCK first, then PENDING, PARTIAL, COMPLETED
      const statusOrder = { 'OLD STOCK': 0, 'PENDING': 1, 'PARTIAL': 2, 'COMPLETED': 3 };
      summary.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

      setLotSummary(summary);
      const withPartNoCount = summary.filter(s => s.partNo).length;
      addDebugMessage(`✅ Loaded summary for ${summary.length} parent lots (${withPartNoCount} with Part No)`, 'success');

    } catch (error) {
      console.error("Error fetching lot summary:", error);
      addDebugMessage(`Failed to load lot summary: ${error.message}`, 'error');
    } finally {
      setLoadingLotSummary(false);
    }
  };
  const fetchLotSummary = async () => {
    const allData = [...sheetData, ...oldLotData];
    await fetchLotSummaryWithData(allData);
  };

  const checkLotAvailability = (lotNumber, requestedQty) => {
    const parentLot = getParentLotNumber(lotNumber);
    const lot = lotSummary.find(l => l.lotNumber === parentLot);
    if (!lot) {
      return { available: true, message: "New lot - no previous dispatches" };
    }

    if (lot.isOldLot) {
      return { available: true, message: "Old stock - no restrictions" };
    }

    if (requestedQty > lot.availablePieces) {
      return {
        available: false,
        message: `Only ${lot.availablePieces} pieces available for parent lot ${parentLot}. Requested: ${requestedQty}`,
        availablePieces: lot.availablePieces
      };
    }

    return { available: true, message: "Available for dispatch" };
  };

  const getLotInfo = (lotNumber) => {
    if (!lotNumber) return null;
    const parentLot = getParentLotNumber(lotNumber);
    return lotSummary.find(l => l.lotNumber === parentLot);
  };
  // ==================== BARCODE SCANNER FUNCTIONS ====================

  const normalizeBarcode = (barcode) => {
    if (!barcode) return barcode;

    const barcodeStr = barcode.toString().trim();
    let normalized = barcodeStr;

    if (barcodeStr.toLowerCase().startsWith('ot-')) {
      normalized = 'LOT-' + barcodeStr.substring(3);
    }
    else if (barcodeStr.toLowerCase().startsWith('lot') && !barcodeStr.toLowerCase().startsWith('lot-')) {
      normalized = 'LOT-' + barcodeStr.substring(3);
    }
    else if (/^\d{5}-\d+$/.test(barcodeStr)) {
      normalized = 'LOT-' + barcodeStr;
    }
    else if (barcodeStr.toLowerCase().startsWith('ot') && !barcodeStr.toLowerCase().startsWith('ot-')) {
      normalized = 'LOT-' + barcodeStr.substring(2);
    }

    return normalized;
  };

  const addDebugMessage = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setScannerDebug(prev => [...prev, { timestamp, message, type }].slice(-20));
    // console.log(`[Scanner Debug ${timestamp}]:`, message);
  };

  const getMockData = () => {
    return [
      {
        'Barcode ID': 'LOT-61105-1775474477729',
        'Lot Number': '61105',
        'Party Name': 'Fashion Hub',
        'Garment Type': 'Premium T-Shirt',
        'Colors': ['Red', 'Blue', 'Black'],
        'Sizes': ['S', 'M', 'L', 'XL'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Fashion Hub',
        'Item Name': 'Premium T-Shirt',
        'Pieces Per Set': 5,
        'Number of Sets': 100,
        'Total Pieces': 500
      },
      {
        'Barcode ID': 'LOT-78901-1234567890123',
        'Lot Number': '78901',
        'Party Name': 'Style Mart',
        'Garment Type': 'Slim Fit Jeans',
        'Colors': ['Blue', 'Black'],
        'Sizes': ['30', '32', '34', '36'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Style Mart',
        'Item Name': 'Slim Fit Jeans',
        'Pieces Per Set': 1,
        'Number of Sets': 300,
        'Total Pieces': 300
      },
      {
        'Barcode ID': 'LOT-56789-9876543210987',
        'Lot Number': '56789',
        'Party Name': 'Elegant Wear',
        'Garment Type': 'Formal Shirt',
        'Colors': ['White', 'Blue', 'Pink'],
        'Sizes': ['S', 'M', 'L', 'XL', 'XXL'],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Brand': 'Elegant Wear',
        'Item Name': 'Formal Shirt',
        'Pieces Per Set': 3,
        'Number of Sets': 150,
        'Total Pieces': 450
      }
    ];
  };

  const fetchOldLotData = async () => {
    addDebugMessage("Fetching OLD LOT data from Google Sheets...");

    try {
      let oldLotDataArray = [];

      const API_KEY = GOOGLE_API_KEY;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${OLD_LOT_SHEET_NAME}?key=${API_KEY}`;

      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const result = await response.json();
          if (result.values && result.values.length > 1) {
            oldLotDataArray = parseOldLotSheetData(result.values);
            addDebugMessage(`Loaded ${oldLotDataArray.length} products from OLD LOT sheet`, 'success');
          } else {
            addDebugMessage(`OLD LOT sheet is empty`, 'warning');
          }
        } else {
          addDebugMessage(`Failed to fetch OLD LOT sheet: ${response.status}`, 'warning');
        }
      } catch (apiError) {
        addDebugMessage(`Error fetching OLD LOT sheet: ${apiError.message}`, 'warning');
      }

      setOldLotData(oldLotDataArray);
      debugOldLotData();
      return oldLotDataArray;

    } catch (error) {
      console.error("Error fetching OLD LOT data:", error);
      addDebugMessage(`Failed to load OLD LOT data: ${error.message}`, 'error');
      return [];
    }
  };

  const parseOldLotSheetData = (values) => {
    if (!values || values.length < 2) return [];

    const headers = values[0];
    addDebugMessage(`OLD LOT sheet headers: ${headers.join(', ')}`, 'info');

    // Dynamically find indices with hardcoded fallback defaults matching OLD LOTS sheet layout (C: PartNo, D: LotNo, E: Rate)
    let partNoIndex = headers.findIndex(h => {
      if (!h) return false;
      const clean = h.toString().trim().toUpperCase().replace(/[\.\_\-\#]/g, ' ').replace(/\s+/g, ' ');
      return clean === 'PART NO' || clean === 'PARTNO' || clean === 'PART NUMBER' || clean === 'PART';
    });
    if (partNoIndex === -1) partNoIndex = 2; // Column C

    let lotNumberIndex = headers.findIndex(h => {
      if (!h) return false;
      const clean = h.toString().trim().toUpperCase().replace(/[\.\_\-\#]/g, ' ').replace(/\s+/g, ' ');
      return clean === 'LOT NUMBER' || clean === 'LOT NO' || clean === 'LOT' || clean === 'LOTNUMBER';
    });
    if (lotNumberIndex === -1) lotNumberIndex = 3; // Column D

    let rateIndex = headers.findIndex(h => {
      if (!h) return false;
      const clean = h.toString().trim().toUpperCase().replace(/[\.\_\-]/g, ' ').replace(/\s+/g, ' ');
      return clean === 'RATE' || clean === 'UNIT RATE' || clean === 'PRICE';
    });
    if (rateIndex === -1) rateIndex = 4; // Column E

    addDebugMessage(`OLD LOT Column indices -> PartNo: Col ${partNoIndex + 1}, LotNo: Col ${lotNumberIndex + 1}, Rate: Col ${rateIndex + 1}`, 'info');

    const rows = values.slice(1);
    const parsedProducts = [];

    rows.forEach((row, idx) => {
      let combinedData = row[0] || '';
      let directLotNumber = (row[lotNumberIndex] !== undefined && row[lotNumberIndex] !== null) ? String(row[lotNumberIndex]).trim() : '';
      let partNoVal = (row[partNoIndex] !== undefined && row[partNoIndex] !== null) ? String(row[partNoIndex]).trim() : '';
      let rateVal = (row[rateIndex] !== undefined && row[rateIndex] !== null) ? String(row[rateIndex]).trim() : '1';

      if (!combinedData && !directLotNumber) return;

      let lotNumber = directLotNumber;
      let remainingDescription = combinedData;

      if (!lotNumber) {
        const lotMatch = combinedData.match(/^([A-Z0-9\-/]+)\s+(.+)$/);
        if (lotMatch) {
          lotNumber = lotMatch[1].trim();
          remainingDescription = lotMatch[2].trim();
        } else {
          const firstWord = combinedData.split(/\s+/)[0];
          if (firstWord && /[A-Z0-9\-/]/.test(firstWord)) {
            lotNumber = firstWord;
            remainingDescription = combinedData.substring(firstWord.length).trim();
          }
        }
      }

      if (!lotNumber) return;

      let itemName = '';
      let brand = '';
      let piecesPerSet = 0;

      if (row[1]) {
        const setMatch = String(row[1]).match(/(\d+)/);
        if (setMatch) piecesPerSet = parseInt(setMatch[1], 10) || 0;
      }

      if (remainingDescription) {
        // 1. Strip lot number from front of description if present (e.g. "11200 NICKER UNDER ARMOUR GENTS 4S")
        if (lotNumber) {
          const escapedLot = lotNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const lotRegex = new RegExp(`^${escapedLot}\\s*[-:_]*\\s*`, 'i');
          remainingDescription = remainingDescription.replace(lotRegex, '').trim();
        }

        // 2. Parse trailing set size (e.g. "4S", "5S", "10S")
        const pcsMatch = remainingDescription.match(/(\d+)\s*[Ss]$/);
        if (pcsMatch) {
          if (!piecesPerSet) piecesPerSet = parseInt(pcsMatch[1], 10);
          remainingDescription = remainingDescription.replace(/\s*\d+\s*[Ss]$/, '').trim();
        }

        // 3. Multi-word brand list (checked first to capture full brands like "UNDER ARMOUR", "THE NORTH FACE", "LOUIS VUITTON")
        const multiWordBrands = [
          'UNDER ARMOUR', 'THE NORTH FACE', 'LOUIS VUITTON', 'YVES SAINT LAURENT',
          'SAINT LAURENT', 'BOTTEGA VENETA', 'ALEXANDER MCQUEEN', 'OFF WHITE', 'OFF-WHITE',
          'DOLCE & GABBANA', 'DOLCE AND GABBANA', 'CALVIN KLEIN', 'TOMMY HILFIGER',
          'RALPH LAUREN', 'R.L. POLO', 'HUGO BOSS', 'MICHAEL KORS', 'KATE SPADE',
          'BROOKS BROTHERS', 'NEW BALANCE', 'OLD NAVY', 'TRUE RELIGION', 'FEAR OF GOD',
          'A BATHING APE', 'ANTI SOCIAL SOCIAL CLUB', 'AMERICAN EAGLE', 'JACK & JONES',
          'VERO MODA', 'ALLEN SOLLY', 'PETER ENGLAND', 'LOUIS PHILIPPE', 'VAN HEUSEN',
          'W FOR WOMAN', 'LORO PIANA', 'FASHION FACTORY', 'R. L. POLO', 'SCUFFERS', 'ADIDAS', 'NIKE', 'HUGO', 'LACOSTE', 'GUCCI', 'DIOR', 'TOMMY', 'COACH', 'ARMANI', 'GANT', 'MONCLER', 'BURBERRY', 'C.K', 'HOLISTER', 'FENDI', 'EDGE', 'PRADA', 'VALENTINO', 'GIVENCHY', 'AMIRI', 'HOODRICH', 'ZARA', 'UNIQLO', 'FOREVER 21', 'BERSHKA', 'STRADIVARIUS', 'MANGO', 'TOPSHOP', 'NEXT', 'GAP', 'PRIMARK', 'LEVIS', 'LEE', 'WRANGLER', 'DIESEL', 'G-STAR', 'SUPREME', 'BAPE', 'PALACE', 'STUSSY', 'CARHARTT', 'KITH', 'VLONE', 'ABERCROMBIE', 'HOLLISTER', 'SUPERDRY', 'ONLY', 'GANT', 'FABINDIA', 'BIBA', 'MANYAVAR', 'RAYMOND', 'BLACKBERRYS', 'MUFTI', 'SPYKAR', 'JOR', 'PANDA'
        ];

        let upperDesc = remainingDescription.toUpperCase();
        for (const mwBrand of multiWordBrands) {
          if (upperDesc.includes(mwBrand)) {
            brand = mwBrand;
            const regexMw = new RegExp(mwBrand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            remainingDescription = remainingDescription.replace(regexMw, '').replace(/\s+/g, ' ').trim();
            break;
          }
        }

        // 4. Single-word brand list (if multi-word brand not found)
        if (!brand) {
          const singleWordBrands = [
            'ADIDAS', 'NIKE', 'PUMA', 'REEBOK', 'GYMSHARK', 'ASICS', 'FILA', 'COLUMBIA',
            'PATAGONIA', 'SALOMON', 'DECATHLON', 'KAPPA', 'UMBRO', 'JORDAN', 'SKECHERS',
            'LACOSTE', 'EDGE', 'GUCCI', 'HERMES', 'PRADA', 'VERSACE', 'FENDI', 'BURBERRY',
            'ARMANI', 'VALENTINO', 'GIVENCHY', 'AMIRI', 'HOODRICH', 'ZARA', 'UNIQLO',
            'FOREVER 21', 'BERSHKA', 'STRADIVARIUS', 'MANGO', 'TOPSHOP', 'NEXT', 'GAP',
            'PRIMARK', 'LEVIS', 'LEE', 'WRANGLER', 'DIESEL', 'G-STAR', 'SUPREME', 'BAPE',
            'PALACE', 'STUSSY', 'CARHARTT', 'KITH', 'VLONE', 'ABERCROMBIE', 'HOLLISTER',
            'SUPERDRY', 'ONLY', 'GANT', 'FABINDIA', 'BIBA', 'MANYAVAR', 'RAYMOND',
            'BLACKBERRYS', 'MUFTI', 'SPYKAR', 'JOR', 'PANDA', 'PRADA', 'HOLISTER'
          ];

          const words = remainingDescription.split(/\s+/);
          let brandIndex = -1;

          for (let i = 0; i < words.length; i++) {
            const cleanWord = words[i].toUpperCase().replace(/[.,!?;:()]/g, '');
            if (singleWordBrands.includes(cleanWord)) {
              brandIndex = i;
              brand = words[i].toUpperCase();
              break;
            }
          }

          if (brandIndex !== -1) {
            words.splice(brandIndex, 1);
            remainingDescription = words.join(' ').trim();
          }
        }

        itemName = remainingDescription;
      }

      if (!itemName) itemName = `Lot ${lotNumber}`;
      if (!brand) brand = '---';
      if (piecesPerSet === 0) piecesPerSet = 5;

      const oldLotObj = {
        'Lot Number': lotNumber,
        'Barcode ID': `LOT-${lotNumber}`,
        'Brand': brand,
        'Item Name': itemName,
        'Garment Type': itemName,
        'Pieces Per Set': piecesPerSet,
        'Number of Sets': 1,
        'Total Pieces': 0,
        'Party Name': brand,
        'Colors': [],
        'Sizes': [],
        'Status': 'Available',
        'Quality Status': 'Passed',
        'Source': 'OLD LOT',
        'Raw Description': combinedData,
        'PART NO.': partNoVal,
        'PartNo': partNoVal,
        'partNo': partNoVal,
        'RATE': rateVal,
        'rate': rateVal
      };

      parsedProducts.push(oldLotObj);
    });

    if (parsedProducts.length > 0) {
      const sampleLogs = parsedProducts.slice(0, 5).map(p => `Lot ${p['Lot Number']} -> PartNo: "${p.partNo}"`).join(' | ');
      addDebugMessage(`📋 OLD LOT Sample Parsed: ${sampleLogs}`, 'success');
    }

    addDebugMessage(`Total OLD LOT products parsed: ${parsedProducts.length}`, 'success');
    return parsedProducts;
  };

  const fetchGoogleSheetData = async () => {
    setLoading(true);
    setDataLoadError(false);
    addDebugMessage("Fetching product database...");

    try {
      let data = null;

      const API_KEY = GOOGLE_API_KEY;
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;

      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const result = await response.json();
          if (result.values && result.values.length > 1) {
            data = parseSheetData(result.values);
            const withPartNo = data.filter(p => p.partNo || extractPartNo(p)).length;
            addDebugMessage(`Loaded ${data.length} products from API (${withPartNo} with Part No)`, 'success');
          }
        }
      } catch (apiError) {
        addDebugMessage(`API failed: ${apiError.message}`, 'error');
      }

      if (!data) {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
        const csvResponse = await fetch(csvUrl);

        if (csvResponse.ok) {
          const csvText = await csvResponse.text();
          data = parseCSV(csvText);
          addDebugMessage(`Loaded ${data.length} products from CSV`);
        }
      }

      if (!data || data.length === 0) {
        addDebugMessage("Using mock data", 'warning');
        data = getMockData();
        showToast("Using demo data. Could not connect to Google Sheets.", "warning");
      }

      setSheetData(data);

      // Fetch old lot data
      const oldLotProducts = await fetchOldLotData();
      const oldWithPartNo = oldLotProducts.filter(p => p.partNo || extractPartNo(p)).length;
      addDebugMessage(`Loaded ${oldLotProducts.length} products from OLD LOT sheet (${oldWithPartNo} with Part No)`, 'success');

      const allData = [...data, ...oldLotProducts];
      showToast(`Loaded ${data.length} products + ${oldLotProducts.length} old lots = ${allData.length} total`, "success");

      await fetchLotSummaryWithData(allData);

    } catch (error) {
      console.error("Error fetching data:", error);
      const mockData = getMockData();
      setSheetData(mockData);
      setDataLoadError(true);
      showToast("Using demo data", "warning");

      const oldLotProducts = await fetchOldLotData();
      const allData = [...mockData, ...oldLotProducts];
      await fetchLotSummaryWithData(allData);
    } finally {
      setLoading(false);
    }
  };
  // Add this function to debug old lot data
  const debugOldLotData = () => {
    // console.log("Old Lot Data:", oldLotData);
    // console.log("Old Lot Count:", oldLotData.length);
    oldLotData.forEach(lot => {
      // console.log(`Lot: ${lot['Lot Number']}, Description: ${lot['Garment Type'] || lot['Item Name']}, Brand: ${lot['Party Name'] || lot['Brand']}`);
    });
    addDebugMessage(`Debug: ${oldLotData.length} old lots loaded`, 'info');

    // Log first 5 lots for inspection
    const firstFive = oldLotData.slice(0, 5);
    firstFive.forEach(lot => {
      addDebugMessage(`Old lot example: ${lot['Lot Number']} - ${lot['Garment Type'] || lot['Item Name']}`, 'info');
    });
  };

  const parseSheetData = (values) => {
    if (!values || values.length < 2) return [];

    const headers = values[0];
    // console.log("Sheet headers:", headers);
    addDebugMessage(`Sheet headers: ${headers.join(', ')}`, 'info');

    const rows = values.slice(1);
    const parsedList = [];

    rows.forEach(row => {
      const obj = {};
      headers.forEach((header, index) => {
        let value = row[index] || '';
        if (value && (value.startsWith('[') || value.startsWith('{'))) {
          try { value = JSON.parse(value); } catch (e) { }
        }
        obj[header] = value;
        if (header && header.trim()) {
          obj[header.trim()] = value;
        }
      });

      // Compute normalized partNo and rate properties directly on the product object
      obj.partNo = extractPartNo(obj);
      obj.rate = extractRate(obj);

      if (obj['Lot Number']) {
        parsedList.push(obj);
      }
    });

    return parsedList;
  };

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());

    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = [];
        let currentValue = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, ''));

        const row = {};
        headers.forEach((header, index) => {
          let value = values[index] || '';
          if (value && (value.startsWith('[') || value.startsWith('{'))) {
            try { value = JSON.parse(value); } catch (e) { }
          }
          row[header] = value;
        });
        return row;
      })
      .filter(row => row['Lot Number'] && row['Lot Number'] !== '');
  };

  const searchProductByBarcode = (barcode) => {
    addDebugMessage(`Searching for: "${barcode}"`);

    const normalizedBarcode = normalizeBarcode(barcode);
    const allProducts = [...sheetData, ...oldLotData];

    if (allProducts.length === 0) {
      addDebugMessage("Database empty!", 'error');
      return null;
    }

    const product = allProducts.find(item => {
      const itemBarcode = item['Barcode ID']?.toString();
      const itemLot = item['Lot Number']?.toString();
      const searchTerm = barcode.toString();
      const normalizedSearch = normalizedBarcode.toString();

      return itemBarcode === searchTerm ||
        itemLot === searchTerm ||
        itemBarcode === normalizedSearch ||
        itemLot === normalizedSearch;
    });

    if (product) {
      addDebugMessage(`Found: ${product['Garment Type'] || product['Item Name']} (Source: ${product['Source'] || 'Main Sheet'})`, 'success');
    } else {
      addDebugMessage(`Not found: "${barcode}"`, 'error');
    }

    return product;
  };
  // Packing Materials Modal Component
  // const PackingMaterialsModal = () => {
  //   const [localMaterials, setLocalMaterials] = useState({
  //     totalBoxes: packingMaterials.totalBoxes,
  //     totalBags: packingMaterials.totalBags,
  //     totalPolybags: packingMaterials.totalPolybags
  //   });

  //   const handleConfirm = () => {
  //     // Update the parent state first
  //     setPackingMaterials(localMaterials);
  //     // Close modal
  //     setIsPackingMaterialsModalOpen(false);
  //     // Call final submission after a small delay to ensure state is updated
  //     setTimeout(() => {
  //       handleFinalSubmissionWithMaterials(localMaterials);
  //     }, 100);
  //   };

  //   return (
  //     <div className="blue-modal-overlay" onClick={() => setIsPackingMaterialsModalOpen(false)}>
  //       <div className="blue-modal blue-modal-medium" onClick={(e) => e.stopPropagation()}>
  //         <div className="blue-modal-header">
  //           <div className="blue-modal-header-left">
  //             <span className="blue-modal-icon">📦</span>
  //             <h3>Packing Materials</h3>
  //             <span className="blue-modal-badge">Final Submission</span>
  //           </div>
  //           <button className="blue-modal-close" onClick={() => setIsPackingMaterialsModalOpen(false)}>✕</button>
  //         </div>

  //         <div className="blue-modal-body">
  //           <div className="blue-info-message" style={{ 
  //             backgroundColor: '#e8f0fe', 
  //             padding: '12px', 
  //             borderRadius: '8px', 
  //             marginBottom: '20px',
  //             fontSize: '13px'
  //           }}>
  //             <span style={{ fontSize: '18px', marginRight: '8px' }}>ℹ️</span>
  //             Please enter the packing materials details for this dispatch
  //           </div>

  //           <div className="blue-form-field">
  //             <label>📦 Total Boxes</label>
  //             <input 
  //               type="number" 
  //               value={localMaterials.totalBoxes} 
  //               onChange={(e) => setLocalMaterials({ ...localMaterials, totalBoxes: parseInt(e.target.value) || 0 })} 
  //               className="blue-input" 
  //               placeholder="Enter number of boxes"
  //               autoFocus
  //               min="0"
  //             />
  //           </div>

  //           <div className="blue-form-field">
  //             <label>🛍️ Total Bags</label>
  //             <input 
  //               type="number" 
  //               value={localMaterials.totalBags} 
  //               onChange={(e) => setLocalMaterials({ ...localMaterials, totalBags: parseInt(e.target.value) || 0 })} 
  //               className="blue-input" 
  //               placeholder="Enter number of bags"
  //               min="0"
  //             />
  //           </div>

  //           <div className="blue-form-field">
  //             <label>📎 Total Polythene Bags</label>
  //             <input 
  //               type="number" 
  //               value={localMaterials.totalPolybags} 
  //               onChange={(e) => setLocalMaterials({ ...localMaterials, totalPolybags: parseInt(e.target.value) || 0 })} 
  //               className="blue-input" 
  //               placeholder="Enter number of polythene bags"
  //               min="0"
  //             />
  //           </div>

  //           <div className="blue-summary-box" style={{
  //             marginTop: '20px',
  //             padding: '15px',
  //             backgroundColor: '#f8f9fa',
  //             borderRadius: '8px',
  //             border: '1px solid #dee2e6'
  //           }}>
  //             <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Summary</div>
  //             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
  //               <span>Total Items:</span>
  //               <strong>{tempBillData?.items.length || 0}</strong>
  //             </div>
  //             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
  //               <span>Total Quantity:</span>
  //               <strong>{tempBillData?.items.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0} PCS</strong>
  //             </div>
  //           </div>
  //         </div>

  //         <div className="blue-modal-footer">
  //           <button onClick={() => setIsPackingMaterialsModalOpen(false)} className="blue-btn blue-btn-secondary">
  //             Cancel
  //           </button>
  //           <button 
  //             onClick={handleConfirm} 
  //             className="blue-btn blue-btn-primary blue-btn-large"
  //           >
  //             ✅ Confirm & Generate PDF
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };

  const calculateTotalQuantity = (sets, setsPerPcs, loosePcs, looseOperation = "add") => {
    const setsNum = parseInt(sets) || 0;
    const piecesPerSetNum = parseInt(setsPerPcs) || 0;
    const loosePcsNum = parseInt(loosePcs) || 0;
    const baseQuantity = setsNum * piecesPerSetNum;

    if (looseOperation === "subtract") {
      return Math.max(0, baseQuantity - loosePcsNum);
    } else {
      return baseQuantity + loosePcsNum;
    }
  };

  const searchByLotNumber = (lotNumber) => {
    addDebugMessage(`Searching for lot number: "${lotNumber}"`);

    const allProducts = [...sheetData, ...oldLotData];

    if (allProducts.length === 0) {
      addDebugMessage("Database empty!", 'error');
      return null;
    }

    const product = allProducts.find(item => {
      const itemLot = item['Lot Number']?.toString();
      return itemLot === lotNumber.toString();
    });

    if (product) {
      addDebugMessage(`Found product for lot ${lotNumber}: ${product['Garment Type'] || product['Item Name']} (Source: ${product['Source'] || 'Main Sheet'})`, 'success');
    } else {
      addDebugMessage(`No product found for lot number: "${lotNumber}"`, 'error');
    }

    return product;
  };

  const handleManualLotSearch = async () => {
    if (!manualLotInput.trim()) {
      showToast("Please enter a lot number", "error");
      return;
    }

    setSearchingManualLot(true);

    const foundProduct = searchByLotNumber(manualLotInput.trim());

    if (foundProduct) {
      let colors = foundProduct['Colors'];
      let sizes = foundProduct['Sizes'];

      if (typeof colors === 'string') {
        try { colors = JSON.parse(colors); } catch (e) { colors = []; }
      }
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes); } catch (e) { sizes = []; }
      }

      const dbPiecesPerSet = foundProduct['Pieces Per Set'] || foundProduct['PiecesPerSet'] || "";
      const lotNumber = foundProduct['Lot Number'] || "";

      const productData = {
        barcode: foundProduct['Barcode ID'] || `LOT-${lotNumber}`,
        lotNumber: lotNumber,
        sets: "",
        setsPerPcs: dbPiecesPerSet,
        loosePcs: 0,
        looseOperation: "add",
        brand: foundProduct['Party Name'] || foundProduct['Brand'] || "",
        item: foundProduct['Garment Type'] || foundProduct['Item Name'] || "",
        quantity: 0,
        totalPieces: foundProduct['Total Pieces'] || 0,
        colors: colors || [],
        sizes: sizes || [],
        sizeQuantities: {},
        colorDetails: {},
        partNo: extractPartNo(foundProduct),
        rate: extractRate(foundProduct)
      };

      setCurrentProduct(productData);
      setSelectedLotForSummary(lotNumber);
      playBeepSound();
      showToast(`Found: ${productData.item} (${foundProduct['Source'] || 'Main'})`, 'success');

      setShowNumericKeyboard(false);
      setManualLotInput("");
      setLotSearchTerm("");

      setTimeout(() => {
        const setsInput = document.querySelector('.blue-sets-input');
        if (setsInput) setsInput.focus();
      }, 100);
    } else {
      showToast(`Lot number "${manualLotInput}" not found in database`, "error");
    }

    setSearchingManualLot(false);
  };

  const handleBarcodeScan = async (barcode) => {
    addDebugMessage(`Scan: "${barcode}"`);

    if (lastScannedBarcode === barcode) return;

    setLastScannedBarcode(barcode);
    setLoading(true);

    setCurrentProduct(prev => ({ ...prev, barcode: barcode, item: "Searching..." }));

    const foundProduct = searchProductByBarcode(barcode);

    if (foundProduct) {
      let colors = foundProduct['Colors'];
      let sizes = foundProduct['Sizes'];

      if (typeof colors === 'string') {
        try { colors = JSON.parse(colors); } catch (e) { colors = []; }
      }
      if (typeof sizes === 'string') {
        try { sizes = JSON.parse(sizes); } catch (e) { sizes = []; }
      }

      const dbPiecesPerSet = foundProduct['Pieces Per Set'] || foundProduct['PiecesPerSet'] || "";
      const lotNumber = foundProduct['Lot Number'] || "";

      const productData = {
        barcode: foundProduct['Barcode ID'] || barcode,
        lotNumber: lotNumber,
        sets: "",
        setsPerPcs: dbPiecesPerSet,
        loosePcs: 0,
        looseOperation: "add",
        brand: foundProduct['Party Name'] || foundProduct['Brand'] || "",
        item: foundProduct['Garment Type'] || foundProduct['Item Name'] || "",
        quantity: 0,
        totalPieces: foundProduct['Total Pieces'] || 0,
        colors: colors || [],
        sizes: sizes || [],
        sizeQuantities: {},
        colorDetails: {},
        partNo: extractPartNo(foundProduct),
        rate: extractRate(foundProduct)
      };

      setCurrentProduct(productData);
      setSelectedLotForSummary(lotNumber);
      playBeepSound();
      showToast(`Found: ${productData.item} (${foundProduct['Source'] || 'Main'})`, 'success');

      setTimeout(() => {
        const setsInput = document.querySelector('.blue-sets-input');
        if (setsInput) setsInput.focus();
      }, 100);
    } else {
      setCurrentProduct({
        barcode: normalizeBarcode(barcode),
        lotNumber: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: 0,
        looseOperation: "add",
        brand: "",
        item: "",
        quantity: 1,
        totalPieces: "",
        colors: [],
        sizes: [],
        sizeQuantities: {},
        colorDetails: {},
        partNo: "",
        rate: ""
      });
      showToast(`New barcode: ${barcode}`, 'info');
    }

    setLoading(false);
    setTimeout(() => setLastScannedBarcode(""), 2000);
  };

  const handleKeyboardKeyPress = (key) => {
    if (key === 'CLEAR') {
      setManualLotInput('');
      setLotSearchTerm('');
    } else if (key === '⌫') {
      setManualLotInput(prev => prev.slice(0, -1));
      setLotSearchTerm(prev => prev.slice(0, -1));
    } else {
      setManualLotInput(prev => prev + key);
      setLotSearchTerm(prev => prev + key);
    }
  };
  // Helper function to get parent lot number (e.g., "11472" from "11472A" or "11472B")
  const getParentLotNumber = (lotNumber) => {
    if (!lotNumber) return null;
    const lotStr = lotNumber.toString();
    // Check if it ends with A, B, C, etc. (single letter suffix)
    const match = lotStr.match(/^([A-Z0-9\-]+)([A-Z])$/i);
    if (match && match[2] && match[2].length === 1 && /[A-Z]/i.test(match[2])) {
      return match[1];
    }
    return lotStr;
  };
  const handleKeyboardSubmit = () => {
    handleManualLotSearch();
  };

  useEffect(() => {
    let keyBuffer = '';
    let scanTimer = null;

    const handleKeyPress = (event) => {
      if (event.key === 'Enter') {
        if (keyBuffer.length > 0) {
          handleBarcodeScan(keyBuffer.trim());
          keyBuffer = '';
          if (scanTimer) clearTimeout(scanTimer);
        }
      } else if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        keyBuffer += event.key;
        if (!isScannerActive) {
          setIsScannerActive(true);
          setTimeout(() => setIsScannerActive(false), 500);
        }
        if (scanTimer) clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
          if (keyBuffer.length > 0 && keyBuffer.length < 5) keyBuffer = '';
          scanTimer = null;
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isScannerActive]);
  useEffect(() => {
    // If onBack prop is provided, use it
    if (onBack) {
      return;
    }

    // Otherwise, set up a custom handler for the dashboard button
    // The dashboard button is already calling onBack, but we need to ensure it navigates
  }, [onBack]);
  useEffect(() => {
    if (!isModalOpen) {
      setLotSearchTerm("");
      setLotSuggestions([]);
      setShowLotSuggestions(false);
      setManualLotInput("");
    }
  }, [isModalOpen]);
  useEffect(() => {
    // First check if selectedParty prop is provided directly
    if (selectedParty) {
      setSelectedPartyState(selectedParty);
      setBillForm(prev => ({
        ...prev,
        partyName: selectedParty.name
      }));
      addDebugMessage(`Party loaded from props: ${selectedParty.name}`, 'success');
      return;
    }

    // If no prop, try to read from localStorage (set by PartySelection)
    const storedParty = localStorage.getItem('selectedParty');
    if (storedParty) {
      try {
        const party = JSON.parse(storedParty);
        setSelectedPartyState(party);
        setBillForm(prev => ({
          ...prev,
          partyName: party.name
        }));
        addDebugMessage(`Party loaded from localStorage: ${party.name}`, 'success');

        // Optional: Clear it after reading to avoid stale data on refresh
        // localStorage.removeItem('selectedParty');
      } catch (error) {
        console.error("Error parsing stored party:", error);
        addDebugMessage(`Failed to parse stored party: ${error.message}`, 'error');
      }
    } else {
      addDebugMessage(`No party found in localStorage or props`, 'warning');
    }
  }, [selectedParty]);

  useEffect(() => {
    const newQuantity = calculateTotalQuantity(
      currentProduct.sets,
      currentProduct.setsPerPcs,
      currentProduct.loosePcs,
      currentProduct.looseOperation
    );
    if (newQuantity !== currentProduct.quantity) {
      setCurrentProduct(prev => ({ ...prev, quantity: newQuantity }));
    }
  }, [currentProduct.sets, currentProduct.setsPerPcs, currentProduct.loosePcs, currentProduct.looseOperation]);

  const handleManualBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput.trim());
      setBarcodeInput("");
    }
  };

  const testScanner = () => {
    showToast("Scanner ready - Scan a barcode", "info");
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  };

  const refreshSheetData = () => {
    fetchGoogleSheetData();
  };

  const addProductToBill = (keepModalOpen = false) => {
    if (!currentProduct.item) {
      showToast("Please enter item name", "error");
      return;
    }
    if (currentProduct.quantity <= 0) {
      showToast("Please enter valid quantity", "error");
      return;
    }

    // 🔍 DEBUG: Log current product data
    console.log("🔍 Adding product to bill:", {
      partNo: currentProduct.partNo,
      rate: currentProduct.rate,
      item: currentProduct.item,
      lotNumber: currentProduct.lotNumber
    });
    addDebugMessage(`📦 Adding item: ${currentProduct.item}, PartNo: ${currentProduct.partNo || 'N/A'}, Rate: ${currentProduct.rate || 'N/A'}`, 'info');

    const newItem = {
      id: Date.now(),
      barcode: currentProduct.barcode,
      lotNumber: currentProduct.lotNumber,
      sets: currentProduct.sets || 0,
      setsPerPcs: currentProduct.setsPerPcs || 0,
      loosePcs: currentProduct.loosePcs || 0,
      looseOperation: currentProduct.looseOperation || "add",
      brand: currentProduct.brand,
      description: currentProduct.item,
      quantity: currentProduct.quantity,
      colors: currentProduct.colors,
      sizes: currentProduct.sizes,
      partNo: (() => {
        if (currentProduct.partNo && String(currentProduct.partNo).trim()) return String(currentProduct.partNo).trim();
        const extracted = extractPartNo(currentProduct);
        if (extracted) return extracted;
        if (currentProduct.lotNumber) {
          const matchedProd = [...sheetData, ...oldLotData].find(p => p['Lot Number']?.toString() === currentProduct.lotNumber?.toString() || p.lotNumber?.toString() === currentProduct.lotNumber?.toString());
          if (matchedProd) {
            const pNo = extractPartNo(matchedProd);
            if (pNo) return pNo;
          }
          const matchedSummary = lotSummary.find(s => s.lotNumber?.toString() === currentProduct.lotNumber?.toString());
          if (matchedSummary && matchedSummary.partNo) return matchedSummary.partNo;
        }
        return "";
      })(),
      rate: (() => {
        if (currentProduct.rate && String(currentProduct.rate).trim()) return String(currentProduct.rate).trim();
        const extracted = extractRate(currentProduct);
        if (extracted) return extracted;
        if (currentProduct.lotNumber) {
          const matchedProd = [...sheetData, ...oldLotData].find(p => p['Lot Number']?.toString() === currentProduct.lotNumber?.toString() || p.lotNumber?.toString() === currentProduct.lotNumber?.toString());
          if (matchedProd) {
            const r = extractRate(matchedProd);
            if (r) return r;
          }
          const matchedSummary = lotSummary.find(s => s.lotNumber?.toString() === currentProduct.lotNumber?.toString());
          if (matchedSummary && matchedSummary.rate) return matchedSummary.rate;
        }
        return "1";
      })(),
      priceList: currentProduct.priceList || ""
    };

    // 🔍 DEBUG: Log the new item being added
    console.log("✅ New item created:", newItem);
    addDebugMessage(`✅ Item stored with PartNo: ${newItem.partNo}, Rate: ${newItem.rate}`, 'success');

    setBillForm(prev => ({ ...prev, items: [...prev.items, newItem] }));

    const addedLotLabel = currentProduct.lotNumber ? `Lot ${currentProduct.lotNumber}` : currentProduct.item;

    setCurrentProduct({
      barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
      looseOperation: "add",
      brand: "", item: "", quantity: 1, totalPieces: "",
      colors: [], sizes: [], sizeQuantities: {}, colorDetails: {},
      partNo: "", rate: ""
    });

    setLotSearchTerm("");
    setManualLotInput("");
    setLotSuggestions([]);

    if (keepModalOpen) {
      showToast(`Added ${addedLotLabel}! Enter next lot number...`, 'success');
      setTimeout(() => {
        if (modalLotSearchInputRef.current) {
          modalLotSearchInputRef.current.focus();
        } else if (modalBarcodeInputRef.current) {
          modalBarcodeInputRef.current.focus();
        }
      }, 100);
    } else {
      showToast(`Added: ${currentProduct.item}`, 'success');
      setIsModalOpen(false);
      if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }
  };


  const updateCurrentProduct = (field, value) => {
    setCurrentProduct(prev => ({ ...prev, [field]: value }));
  };

  const removeItem = (index) => {
    const updatedItems = billForm.items.filter((_, i) => i !== index);
    setBillForm({ ...billForm, items: updatedItems });
    showToast('Item removed', 'info');
  };

  const updateItemDetails = (index, field, value) => {
    const updatedItems = [...billForm.items];

    if (field === 'looseOperation' || field === 'partNo' || field === 'brand' || field === 'description') {
      updatedItems[index][field] = value;
    } else {
      const numValue = parseInt(value) || 0;
      updatedItems[index][field] = numValue;
    }

    const currentSets = field === 'sets' ? (parseInt(value) || 0) : updatedItems[index].sets;
    const currentPcsPerSet = field === 'setsPerPcs' ? (parseInt(value) || 0) : updatedItems[index].setsPerPcs;
    const currentLoosePcs = field === 'loosePcs' ? (parseInt(value) || 0) : updatedItems[index].loosePcs;
    const currentOperation = field === 'looseOperation' ? value : (updatedItems[index].looseOperation || "add");

    const newQuantity = calculateTotalQuantity(currentSets, currentPcsPerSet, currentLoosePcs, currentOperation);
    updatedItems[index].quantity = newQuantity;

    const item = updatedItems[index];
    // Restriction removed - just show warning but allow
    if (item.lotNumber) {
      const lotInfo = lotSummary.find(l => l.lotNumber === item.lotNumber);
      if (lotInfo && !lotInfo.isOldLot && lotInfo.availablePieces < newQuantity) {
        addDebugMessage(`Warning: Requested quantity (${newQuantity}) exceeds available (${lotInfo.availablePieces})`, 'warning');
        // Still allow the update
      }
    }

    setBillForm({ ...billForm, items: updatedItems });
  };

  const openEditModal = (index) => {
    const item = billForm.items[index];
    setEditingItemIndex(index);
    setEditItemData({ ...item });
    setIsEditModalOpen(true);
  };

  const saveEditedItem = () => {
    if (editItemData && editingItemIndex !== null) {
      if (editItemData.quantity <= 0) {
        showToast("Quantity must be greater than 0", "error");
        return;
      }

      // Remove restriction - allow any quantity
      if (editItemData.lotNumber) {
        const lotInfo = lotSummary.find(l => l.lotNumber === editItemData.lotNumber);
        if (lotInfo && !lotInfo.isOldLot && lotInfo.availablePieces < editItemData.quantity) {
          addDebugMessage(`Note: Quantity (${editItemData.quantity}) exceeds available (${lotInfo.availablePieces})`, 'warning');
        }
        // Allow the edit regardless
      }

      const updatedItems = [...billForm.items];
      updatedItems[editingItemIndex] = editItemData;
      setBillForm({ ...billForm, items: updatedItems });
      setIsEditModalOpen(false);
      setEditingItemIndex(null);
      setEditItemData(null);
      showToast("Item updated successfully", "success");
    }
  };

  const openConfirmationModal = () => {
    if (billForm.items.length === 0) {
      showToast("Please add at least one item", "error");
      return;
    }
    if (!selectedPartyState) {
      showToast("Please select a party", "error");
      return;
    }

    setTempBillData({ ...billForm });
    setIsConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!tempBillData) return;

    if (savingToSheet || generatingPDF) {
      console.warn("⚠️ Final submission process already in progress, ignoring duplicate click");
      return;
    }

    // 1. Show Database Saving Loading State First
    setSavingToSheet(true);
    setGeneratingPDF(false);
    setProcessingStage('sheet');

    try {
      // Use 'PL' prefix for Final Bills (Packing List)
      const packingNumber = await getNextPackingNumber('PL');

      const packingDataForStorage = {
        billNumber: packingNumber,
        packingNumber: packingNumber,
        partyName: selectedPartyState?.name || tempBillData.partyName,
        billDate: tempBillData.billDate,
        dueDate: tempBillData.dueDate,
        orderReference: tempBillData.orderReference || "",
        items: tempBillData.items.map(item => ({
          id: item.id,
          barcode: item.barcode,
          lotNumber: item.lotNumber,
          brand: item.brand,
          description: item.description,
          sets: item.sets,
          setsPerPcs: item.setsPerPcs,
          loosePcs: item.loosePcs,
          looseOperation: item.looseOperation || "add",
          quantity: item.quantity,
          colors: item.colors,
          sizes: item.sizes,
          // ✅ DEEP FALLBACK: Look up PartNo from database if item.partNo is missing
          partNo: (() => {
            if (item.partNo && String(item.partNo).trim()) return String(item.partNo).trim();
            const extracted = extractPartNo(item);
            if (extracted) return extracted;
            if (item.lotNumber) {
              const matchedProd = [...sheetData, ...oldLotData].find(p => p['Lot Number']?.toString() === item.lotNumber?.toString() || p.lotNumber?.toString() === item.lotNumber?.toString());
              if (matchedProd) {
                const pNo = extractPartNo(matchedProd);
                if (pNo) return pNo;
              }
              const matchedSummary = lotSummary.find(s => s.lotNumber?.toString() === item.lotNumber?.toString());
              if (matchedSummary && matchedSummary.partNo) return matchedSummary.partNo;
            }
            return "";
          })(),
          rate: (() => {
            if (item.rate && String(item.rate).trim()) return String(item.rate).trim();
            const extracted = extractRate(item);
            if (extracted) return extracted;
            if (item.lotNumber) {
              const matchedProd = [...sheetData, ...oldLotData].find(p => p['Lot Number']?.toString() === item.lotNumber?.toString() || p.lotNumber?.toString() === item.lotNumber?.toString());
              if (matchedProd) {
                const r = extractRate(matchedProd);
                if (r) return r;
              }
              const matchedSummary = lotSummary.find(s => s.lotNumber?.toString() === item.lotNumber?.toString());
              if (matchedSummary && matchedSummary.rate) return matchedSummary.rate;
            }
            return "1";
          })(),
          priceList: item.priceList || ""
        })),
        notes: tempBillData.notes,
        createdDate: new Date().toISOString(),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        status: 'FINAL',
        documentType: 'FINAL'
      };

      // 2. STORE IN DATABASE FIRST
      const saved = await saveBillToGoogleSheet(packingDataForStorage);

      if (!saved) {
        throw new Error('Failed to save bill to database / Google Sheets');
      }

      // 3. ONLY AFTER SUCCESSFUL STORAGE: GENERATE & DOWNLOAD PDF
      setSavingToSheet(false);
      setGeneratingPDF(true);
      setProcessingStage('pdf');

      const pdfGenerated = await generatePackingList(packingDataForStorage);

      if (!pdfGenerated) {
        throw new Error('Bill saved to database, but PDF generation failed');
      }

      // 4. Success animation and cleanup
      setShowSuccessAnimation(true);
      setProcessingStage('complete');

      setTimeout(() => {
        setShowSuccessAnimation(false);
        setProcessingStage(null);
        setGeneratingPDF(false);
      }, 2000);

      if (onSubmit) onSubmit(packingDataForStorage);

      // Reset form after final submission
      setBillForm({
        partyName: selectedParty?.name || "",
        billDate: new Date().toISOString().split('T')[0],
        dueDate: "",
        items: [],
        notes: ""
      });

      if (!selectedParty) setSelectedPartyState(null);

      setCurrentProduct({
        barcode: "", lotNumber: "", sets: "", setsPerPcs: "", loosePcs: 0,
        looseOperation: "add",
        brand: "", item: "", quantity: 1, totalPieces: "",
        colors: [], sizes: [], sizeQuantities: {}, colorDetails: {},
        partNo: "", rate: ""
      });

      setTempBillData(null);
      setTempBillDataForDraft(null);

      showToast(`Packing list ${packingNumber} generated successfully!`, 'success');

      if (barcodeInputRef.current) barcodeInputRef.current.focus();
      await fetchLotSummary();

      setIsConfirmModalOpen(false);

    } catch (error) {
      console.error("Error in handleFinalSubmit:", error);
      addDebugMessage(`❌ Final submission failed: ${error.message}`, 'error');
      showToast(`Failed to save: ${error.message}`, "error");
      // Clear loading on error
      setProcessingStage(null);
      setGeneratingPDF(false);
    }
  };

  const playBeepSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.1;
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.2);
      oscillator.stop(audioContext.currentTime + 0.2);
      setTimeout(() => audioContext.close(), 300);
    } catch (error) { }
  };

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `blue-toast ${type}`;
    toast.innerHTML = `<div class="blue-toast-content"><span>${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const generatePackingList = async (packingData) => {
    if (!packingData || !packingData.items || packingData.items.length === 0) {
      console.error("Invalid packing data");
      setGeneratingPDF(false);
      setProcessingStage(null);
      return false;
    }

    setGeneratingPDF(true);
    setProcessingStage('pdf');

    try {
      // Only create Customer and Account pages - removed Audit
      const documentTypes = [
        { name: "Customer", subheading: "PACKING LIST FOR CUSTOMER" },
        { name: "Account", subheading: "PACKING LIST FOR ACCOUNT OFFICE" }
      ];

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 15;
      const rightMargin = 15;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const uniqueLots = new Set(packingData.items.map(item => item.lotNumber)).size;
      const totalItems = packingData.items.length;
      const totalQuantity = packingData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const totalSets = packingData.items.reduce((sum, item) => sum + (parseInt(item.sets) || 0), 0);

      const fitTextInCell = (text, maxWidth, docInstance) => {
        let str = String(text || '').trim();
        if (!str) return '';
        if (maxWidth <= 2) return '';
        if (docInstance.getTextWidth(str) <= maxWidth) return str;

        while (str.length > 0 && docInstance.getTextWidth(str + '..') > maxWidth) {
          str = str.slice(0, -1);
        }
        return str ? str + '..' : '';
      };

      const drawCheckbox = (x, y, size = 3.5) => {
        doc.rect(x, y, size, size);
      };

      const totalItemsList = packingData.items.length;
      const ROWS_PER_PAGE = 14;
      const totalPagesOverall = documentTypes.length * Math.ceil(totalItemsList / ROWS_PER_PAGE);

      let overallPageCounter = 1;

      documentTypes.forEach((docType) => {
        let itemsProcessed = 0;

        while (itemsProcessed < totalItemsList) {
          const remainingRows = totalItemsList - itemsProcessed;
          const rowsOnThisPage = Math.min(ROWS_PER_PAGE, remainingRows);
          const isLastPageOfSection = (itemsProcessed + rowsOnThisPage) === totalItemsList;

          if (overallPageCounter > 1) {
            doc.addPage();
          }

          // 1. Page Outer Border
          doc.setLineWidth(0.5);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setLineWidth(0.3);

          // 2. Header
          doc.setFont("times", "bold");
          doc.setFontSize(20);
          doc.text("PACKING LIST", pageWidth / 2, 16, { align: "center" });

          doc.setFontSize(10.5);
          doc.setFont("times", "bold");
          const sub = docType.subheading.replace(/^PACKING LIST FOR\s*/i, 'FOR ');
          const subWidth = doc.getTextWidth(sub);
          const midX = pageWidth / 2;
          doc.line(midX - subWidth / 2 - 22, 21.5, midX - subWidth / 2 - 3, 21.5);
          doc.text(sub, midX, 22.8, { align: "center" });
          doc.line(midX + subWidth / 2 + 3, 21.5, midX + subWidth / 2 + 22, 21.5);

          const partyName = (packingData.partyName || 'N/A').toUpperCase();
          doc.setFontSize(17);
          doc.setFont("times", "bold");
          doc.text(partyName, midX, 31, { align: "center" });

          // 3. Metadata Box (35mm to 73mm)
          const metaY = 35;
          const metaH = 38;
          doc.rect(leftMargin, metaY, contentWidth, metaH);
          const midPoint = leftMargin + (contentWidth / 2);
          doc.line(midPoint, metaY, midPoint, metaY + metaH);

          const leftLabelX = leftMargin + 5;
          const leftValX = leftMargin + 40;
          doc.setFont("times", "bold");
          doc.setFontSize(9);

          doc.text("Date", leftLabelX, metaY + 6);
          doc.text(":", leftLabelX + 22, metaY + 6);
          doc.setFont("times", "normal");
          doc.text(`${packingData.billDate || new Date().toLocaleDateString()}`, leftValX, metaY + 6);

          doc.setFont("times", "bold");
          doc.text("Order Ref", leftLabelX, metaY + 13);
          doc.text(":", leftLabelX + 22, metaY + 13);
          doc.setFont("times", "normal");
          doc.text(`${packingData.orderReference || 'N/A'}`, leftValX, metaY + 13);

          doc.setFont("times", "bold");
          doc.text("Doc No", leftLabelX, metaY + 20);
          doc.text(":", leftLabelX + 22, metaY + 20);
          doc.setFont("times", "normal");
          doc.text(`${packingData.packingNumber || 'N/A'}`, leftValX, metaY + 20);

          doc.setFont("times", "bold");
          doc.text("Generated By", leftLabelX, metaY + 27);
          doc.text(":", leftLabelX + 22, metaY + 27);
          doc.setFont("times", "normal");
          doc.text(`${packingData.preparedBy || preparedBy} (${packingData.preparedByRole || userRole})`, leftValX, metaY + 27);

          doc.setFont("times", "bold");
          doc.text("Packing Materials", leftLabelX, metaY + 34);
          doc.text(":", leftLabelX + 22, metaY + 34);
          doc.setFont("times", "normal");
          const packingMaterials = packingData.packingMaterials || { totalBoxes: 0, totalBags: 0, totalPolybags: 0 };
          const matParts = [];
          if (packingMaterials.totalBoxes > 0) matParts.push(`${packingMaterials.totalBoxes} Box${packingMaterials.totalBoxes !== 1 ? 'es' : ''}`);
          if (packingMaterials.totalBags > 0) matParts.push(`${packingMaterials.totalBags} Bag${packingMaterials.totalBags !== 1 ? 's' : ''}`);
          if (packingMaterials.totalPolybags > 0) matParts.push(`${packingMaterials.totalPolybags} Polybag${packingMaterials.totalPolybags !== 1 ? 's' : ''}`);
          doc.text(matParts.length > 0 ? matParts.join(', ') : 'None', leftValX, metaY + 34);

          const rightLabelX = midPoint + 5;
          const rightValX = midPoint + 40;

          doc.setFont("times", "bold");
          doc.text("Total Lots", rightLabelX, metaY + 6);
          doc.text(":", rightLabelX + 22, metaY + 6);
          doc.setFont("times", "normal");
          doc.text(uniqueLots.toString(), rightValX, metaY + 6);

          doc.setFont("times", "bold");
          doc.text("Total Items", rightLabelX, metaY + 13);
          doc.text(":", rightLabelX + 22, metaY + 13);
          doc.setFont("times", "normal");
          doc.text(totalItems.toString(), rightValX, metaY + 13);

          doc.setFont("times", "bold");
          doc.text("Total Qty", rightLabelX, metaY + 20);
          doc.text(":", rightLabelX + 22, metaY + 20);
          doc.setFont("times", "normal");
          doc.text(`${totalQuantity} PCS`, rightValX, metaY + 20);

          doc.setFont("times", "bold");
          doc.text("Total Sets", rightLabelX, metaY + 27);
          doc.text(":", rightLabelX + 22, metaY + 27);
          doc.setFont("times", "normal");
          doc.text(totalSets.toString(), rightValX, metaY + 27);

          doc.setFont("times", "bold");
          doc.text("Total Value", rightLabelX, metaY + 34);
          doc.text(":", rightLabelX + 22, metaY + 34);
          doc.setFont("times", "normal");
          doc.text("To be calculated", rightValX, metaY + 34);

          // 4. Table Frame (Continuous Grid down to totalRowTop)
          const tableTop = 77;
          const totalRowTop = 237;
          const tableBottom = 246;
          const headerHeight = 9;

          let tableColumns;
          if (docType.name === "Account") {
            tableColumns = [
              { header: "S.No", width: 8 },
              { header: "Part No.", width: 16 },
              { header: "Lot No", width: 15 },
              { header: "Brand", width: 28 },
              { header: "Item Description", width: 46 },
              { header: "Sets", width: 14 },
              { header: "Pc/Set", width: 14 },
              { header: "Loose Pc", width: 15 },
              { header: "Total Qty", width: 18 },
              { header: "Check", width: 6 }
            ];
          } else {
            tableColumns = [
              { header: "S.No", width: 9 },
              { header: "Lot No", width: 20 },
              { header: "Brand", width: 24 },
              { header: "Item Description", width: 57 },
              { header: "Sets", width: 17 },
              { header: "Pc/Set", width: 17 },
              { header: "Loose Pc", width: 17 },
              { header: "Total Qty", width: 19 }
            ];
          }

          // Main Table Outer Rect (from tableTop to totalRowTop)
          doc.rect(leftMargin, tableTop, contentWidth, totalRowTop - tableTop);

          // Vertical Grid Lines from tableTop to totalRowTop
          let colX = leftMargin;
          tableColumns.forEach((col, index) => {
            colX += col.width;
            if (index < tableColumns.length - 1) {
              doc.line(colX, tableTop, colX, totalRowTop);
            }
          });

          // Table Header Line & Text
          doc.line(leftMargin, tableTop + headerHeight, leftMargin + contentWidth, tableTop + headerHeight);
          doc.setFont("times", "bold");

          let curX = leftMargin;
          tableColumns.forEach(col => {
            const maxHeaderWidth = col.width - 1;
            let fontSize = 8.5;
            doc.setFontSize(fontSize);
            while (fontSize > 6 && doc.getTextWidth(col.header) > maxHeaderWidth) {
              fontSize -= 0.5;
              doc.setFontSize(fontSize);
            }

            const textWidth = doc.getTextWidth(col.header);
            doc.text(col.header, curX + (col.width / 2) - (textWidth / 2), tableTop + 6);
            curX += col.width;
          });

          // Table Item Rows
          doc.setFont("times", "normal");
          doc.setFontSize(8.5);

          let curY = tableTop + headerHeight;
          for (let i = 0; i < rowsOnThisPage; i++) {
            const itemIndex = itemsProcessed;
            const item = packingData.items[itemIndex];

            let values;
            if (docType.name === "Account") {
              const partNoVal = item.partNo || extractPartNo(item) || "";
              values = [
                (itemIndex + 1).toString(),
                partNoVal,
                item.lotNumber || "",
                item.brand || "",
                item.description || item.name || "",
                (item.sets || 0).toString(),
                (item.setsPerPcs || 0).toString(),
                (item.loosePcs || 0).toString(),
                (item.quantity || 0).toString(),
                "CHECKBOX"
              ];
            } else {
              values = [
                (itemIndex + 1).toString(),
                item.lotNumber || "",
                item.brand || "",
                item.description || item.name || "",
                (item.sets || 0).toString(),
                (item.setsPerPcs || 0).toString(),
                (item.loosePcs || 0).toString(),
                (item.quantity || 0).toString()
              ];
            }

            // Calculate max lines needed for this row
            let maxLinesInRow = 1;
            const wrappedValues = values.map((val, cIdx) => {
              if (val === "CHECKBOX") return ["CHECKBOX"];
              const cWidth = tableColumns[cIdx].width;
              const maxAllowed = cWidth - 2.5;
              const splitLines = doc.splitTextToSize(String(val || ''), maxAllowed);
              if (splitLines.length > maxLinesInRow) {
                maxLinesInRow = splitLines.length;
              }
              return splitLines;
            });

            const calculatedRowHeight = Math.max(8.5, maxLinesInRow * 4 + 2);

            // Render text lines and small checkbox in cells
            let cX = leftMargin;
            wrappedValues.forEach((lines, cIdx) => {
              const cWidth = tableColumns[cIdx].width;
              const cellCenterX = cX + (cWidth / 2);
              const startY = curY + (calculatedRowHeight / 2) - ((lines.length - 1) * 3.6 / 2) + 1.2;

              const isLotNumber = (docType.name === "Account" && cIdx === 2) || (docType.name !== "Account" && cIdx === 1);

              if (lines[0] === "CHECKBOX") {
                const cbX = cellCenterX - 1.4;
                const cbY = curY + (calculatedRowHeight / 2) - 1.4;
                doc.rect(cbX, cbY, 2.8, 2.8);
              } else {
                if (isLotNumber) {
                  doc.setFont("times", "bold");
                  doc.setFontSize(9);
                  doc.setTextColor(0, 0, 0);
                } else {
                  doc.setFont("times", "normal");
                  doc.setFontSize(8.5);
                }

                lines.forEach((lineText, lineIdx) => {
                  const lineY = startY + (lineIdx * 3.6);
                  doc.text(lineText, cellCenterX, lineY, { align: "center" });
                });

                if (isLotNumber) {
                  doc.setFont("times", "normal");
                  doc.setFontSize(8.5);
                }
              }

              cX += cWidth;
            });

            curY += calculatedRowHeight;
            doc.line(leftMargin, curY, leftMargin + contentWidth, curY);
            itemsProcessed++;
          }

          // TOTAL ROW at bottom of table (237mm to 246mm)
          doc.setLineWidth(0.4);
          doc.rect(leftMargin, totalRowTop, contentWidth, tableBottom - totalRowTop);
          doc.setLineWidth(0.3);

          doc.setFont("times", "bold");
          doc.setFontSize(9);

          if (isLastPageOfSection) {
            doc.text("TOTAL", leftMargin + 4, totalRowTop + 6);

            const totalSetsVal = packingData.items.reduce((s, i) => s + (parseInt(i.sets) || 0), 0);
            const totalLooseVal = packingData.items.reduce((s, i) => s + (parseInt(i.loosePcs) || 0), 0);
            const totalQtyVal = packingData.items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);

            let setsX, setsW, looseX, looseW, qtyX, qtyW;

            if (docType.name === "Account") {
              setsX = leftMargin + 8 + 16 + 15 + 28 + 46;
              setsW = 14;
              looseX = setsX + 14 + 14;
              looseW = 15;
              qtyX = looseX + 15;
              qtyW = 18;
            } else {
              setsX = leftMargin + 9 + 20 + 24 + 57; // 125
              setsW = 17;
              looseX = setsX + 17 + 17; // 159
              looseW = 17;
              qtyX = looseX + 17; // 176
              qtyW = 19;
            }

            // Draw vertical divider lines ONLY around cells where values exist
            doc.line(setsX, totalRowTop, setsX, tableBottom);
            doc.line(setsX + setsW, totalRowTop, setsX + setsW, tableBottom);
            doc.text(totalSetsVal.toString(), setsX + (setsW / 2), totalRowTop + 6, { align: "center" });

            doc.line(looseX, totalRowTop, looseX, tableBottom);
            doc.line(looseX + looseW, totalRowTop, looseX + looseW, tableBottom);
            doc.text(totalLooseVal.toString(), looseX + (looseW / 2), totalRowTop + 6, { align: "center" });

            doc.line(qtyX, totalRowTop, qtyX, tableBottom);
            doc.line(qtyX + qtyW, totalRowTop, qtyX + qtyW, tableBottom);
            doc.text(totalQtyVal.toString(), qtyX + (qtyW / 2), totalRowTop + 6, { align: "center" });
          }

          // 5. NOTES Box (249mm to 258mm)
          const notesY = 249;
          const notesH = 9;
          doc.rect(leftMargin, notesY, contentWidth, notesH);
          doc.line(leftMargin + 25, notesY, leftMargin + 25, notesY + notesH);

          doc.setFont("times", "bold");
          doc.setFontSize(9);
          doc.text("NOTES", leftMargin + 6, notesY + 6);

          doc.setFont("times", "normal");
          const noteText = docType.name === "Account"
            ? "Account copy - Keep for accounts audit"
            : "Customer copy - Please retain for your records";
          doc.text(noteText, leftMargin + 28, notesY + 6);

          // 6. Signatures Box (260mm to 284mm)
          const sigY = 260;
          const sigH = 24;
          doc.rect(leftMargin, sigY, contentWidth, sigH);

          const secW = contentWidth / 4;
          for (let s = 1; s < 4; s++) {
            doc.line(leftMargin + (s * secW), sigY, leftMargin + (s * secW), sigY + sigH);
          }

          const sigTitles = [
            "Prepared By",
            "Account Officer",
            "Checked By",
            "Authorized Signatory"
          ];

          const sigSubtexts = [
            `${packingData.preparedBy || preparedBy}`,
            "(Name & Signature)",
            "(Name & Signature)",
            "(Name & Signature)"
          ];

          doc.setFont("times", "bold");
          doc.setFontSize(9);

          sigTitles.forEach((title, idx) => {
            const sX = leftMargin + (idx * secW);
            const tW = doc.getTextWidth(title);
            doc.text(title, sX + (secW / 2) - (tW / 2), sigY + 6);

            doc.setLineWidth(0.3);
            doc.line(sX + 5, sigY + 17, sX + secW - 5, sigY + 17);

            doc.setFont("times", "normal");
            doc.setFontSize(8);
            const subText = sigSubtexts[idx];
            const subW = doc.getTextWidth(subText);
            doc.text(subText, sX + (secW / 2) - (subW / 2), sigY + 21);
            doc.setFont("times", "bold");
            doc.setFontSize(9);
          });

          // 7. Page Footer
          doc.setFont("times", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(50, 50, 50);
          doc.text(`Page ${overallPageCounter} of ${totalPagesOverall}`, pageWidth / 2, 289, { align: "center" });
          doc.setTextColor(0, 0, 0);

          overallPageCounter++;
        }
      });

      // Sanitize party name for filename (remove special characters)
      const sanitizedPartyName = packingData.partyName
        .replace(/[^a-zA-Z0-9]/g, '_')  // Replace special chars with underscore
        .substring(0, 30);  // Limit length to 30 characters

      const fileName = `${sanitizedPartyName}_PackingList_${packingData.packingNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      return true;

    } catch (error) {
      console.error("PDF Generation Error:", error);
      return false;
    }
  };
  useEffect(() => {
    if (debugContainerRef.current) {
      debugContainerRef.current.scrollTop = debugContainerRef.current.scrollHeight;
    }
  }, [scannerDebug]);

  useEffect(() => {
    fetchGoogleSheetData();
  }, [selectedPartyState]);

  const currentLotInfo = getLotInfo(currentProduct.lotNumber);

  // Numeric Keyboard Component
  const NumericKeyboard = ({ onKeyPress, onSubmit, onClose, value }) => {
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['CLEAR', '0', '⌫']
    ];

    return (
      <div className="blue-numeric-keyboard-overlay" onClick={onClose}>
        <div className="blue-numeric-keyboard" onClick={(e) => e.stopPropagation()}>
          <div className="blue-keyboard-header">
            <span className="blue-keyboard-title">Enter Lot Number</span>
            <button className="blue-keyboard-close" onClick={onClose}>✕</button>
          </div>
          <div className="blue-keyboard-display">
            <input
              type="text"
              value={value}
              readOnly
              placeholder="Lot Number"
              className="blue-keyboard-input"
              ref={manualLotInputRef}
            />
          </div>
          <div className="blue-keyboard-keys">
            {keys.map((row, rowIndex) => (
              <div key={rowIndex} className="blue-keyboard-row">
                {row.map((key) => (
                  <button
                    key={key}
                    className={`blue-keyboard-key ${key === 'CLEAR' || key === '⌫' ? 'blue-keyboard-special' : ''} ${key === 'CLEAR' ? 'blue-keyboard-clear' : ''}`}
                    onClick={() => onKeyPress(key)}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="blue-keyboard-footer">
            <button className="blue-keyboard-submit" onClick={onSubmit}>
              Search Lot
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Debug Console Modal Component
  // DebugConsoleModal component extracted to module scope

  // Edit Item Modal Component - Simple Version
  // Edit Item Modal Component - Corrected Simple Version
  // EditItemModal component extracted to module scope
  // Confirmation Modal Component
  // ConfirmationModal component extracted to module scope

  const generateLotSummaryPDF = async (lotNumber, lotDetailsData) => {
    setGeneratingPDF(true);

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 12;
      const rightMargin = 12;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const lotInfo = lotSummary.find(l => l.lotNumber === lotNumber);
      const totalPiecesInLot = lotInfo?.totalPieces || 0;
      const alreadyDispatched = lotInfo?.dispatchedQty || 0;
      const remainingPieces = lotInfo?.availablePieces || 0;

      const totalDispatched = lotDetailsData.reduce((sum, dispatch) => sum + dispatch.quantity, 0);
      const totalBills = new Set(lotDetailsData.map(d => d.packingNumber)).size;

      const totalSets = lotDetailsData.reduce((sum, dispatch) => {
        let setsValue = dispatch.sets || 0;

        if (typeof setsValue === 'string' && setsValue.includes('+')) {
          const parts = setsValue.split('+').map(Number);
          setsValue = parts.reduce((a, b) => a + b, 0);
        }
        else if (typeof setsValue === 'string') {
          setsValue = parseInt(setsValue, 10) || 0;
        }

        return sum + setsValue;
      }, 0);

      const totalLoosePcs = lotDetailsData.reduce((sum, dispatch) => sum + (dispatch.loosePcs || 0), 0);

      const firstItem = lotDetailsData[0];
      const brandName = firstItem?.brand || 'N/A';
      const itemName = firstItem?.description || 'N/A';

      let yPos = 18;

      doc.setLineWidth(0.8);
      doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
      doc.setLineWidth(0.3);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text("ESTIMATE MH", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;

      doc.setFontSize(12);
      doc.text("STOCK ITEM REGISTER", pageWidth / 2, yPos, { align: "center" });
      yPos += 7;

      doc.setFontSize(10);
      const combinedInfo = `${lotNumber}  |  ${itemName}  |  ${brandName}`;
      doc.text(combinedInfo, pageWidth / 2, yPos, { align: "center" });
      yPos += 6;

      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, pageWidth - rightMargin, yPos);
      doc.setLineWidth(0.3);
      doc.line(leftMargin, yPos + 1, pageWidth - rightMargin, yPos + 1);
      yPos += 8;

      doc.setLineWidth(0.3);
      doc.rect(leftMargin, yPos, contentWidth, 25);
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, yPos, contentWidth, 6, 'F');

      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.text("STOCK SUMMARY", leftMargin + 5, yPos + 4.5);

      doc.setFont("times", "normal");
      doc.setFontSize(8);

      const stockSummaryY = yPos + 10;
      const colWidth = contentWidth / 3;

      doc.text("Lot Number:", leftMargin + 5, stockSummaryY);
      doc.setFont("times", "bold");
      doc.text(lotNumber, leftMargin + 35, stockSummaryY);

      doc.setFont("times", "normal");
      doc.text("Total Pieces in Lot:", leftMargin + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      doc.text(totalPiecesInLot.toLocaleString(), leftMargin + 35, stockSummaryY + 6);

      doc.setFont("times", "normal");
      doc.text("Total Dispatched:", leftMargin + colWidth + 5, stockSummaryY);
      doc.setFont("times", "bold");
      doc.text(totalDispatched.toLocaleString(), leftMargin + colWidth + 40, stockSummaryY);

      doc.setFont("times", "normal");
      doc.text("Already Dispatched:", leftMargin + colWidth + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      doc.text(alreadyDispatched.toLocaleString(), leftMargin + colWidth + 40, stockSummaryY + 6);

      doc.setFont("times", "normal");
      doc.text("Remaining Balance:", leftMargin + (colWidth * 2) + 5, stockSummaryY);
      doc.setFont("times", "bold");
      const remainingColor = remainingPieces <= 0 ? [200, 50, 50] : [0, 100, 0];
      doc.setTextColor(remainingColor[0], remainingColor[1], remainingColor[2]);
      doc.text(remainingPieces.toLocaleString(), leftMargin + (colWidth * 2) + 40, stockSummaryY);
      doc.setTextColor(0, 0, 0);

      doc.setFont("times", "normal");
      doc.text("Status:", leftMargin + (colWidth * 2) + 5, stockSummaryY + 6);
      doc.setFont("times", "bold");
      let statusText = "";
      let statusColor = [0, 0, 0];
      if (remainingPieces <= 0) {
        statusText = "COMPLETED";
        statusColor = [200, 50, 50];
      } else if (totalDispatched > 0) {
        statusText = "PARTIAL";
        statusColor = [255, 140, 0];
      } else {
        statusText = "PENDING";
        statusColor = [0, 100, 0];
      }
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.text(statusText, leftMargin + (colWidth * 2) + 32, stockSummaryY + 6);
      doc.setTextColor(0, 0, 0);

      yPos += 32;

      doc.setFont("times", "normal");
      doc.setFontSize(8);
      const minDate = lotDetailsData[0]?.dispatchDate || '';
      const maxDate = lotDetailsData[lotDetailsData.length - 1]?.dispatchDate || '';
      if (minDate && maxDate) {
        doc.text(`Period: ${minDate} to ${maxDate}`, leftMargin, yPos);
      }
      yPos += 8;

      const tableColumns = [
        { header: "Date", width: 22, align: "center" },
        { header: "Particulars", width: 50, align: "left" },
        { header: "Vch Type", width: 18, align: "center" },
        { header: "Vch No.", width: 20, align: "center" },
        { header: "Sets", width: 15, align: "right" },
        { header: "Pc/Set", width: 15, align: "right" },
        { header: "Loose Pcs", width: 18, align: "right" },
        { header: "Total Qty", width: 20, align: "right" }
      ];

      const totalTableWidth = tableColumns.reduce((sum, col) => sum + col.width, 0);
      const startX = leftMargin + ((contentWidth - totalTableWidth) / 2);

      doc.setFillColor(200, 200, 200);
      doc.rect(startX, yPos, totalTableWidth, 8, 'F');
      doc.rect(startX, yPos, totalTableWidth, 8);

      let headerX = startX;
      tableColumns.forEach(col => {
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        let textX;
        if (col.align === "center") {
          textX = headerX + (col.width / 2);
          doc.text(col.header, textX, yPos + 5.5, { align: "center" });
        } else if (col.align === "right") {
          textX = headerX + col.width - 2;
          doc.text(col.header, textX, yPos + 5.5, { align: "right" });
        } else {
          textX = headerX + 2;
          doc.text(col.header, textX, yPos + 5.5, { align: "left" });
        }

        headerX += col.width;

        if (headerX < startX + totalTableWidth) {
          doc.setLineWidth(0.2);
          doc.line(headerX, yPos, headerX, yPos + 8);
        }
      });

      yPos += 8;

      let rowCount = 0;
      const rowHeight = 7;
      let runningTotalSets = 0;
      let runningTotalQty = 0;
      let runningTotalLoosePcs = 0;

      const calculateSetsValue = (sets) => {
        if (!sets) return 0;
        if (typeof sets === 'number') return sets;
        if (typeof sets === 'string') {
          if (sets.includes('+')) {
            const parts = sets.split('+').map(part => parseInt(part, 10) || 0);
            return parts.reduce((a, b) => a + b, 0);
          }
          return parseInt(sets, 10) || 0;
        }
        return 0;
      };

      for (const dispatch of lotDetailsData) {
        const setsValue = calculateSetsValue(dispatch.sets);
        const loosePcsValue = dispatch.loosePcs || 0;
        const totalQtyValue = dispatch.quantity || 0;

        if (yPos > pageHeight - 55) {
          doc.setLineWidth(0.3);
          doc.rect(startX, yPos, totalTableWidth, rowHeight);

          doc.setFont("times", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(0, 0, 0);

          let totalX = startX;
          const totalValues = [
            "",
            "TOTAL",
            "",
            "",
            runningTotalSets.toString(),
            "",
            runningTotalLoosePcs.toString(),
            runningTotalQty.toString()
          ];

          totalValues.forEach((value, colIndex) => {
            const col = tableColumns[colIndex];
            let textXPos;

            if (colIndex === 1) {
              textXPos = totalX + 2;
              doc.text(value, textXPos, yPos + 5, { align: "left" });
            } else if (col.align === "center") {
              textXPos = totalX + (col.width / 2);
              doc.text(value, textXPos, yPos + 5, { align: "center" });
            } else if (col.align === "right") {
              textXPos = totalX + col.width - 2;
              doc.text(value, textXPos, yPos + 5, { align: "right" });
            } else {
              textXPos = totalX + 2;
              doc.text(value, textXPos, yPos + 5, { align: "left" });
            }

            totalX += col.width;
          });

          doc.addPage();
          yPos = 15;

          runningTotalSets = 0;
          runningTotalQty = 0;
          runningTotalLoosePcs = 0;

          doc.setLineWidth(0.8);
          doc.rect(6, 6, pageWidth - 12, pageHeight - 12);
          doc.setLineWidth(0.3);
          doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

          doc.setFillColor(200, 200, 200);
          doc.rect(startX, yPos, totalTableWidth, 8, 'F');
          doc.rect(startX, yPos, totalTableWidth, 8);

          headerX = startX;
          tableColumns.forEach(col => {
            doc.setFont("times", "bold");
            doc.setFontSize(9);

            let textX;
            if (col.align === "center") {
              textX = headerX + (col.width / 2);
              doc.text(col.header, textX, yPos + 5.5, { align: "center" });
            } else if (col.align === "right") {
              textX = headerX + col.width - 2;
              doc.text(col.header, textX, yPos + 5.5, { align: "right" });
            } else {
              textX = headerX + 2;
              doc.text(col.header, textX, yPos + 5.5, { align: "left" });
            }

            headerX += col.width;

            if (headerX < startX + totalTableWidth) {
              doc.line(headerX, yPos, headerX, yPos + 8);
            }
          });
          yPos += 8;
        }

        doc.setLineWidth(0.2);
        doc.rect(startX, yPos, totalTableWidth, rowHeight);

        const partyInfo = dispatch.partyName || '';
        const packingInfo = dispatch.packingNumber ? ` (${dispatch.packingNumber})` : '';
        const description = dispatch.description || '';

        let particulars = partyInfo;
        if (description && description !== partyInfo) {
          particulars = `${partyInfo} - ${description}`;
        }
        if (packingInfo) {
          particulars += packingInfo;
        }

        if (particulars.length > 45) {
          particulars = particulars.substring(0, 42) + "...";
        }

        let displaySetsValue = dispatch.sets || 0;
        if (typeof displaySetsValue === 'number') {
          displaySetsValue = displaySetsValue.toString();
        }

        const rowData = [
          dispatch.dispatchDate || '',
          particulars,
          'Sales',
          dispatch.packingNumber || '',
          displaySetsValue,
          dispatch.setsPerPcs || 0,
          loosePcsValue.toString(),
          totalQtyValue.toString()
        ];

        runningTotalSets += setsValue;
        runningTotalLoosePcs += loosePcsValue;
        runningTotalQty += totalQtyValue;

        let textX = startX;
        doc.setFont("times", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(0, 0, 0);

        rowData.forEach((value, colIndex) => {
          const col = tableColumns[colIndex];

          let displayValue = value;
          if (colIndex === 1 && displayValue.length > 45) {
            displayValue = displayValue.substring(0, 42) + "...";
          }

          let textXPos;
          if (col.align === "center") {
            textXPos = textX + (col.width / 2);
            doc.text(displayValue, textXPos, yPos + 5, { align: "center" });
          } else if (col.align === "right") {
            textXPos = textX + col.width - 2;
            doc.text(displayValue, textXPos, yPos + 5, { align: "right" });
          } else {
            textXPos = textX + 2;
            doc.text(displayValue, textXPos, yPos + 5, { align: "left" });
          }

          textX += col.width;
        });

        yPos += rowHeight;
        rowCount++;
      }

      doc.setLineWidth(0.3);
      doc.rect(startX, yPos, totalTableWidth, rowHeight);

      doc.setFillColor(240, 240, 240);
      doc.rect(startX, yPos, totalTableWidth, rowHeight, 'F');

      doc.setFont("times", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);

      let totalX = startX;
      const totalValues = [
        "",
        "TOTAL",
        "",
        "",
        runningTotalSets.toString(),
        "",
        runningTotalLoosePcs.toString(),
        runningTotalQty.toString()
      ];

      totalValues.forEach((value, colIndex) => {
        const col = tableColumns[colIndex];
        let textXPos;

        if (colIndex === 1) {
          textXPos = totalX + 2;
          doc.text(value, textXPos, yPos + 5, { align: "left" });
        } else if (col.align === "center") {
          textXPos = totalX + (col.width / 2);
          doc.text(value, textXPos, yPos + 5, { align: "center" });
        } else if (col.align === "right") {
          textXPos = totalX + col.width - 2;
          doc.text(value, textXPos, yPos + 5, { align: "right" });
        } else {
          textXPos = totalX + 2;
          doc.text(value, textXPos, yPos + 5, { align: "left" });
        }

        totalX += col.width;
      });

      yPos += rowHeight;

      yPos += 1;
      doc.setLineWidth(0.5);
      doc.line(startX, yPos, startX + totalTableWidth, yPos);
      doc.setLineWidth(0.3);
      doc.line(startX, yPos + 1, startX + totalTableWidth, yPos + 1);
      yPos += 8;

      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated by: ${preparedBy} (${userRole}) on ${new Date().toLocaleString()}`, leftMargin, pageHeight - 10);
      doc.setTextColor(0, 0, 0);

      const fileName = `StockItemRegister_${lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      showToast(`Stock Item Register PDF generated successfully`, "success");

    } catch (error) {
      console.error("PDF Generation Error:", error);
      showToast("Failed to generate PDF", "error");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // LotDetailsModal component extracted to module scope

  const openLotDetails = (lotNumber) => {
    if (!lotNumber) {
      showToast("No lot number selected", "warning");
      return;
    }
    fetchLotDetails(lotNumber);
    setIsLotDetailsModalOpen(true);
  };

  return (
    <div className="blue-container">
      <input ref={barcodeInputRef} type="text" style={{ position: 'fixed', top: '-100px', left: '-100px', opacity: 0, pointerEvents: 'none' }} />

      {(generatingPDF || savingToSheet || processingStage) && (
        <div className="blue-overlay">
          <div className="blue-processing-card">
            {processingStage === 'pdf' && (
              <>
                <div className="blue-processing-icon">📄</div>
                <div className="blue-processing-title">Generating PDF...</div>
                <div className="blue-progress-bar"><div className="blue-progress-fill" style={{ width: '60%' }}></div></div>
              </>
            )}
            {processingStage === 'sheet' && (
              <>
                <div className="blue-processing-icon">💾</div>
                <div className="blue-processing-title">Saving to Sheets...</div>
                <div className="blue-progress-bar"><div className="blue-progress-fill" style={{ width: '85%' }}></div></div>
              </>
            )}
            {processingStage === 'complete' && showSuccessAnimation && (
              <>
                <div className="blue-processing-icon blue-success">✓</div>
                <div className="blue-processing-title">Complete!</div>
              </>
            )}
          </div>
        </div>
      )}

      {isDebugModalOpen && (
        <DebugConsoleModal
          setIsDebugModalOpen={setIsDebugModalOpen}
          debugContainerRef={debugContainerRef}
          scannerDebug={scannerDebug}
          setScannerDebug={setScannerDebug}
          addDebugMessage={addDebugMessage}
        />
      )}
      {isEditModalOpen && (
        <EditItemModal
          editItemData={editItemData}
          setEditItemData={setEditItemData}
          setIsEditModalOpen={setIsEditModalOpen}
          saveEditedItem={saveEditedItem}
        />
      )}
      {isConfirmModalOpen && (
        <ConfirmationModal
          tempBillData={tempBillData}
          setTempBillData={setTempBillData}
          isProcessingDraft={isProcessingDraft}
          savingToSheet={savingToSheet}
          generatingPDF={generatingPDF}
          setIsConfirmModalOpen={setIsConfirmModalOpen}
          preparedBy={preparedBy}
          userRole={userRole}
          selectedPartyState={selectedPartyState}
          openLotDetails={openLotDetails}
          openEditModal={openEditModal}
          handleFinalAction={handleFinalAction}
        />
      )}
      <DraftSavingOverlay
        savingToSheet={savingToSheet}
        generatingPDF={generatingPDF}
        processingStage={processingStage}
        isProcessingDraft={isProcessingDraft}
      />
      {isLotDetailsModalOpen && (
        <LotDetailsModal
          selectedLotForDetails={selectedLotForDetails}
          setIsLotDetailsModalOpen={setIsLotDetailsModalOpen}
          lotDetailsData={lotDetailsData}
          loadingLotDetails={loadingLotDetails}
          generateLotSummaryPDF={generateLotSummaryPDF}
        />
      )}

      {/* <div className="blue-user-bar">
        <span style={{ fontSize: '14px' }}>👤</span>
        <div>
          <strong>Logged in as:</strong> {preparedBy}
          <span style={{ marginLeft: '6px', opacity: 0.8 }}>({userRole})</span>
        </div>
        {userEmail && (
          <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
            📧 {userEmail}
          </span>
        )}
      </div> */}

      {selectedPartyState && (
        <div className="blue-party-banner">
          <div className="blue-party-content">
            <div className="blue-party-icon">🏢</div>
            <div className="blue-party-info">
              <div className="blue-party-name">PACKING LIST :- {selectedPartyState.name}</div>
              {selectedPartyState.contact && (
                <div className="blue-party-contact">📞 {selectedPartyState.contact}</div>
              )}
              {selectedPartyState.address && (
                <div className="blue-party-address">📍 {selectedPartyState.address}</div>
              )}
            </div>
            <div className="blue-party-badge-group">
              <div className="blue-scanner-status">
                <span className={`blue-scanner-led ${isScannerActive ? 'active' : 'inactive'}`}></span>
                <span className="blue-scanner-text">{isScannerActive ? 'Scanner Active' : 'Scanner Ready'}</span>
              </div>
              <button
                onClick={() => setIsDebugModalOpen(true)}
                className="blue-debug-button"
                title="Open Debug Console"
              >
                🔧 Debug
              </button>
              <div
                className="blue-auto-email-pill"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#059669',
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  marginLeft: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Nightly summary emails with Tally PDF attachments are automatically delivered every day at 10:00 PM IST"
              >
                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 6px #10b981' }}></span>
                ⏰ Auto Nightly Emails: 10:00 PM
              </div>
              <div className="blue-party-badge">Active</div>
            </div>
          </div>
        </div>
      )}

      <div className="blue-header">
        <div className="blue-logo">
          <div className="blue-logo-icon">📦</div>
          <div>
            <h1 className="blue-title">Packing List Pro</h1>
            <p className="blue-subtitle">Barcode Scanning & Packing Lists</p>
          </div>
        </div>
        <div className="blue-actions">
          <button onClick={testScanner} className="blue-btn blue-btn-outline">🔍 Test Scanner</button>
          <button onClick={refreshSheetData} className="blue-btn blue-btn-outline" disabled={loading}>🔄 {loading ? "Loading..." : "Refresh"}</button>
          <button onClick={() => {
            if (onBack) {
              onBack();
            } else {
              navigate('/');
            }
          }} className="blue-btn blue-btn-secondary">← Dashboard</button>
        </div>
      </div>

      <div className="blue-layout traditional">

        <div className="blue-add-item-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">➕</span>
              <h2>Add New Item</h2>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="blue-btn blue-btn-primary">
              + Add Item
            </button>
          </div>
        </div>

        <div className="blue-items-section-traditional">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">📋</span>
              <h2>Packing List Items</h2>
            </div>
            <span className="blue-badge">{billForm.items.length} items</span>
          </div>

          {billForm.items.length > 0 ? (
            <div className="blue-table-wrapper">
              <table className="blue-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>LOT NO</th>
                    <th>PART NO</th>
                    <th>BRAND</th>
                    <th>DESCRIPTION</th>
                    <th>SETS</th>
                    <th>PCS/SET</th>
                    <th>OP</th>
                    <th>LOOSE</th>
                    <th>TOTAL</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {billForm.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="blue-sno">{index + 1}</td>
                      <td className="blue-lot-cell">
                        {item.lotNumber || '-'}
                        {item.lotNumber && (
                          <button
                            onClick={() => openLotDetails(item.lotNumber)}
                            className="blue-lot-details-btn"
                            title="View lot dispatch history"
                          >
                            📊
                          </button>
                        )}
                      </td>
                      <td className="blue-partno-cell">
                        <input
                          type="text"
                          value={item.partNo || ''}
                          onChange={(e) => updateItemDetails(index, "partNo", e.target.value)}
                          placeholder="Part No"
                          className="blue-input-sm"
                          style={{ width: '70px', fontWeight: 'bold' }}
                        />
                      </td>
                      <td className="blue-brand-cell">{item.brand || '-'}</td>
                      <td className="blue-item-name">
                        {item.description}
                      </td>
                      <td><input type="number" value={item.sets} onChange={(e) => updateItemDetails(index, "sets", e.target.value)} className="blue-input-sm" /></td>
                      <td><input type="number" value={item.setsPerPcs} onChange={(e) => updateItemDetails(index, "setsPerPcs", e.target.value)} className="blue-input-sm" /></td>
                      <td className="blue-qty-cell">{item.looseOperation === 'subtract' ? '➖' : '➕'}</td>
                      <td><input type="number" value={item.loosePcs || 0} onChange={(e) => updateItemDetails(index, "loosePcs", e.target.value)} className="blue-input-sm" /></td>
                      <td className="blue-qty">{item.quantity}</td>
                      <td className="blue-actions-cell">
                        <div className="blue-actions-wrapper">
                          <button onClick={() => openEditModal(index)} className="blue-edit-btn" title="Edit Item">✏️</button>
                          <button onClick={() => removeItem(index)} className="blue-remove" title="Remove Item">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="9" className="blue-footer-label">TOTAL ITEMS:</td>
                    <td className="blue-footer-value">{billForm.items.length} ITEMS</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="9" className="blue-footer-label">TOTAL QUANTITY:</td>
                    <td className="blue-footer-value">{billForm.items.reduce((sum, item) => sum + (item.quantity || 0), 0)} PCS</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="blue-empty">
              <div className="blue-empty-icon">📦</div>
              <p>No items added yet</p>
              <span>Click "Add Item" to start adding products</span>
            </div>
          )}
        </div>

        <div className="blue-notes-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">📝</span>
              <h2>Additional Notes</h2>
            </div>
          </div>
          <textarea
            value={billForm.notes}
            onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
            placeholder="Add any additional notes or instructions..."
            className="blue-textarea"
            rows="3"
          />
        </div>

        <div className="blue-bill-info-section">
          <div className="blue-section-header">
            <div className="blue-section-header-left">
              <span className="blue-section-icon">ℹ️</span>
              <h2>Bill Information</h2>
            </div>
          </div>
          <div className="blue-info-grid">
            <div className="blue-info-field">
              <label>Bill Date</label>
              <input
                type="date"
                value={billForm.billDate}
                onChange={(e) => setBillForm({ ...billForm, billDate: e.target.value })}
                className="blue-input"
              />
            </div>
            <div className="blue-info-field">
              <label>Due Date (Optional)</label>
              <input
                type="date"
                value={billForm.dueDate}
                onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
                className="blue-input"
              />
            </div>
            <div className="blue-info-field">
              <label>Order Reference (Optional)</label>
              <input
                type="text"
                value={billForm.orderReference || ""}
                onChange={(e) => setBillForm({ ...billForm, orderReference: e.target.value })}
                className="blue-input"
                placeholder="PO # / Order #"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="blue-generate-section">
        <button
          onClick={openConfirmationModal}
          className="blue-btn blue-btn-generate"
          disabled={generatingPDF || savingToSheet || billForm.items.length === 0 || !selectedPartyState}
        >
          {generatingPDF ? "⏳ Generating PDF..." : savingToSheet ? "💾 Saving..." : "📄 Generate Packing List"}
        </button>
      </div>

      {isModalOpen && (
        <div className="blue-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="blue-modal blue-modal-with-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="blue-modal-header">
              <div className="blue-modal-header-left">
                <span className="blue-modal-icon">➕</span>
                <h3>Add New Item</h3>
                <span className="blue-modal-badge">Barcode Scanner</span>
              </div>
              <button className="blue-modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <div className="blue-modal-body-with-sidebar">
              {/* LEFT SIDEBAR - Lot Suggestions Panel */}
              <div className="blue-modal-sidebar">
                <div className="blue-sidebar-header">
                  <span className="blue-sidebar-icon">🔍</span>
                  <h4>OLD Lot Search</h4>
                </div>

                <div className="blue-sidebar-search">
                  <input
                    type="text"
                    ref={modalLotSearchInputRef}
                    value={lotSearchTerm}
                    onChange={(e) => {
                      const value = e.target.value;  // ← Allow any characters
                      setLotSearchTerm(value);
                      setManualLotInput(value);
                      searchLotsWithSuggestions(value);
                    }}
                    onKeyDown={handleLotInputKeyDown}
                    placeholder="Enter Lot Number..."
                    className="blue-sidebar-input"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNumericKeyboard(true)}
                    className="blue-sidebar-keyboard-btn"
                    title="Open Numeric Keyboard"
                  >
                    📱
                  </button>
                </div>

                <div className="blue-sidebar-suggestions">
                  {loadingLotSummary ? (
                    <div className="blue-sidebar-loading">
                      <div className="blue-spinner-small"></div>
                      <p>Loading suggestions...</p>
                    </div>
                  ) : lotSuggestions.length > 0 ? (
                    lotSuggestions.map((suggestion, idx) => (
                      <div
                        key={suggestion.id || `${suggestion.lotNumber}-${idx}`}
                        className={`blue-sidebar-suggestion-item ${selectedSuggestionIndex === idx ? 'selected' : ''}`}
                        onClick={() => selectLotFromSuggestion(suggestion)}
                        onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                      >
                        <div className="blue-suggestion-main">
                          <span className="blue-suggestion-lot">📦 LOT: {suggestion.lotNumber}</span>
                          {suggestion.isOldLot && (
                            <span className="blue-old-lot-tag">OLD STOCK</span>
                          )}
                        </div>
                        <div className="blue-suggestion-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', width: '100%', marginTop: '6px' }}>
                          <span className="blue-suggestion-item" style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                            {suggestion.displayDescription || suggestion.description}
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                            {suggestion.brand && (
                              <span className="blue-suggestion-brand">🏷️ {suggestion.brand}</span>
                            )}
                            {suggestion.piecesPerSet > 0 && (
                              <span className="blue-suggestion-pcs">📊 {suggestion.piecesPerSet} Pc/Set</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : lotSearchTerm ? (
                    <div className="blue-sidebar-empty">
                      <span className="blue-empty-icon">🔍</span>
                      <p>No matching lots found</p>
                      <span className="blue-empty-hint">Try a different lot number</span>
                    </div>
                  ) : (
                    <div className="blue-sidebar-empty">
                      <span className="blue-empty-icon">📦</span>
                      <p>Enter a lot number to search</p>
                      <span className="blue-empty-hint">Type lot number to see suggestions</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT CONTENT - Product Details */}
              <div className="blue-modal-content">
                <div className="blue-modal-section blue-barcode-section">
                  <div className="blue-section-header">
                    <div className="blue-section-header-left">
                      <span className="blue-section-icon">🔖</span>
                      <h4>Scan Barcode</h4>
                    </div>
                    <span className="blue-scanner-hint">Press Enter after scan</span>
                  </div>
                  <div className="blue-section-content">
                    <form onSubmit={handleManualBarcodeSubmit} className="blue-barcode-form">
                      <div className="blue-input-group">
                        <span className="blue-input-icon">📷</span>
                        <input
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Scan or manually enter barcode..."
                          className="blue-input blue-input-large"
                          ref={modalBarcodeInputRef}
                          autoFocus
                        />
                        <button type="submit" className="blue-btn blue-btn-primary">
                          <span>🔍</span> Search
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="blue-modal-section blue-product-details">
                  <div className="blue-section-header">
                    <div className="blue-section-header-left">
                      <span className="blue-section-icon">🏷️</span>
                      <h4>Product Details</h4>
                    </div>
                    <span className="blue-auto-fill-badge">Auto-fill enabled</span>
                  </div>
                  <div className="blue-section-content">
                    <div className="blue-form-grid two-col">
                      <div className="blue-form-field">
                        <label>Barcode ID</label>
                        <input
                          type="text"
                          value={currentProduct.barcode}
                          onChange={(e) => updateCurrentProduct("barcode", e.target.value)}
                          className="blue-input"
                          placeholder="Auto-filled"
                        />
                      </div>
                      <div className="blue-form-field">
                        <label>Lot Number</label>
                        <input
                          type="text"
                          value={currentProduct.lotNumber}
                          onChange={(e) => updateCurrentProduct("lotNumber", e.target.value)}
                          className="blue-input"
                          placeholder="Auto-filled"
                        />
                      </div>
                      <div className="blue-form-field">
                        <label>Brand / Party</label>
                        <input
                          type="text"
                          value={currentProduct.brand}
                          onChange={(e) => updateCurrentProduct("brand", e.target.value)}
                          className="blue-input"
                          placeholder="Auto-filled"
                        />
                      </div>
                      <div className="blue-form-field">
                        <label>Item Name *</label>
                        <input
                          type="text"
                          value={currentProduct.item}
                          onChange={(e) => updateCurrentProduct("item", e.target.value)}
                          className="blue-input"
                          placeholder="Required"
                        />
                      </div>
                      <div className="blue-form-field blue-highlight-field">
                        <label>📦 Number of Sets *</label>
                        <input
                          type="number"
                          value={currentProduct.sets}
                          onChange={(e) => updateCurrentProduct("sets", e.target.value)}
                          className="blue-input blue-sets-input"
                          placeholder="Enter quantity"
                        />
                      </div>
                      <div className="blue-form-field">
                        <label>🔢 Pieces per Set (Pc/Set)</label>
                        <input
                          type="number"
                          value={currentProduct.setsPerPcs}
                          readOnly
                          className="blue-input blue-input-readonly"
                          placeholder="Auto-filled from database"
                          style={{ backgroundColor: '#f0f4ff' }}
                        />
                        <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                          This value is auto-filled from the database
                        </small>
                      </div>
                      <div className="blue-form-field">
                        <label>➕➖ Operation</label>
                        <select
                          value={currentProduct.looseOperation}
                          onChange={(e) => updateCurrentProduct("looseOperation", e.target.value)}
                          className="blue-select"
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        >
                          <option value="add">➕ Addition (Add to total)</option>
                          <option value="subtract">➖ Subtraction (Subtract from total)</option>
                        </select>
                      </div>
                      <div className="blue-form-field">
                        <label>📦 Loose Pieces</label>
                        <input
                          type="number"
                          value={currentProduct.loosePcs}
                          onChange={(e) => updateCurrentProduct("loosePcs", e.target.value)}
                          className="blue-input"
                          placeholder="0"
                        />
                        <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                          {currentProduct.looseOperation === 'add'
                            ? 'These pieces will be ADDED to the total quantity'
                            : 'These pieces will be SUBTRACTED from the total quantity'}
                        </small>
                      </div>
                      <div className="blue-form-field blue-total-field">
                        <label>📊 Total Quantity</label>
                        <input
                          type="number"
                          value={currentProduct.quantity}
                          readOnly
                          className="blue-input blue-total-input"
                        />
                        <small style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'block' }}>
                          Formula: (Sets × Pc/Set) {currentProduct.looseOperation === 'add' ? '+' : '-'} Loose Pieces
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="blue-modal-section blue-lot-summary-panel">
                  <div className="blue-section-header">
                    <div className="blue-section-header-left">
                      <span className="blue-section-icon">📊</span>
                      <h4>Lot Dispatch Summary</h4>
                    </div>
                    <button
                      onClick={() => currentProduct.lotNumber && openLotDetails(currentProduct.lotNumber)}
                      className="blue-btn blue-btn-outline blue-btn-small"
                      disabled={!currentProduct.lotNumber}
                    >
                      📋 See Lot Details
                    </button>
                    {loadingLotSummary && <div className="blue-loading-spinner-small"></div>}
                  </div>
                  <div className="blue-section-content">
                    {currentProduct.lotNumber ? (
                      (() => {
                        // Try to find lot in summary
                        let lotInfo = lotSummary.find(l => l.lotNumber === currentProduct.lotNumber);

                        // If not found and we're not already loading, fetch updated summary
                        if (!lotInfo && !loadingLotSummary && currentProduct.lotNumber) {
                          // Trigger a refresh of lot summary
                          setTimeout(() => fetchLotSummary(), 100);
                          return (
                            <div className="blue-lot-empty">
                              <span className="blue-empty-icon">🔄</span>
                              <p>Loading lot information...</p>
                              <span className="blue-empty-hint">Fetching dispatch data for this lot</span>
                            </div>
                          );
                        }

                        // If still loading
                        if (loadingLotSummary) {
                          return (
                            <div className="blue-lot-empty">
                              <div className="blue-spinner-small"></div>
                              <p>Loading lot information...</p>
                            </div>
                          );
                        }

                        // If lotInfo exists, display it
                        if (lotInfo && lotInfo.isOldLot) {
                          return (
                            <div className="blue-lot-summary-detail">
                              <div className="blue-lot-badge">
                                <span className="blue-lot-badge-label">LOT</span>
                                <span className="blue-lot-badge-number">{currentProduct.lotNumber}</span>
                                <span className="blue-old-lot-badge">OLD STOCK</span>
                              </div>
                              <div className="blue-lot-details-metadata" style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px',
                                padding: '14px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                fontSize: '13px',
                                color: '#1e293b'
                              }}>
                                <div><strong>Item:</strong> {lotInfo.itemName || 'N/A'}</div>
                                <div><strong>Brand:</strong> {lotInfo.brand || 'N/A'}</div>

                              </div>
                              <div className="blue-lot-metrics-grid">
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Total Pieces</div>
                                  <div className="blue-metric-value">∞</div>
                                  <div className="blue-metric-hint">Unlimited</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Dispatched So Far</div>
                                  <div className="blue-metric-value blue-dispatched-value">{lotInfo.dispatchedQty.toLocaleString()}</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Available</div>
                                  <div className="blue-metric-value blue-unlimited">Unlimited</div>
                                </div>
                              </div>
                              <div className="blue-alert blue-alert-info" style={{ marginTop: '12px' }}>
                                ℹ️ This is an old stock lot. No quantity restrictions apply.
                              </div>
                            </div>
                          );
                        } else if (lotInfo && lotInfo.totalPieces > 0) {
                          return (
                            <div className="blue-lot-summary-detail">
                              <div className="blue-lot-badge">
                                <span className="blue-lot-badge-label">LOT</span>
                                <span className="blue-lot-badge-number">{currentProduct.lotNumber}</span>
                              </div>
                              <div className="blue-lot-details-metadata" style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px',
                                padding: '14px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                fontSize: '13px',
                                color: '#1e293b'
                              }}>
                                <div><strong>Item:</strong> {lotInfo.itemName || 'N/A'}</div>
                                <div><strong>Brand:</strong> {lotInfo.brand || 'N/A'}</div>

                              </div>
                              <div className="blue-lot-metrics-grid">
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Total Pieces</div>
                                  <div className="blue-metric-value">{lotInfo.totalPieces.toLocaleString()}</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Dispatched</div>
                                  <div className="blue-metric-value blue-dispatched-value">{lotInfo.dispatchedQty.toLocaleString()}</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Available</div>
                                  <div className={`blue-metric-value ${lotInfo.availablePieces <= 0 ? 'blue-out-of-stock' : 'blue-in-stock'}`}>
                                    {lotInfo.availablePieces.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className={`blue-lot-status ${lotInfo.status === 'COMPLETED' ? 'blue-status-completed' : lotInfo.status === 'PARTIAL' ? 'blue-status-partial' : 'blue-status-pending'}`}>
                                <span className="blue-status-dot"></span>
                                {lotInfo.status}
                              </div>
                              {lotInfo.availablePieces <= 0 && (
                                <div className="blue-alert blue-alert-error">
                                  ⚠️ This lot is fully dispatched! No pieces available.
                                </div>
                              )}
                            </div>
                          );
                        } else if (lotInfo) {
                          // Lot exists but has no pieces (new lot not yet in summary)
                          return (
                            <div className="blue-lot-summary-detail">
                              <div className="blue-lot-badge">
                                <span className="blue-lot-badge-label">LOT</span>
                                <span className="blue-lot-badge-number">{currentProduct.lotNumber}</span>
                                <span className="blue-new-lot-badge">NEW LOT</span>
                              </div>
                              <div className="blue-lot-details-metadata" style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '10px',
                                padding: '14px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                fontSize: '13px',
                                color: '#1e293b'
                              }}>
                                <div><strong>Item:</strong> {lotInfo.itemName || 'N/A'}</div>
                                <div><strong>Brand:</strong> {lotInfo.brand || 'N/A'}</div>

                              </div>
                              <div className="blue-lot-metrics-grid">
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Total Pieces</div>
                                  <div className="blue-metric-value">{lotInfo.totalPieces?.toLocaleString() || '0'}</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Dispatched</div>
                                  <div className="blue-metric-value blue-dispatched-value">{lotInfo.dispatchedQty?.toLocaleString() || '0'}</div>
                                </div>
                                <div className="blue-metric-card">
                                  <div className="blue-metric-label">Available</div>
                                  <div className="blue-metric-value blue-in-stock">
                                    {lotInfo.availablePieces?.toLocaleString() || '0'}
                                  </div>
                                </div>
                              </div>
                              <div className="blue-lot-status blue-status-pending">
                                <span className="blue-status-dot"></span>
                                PENDING
                              </div>
                              <div className="blue-alert blue-alert-info" style={{ marginTop: '12px' }}>
                                ℹ️ This is a new lot. No previous dispatches recorded.
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="blue-lot-empty">
                              <span className="blue-empty-icon">🔍</span>
                              <p>Lot not found in database</p>
                              <span className="blue-empty-hint">Please check the lot number</span>
                            </div>
                          );
                        }
                      })()
                    ) : (
                      <div className="blue-lot-empty">
                        <span className="blue-empty-icon">🔍</span>
                        <p>No lot selected</p>
                        <span className="blue-empty-hint">Select a lot from the left panel</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="blue-modal-footer">
              <button onClick={() => setIsModalOpen(false)} className="blue-btn blue-btn-secondary">
                Cancel
              </button>

              <button
                onClick={() => addProductToBill(true)}
                className="blue-btn blue-btn-success blue-btn-large"
                disabled={!currentProduct.barcode || !currentProduct.item || !currentProduct.sets || currentProduct.quantity <= 0}
                style={{ backgroundColor: '#10b981', color: '#ffffff', fontWeight: 'bold' }}
                title="Add this lot and stay in modal to add another lot immediately"
              >
                <span>🔄</span> Add & Next Lot
              </button>

              <button
                onClick={() => addProductToBill(false)}
                className="blue-btn blue-btn-primary blue-btn-large"
                disabled={!currentProduct.barcode || !currentProduct.item || !currentProduct.sets || currentProduct.quantity <= 0}
              >
                <span>✅</span> Add & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showNumericKeyboard && (
        <NumericKeyboard
          onKeyPress={handleKeyboardKeyPress}
          onSubmit={handleKeyboardSubmit}
          onClose={() => setShowNumericKeyboard(false)}
          value={manualLotInput}
        />
      )}

      {loading && !processingStage && (
        <div className="blue-loading">
          <div className="blue-spinner"></div>
          <p>Loading products...</p>
        </div>
      )}
    </div>
  );
};

// ==================== EXTRACTED SUB-COMPONENTS ====================

const DraftSavingOverlay = React.memo(({ savingToSheet, generatingPDF, processingStage, isProcessingDraft }) => {
  if (!savingToSheet && !generatingPDF && !processingStage) return null;

  const isDraft = isProcessingDraft || (!generatingPDF && savingToSheet && processingStage !== 'pdf');

  let title = "Processing Submission";
  let subtitle = "Syncing data with server...";
  let stagePercent = 30;

  if (processingStage === 'sheet' || (savingToSheet && processingStage !== 'pdf')) {
    title = isDraft ? "Saving Draft to Database..." : "1. Saving Bill to Database...";
    subtitle = "Storing dispatch records & lot items in server database...";
    stagePercent = 50;
  } else if (processingStage === 'pdf' || generatingPDF) {
    title = isDraft ? "Generating Draft PDF..." : "2. Generating & Downloading PDF...";
    subtitle = "✓ Stored in database! Preparing document download...";
    stagePercent = 85;
  } else if (processingStage === 'complete') {
    title = "Saved & Downloaded Successfully!";
    subtitle = "All records stored in database and PDF downloaded.";
    stagePercent = 100;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '32px 36px',
        width: '420px',
        maxWidth: '90vw',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.15)',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Top Accent Gradient Bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: processingStage === 'complete'
            ? 'linear-gradient(90deg, #10b981, #34d399)'
            : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)'
        }}></div>

        {/* Dynamic Icon / Loading Indicator */}
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 20px auto',
          borderRadius: '50%',
          backgroundColor: processingStage === 'complete' ? '#ecfdf5' : '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: processingStage === 'complete'
            ? '0 0 0 8px rgba(16, 185, 129, 0.1)'
            : '0 0 0 8px rgba(59, 130, 246, 0.1)'
        }}>
          {processingStage === 'complete' ? (
            <span style={{ color: '#10b981' }}>✅</span>
          ) : (
            <div style={{
              width: '30px',
              height: '30px',
              border: '3px solid #bfdbfe',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
          )}
        </div>

        {/* Title */}
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: '700',
          color: '#1e293b',
          letterSpacing: '-0.01em'
        }}>
          {title}
        </h3>

        {/* Subtitle */}
        <p style={{
          margin: '0 0 24px 0',
          fontSize: '13px',
          color: '#64748b',
          lineHeight: '1.4'
        }}>
          {subtitle}
        </p>

        {/* Stage Badges */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
          fontSize: '11px',
          fontWeight: '600',
          color: '#64748b',
          padding: '0 8px'
        }}>
          <span style={{ color: (processingStage === 'pdf' || processingStage === 'complete') ? '#10b981' : (processingStage === 'sheet' || savingToSheet) ? '#2563eb' : '#94a3b8' }}>
            {(processingStage === 'pdf' || processingStage === 'complete') ? '✓ 1. Database Saved' : '1. Database Storage'}
          </span>
          <span style={{ color: processingStage === 'complete' ? '#10b981' : (processingStage === 'pdf' || generatingPDF) ? '#2563eb' : '#94a3b8' }}>
            {processingStage === 'complete' ? '✓ 2. PDF Downloaded' : '2. PDF Download'}
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{
          height: '6px',
          backgroundColor: '#f1f5f9',
          borderRadius: '3px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            width: `${stagePercent}%`,
            background: processingStage === 'complete'
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #2563eb, #3b82f6)',
            borderRadius: '3px',
            transition: 'width 0.4s ease-out'
          }}></div>
        </div>

        {/* Bottom Security Notice */}
        <div style={{
          marginTop: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          backgroundColor: '#f8fafc',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          fontSize: '11px',
          color: '#64748b'
        }}>
          <span>🔒</span>
          <span>Secured Direct Server Sync</span>
        </div>
      </div>
    </div>
  );
});

const DebugConsoleModal = React.memo(({
  setIsDebugModalOpen,
  debugContainerRef,
  scannerDebug,
  setScannerDebug,
  addDebugMessage
}) => {
  return (
    <div className="blue-modal-overlay" onClick={() => setIsDebugModalOpen(false)}>
      <div className="blue-modal blue-debug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="blue-modal-header">
          <div className="blue-modal-header-left">
            <span className="blue-modal-icon">🔧</span>
            <h3>Debug Console</h3>
            <span className="blue-modal-badge">Scanner Activity</span>
          </div>
          <button className="blue-modal-close" onClick={() => setIsDebugModalOpen(false)}>✕</button>
        </div>
        <div className="blue-modal-body">
          <div className="blue-debug-messages-full" ref={debugContainerRef}>
            {scannerDebug.length === 0 ? (
              <div className="blue-debug-empty-full">
                <span className="blue-empty-icon">📡</span>
                <p>No scanner activity yet...</p>
                <span className="blue-empty-hint">Scan a barcode to see debug messages</span>
              </div>
            ) : (
              scannerDebug.map((debug, idx) => (
                <div key={idx} className={`blue-debug-msg-full ${debug.type}`}>
                  <span className="blue-debug-time">[{debug.timestamp}]</span>
                  <span className="blue-debug-message">{debug.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="blue-modal-footer">
          <button
            onClick={() => {
              setScannerDebug([]);
              addDebugMessage("Debug console cleared", 'info');
            }}
            className="blue-btn blue-btn-secondary"
          >
            Clear Console
          </button>
          <button onClick={() => setIsDebugModalOpen(false)} className="blue-btn blue-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

const EditItemModal = React.memo(({
  editItemData,
  setEditItemData,
  setIsEditModalOpen,
  saveEditedItem
}) => {
  const [formData, setFormData] = useState({
    sets: 0,
    setsPerPcs: 0,
    looseOperation: "add",
    loosePcs: 0,
    partNo: "",
    rate: ""
  });

  useEffect(() => {
    if (editItemData) {
      setFormData({
        sets: editItemData.sets || 0,
        setsPerPcs: editItemData.setsPerPcs || 0,
        looseOperation: editItemData.looseOperation || "add",
        loosePcs: editItemData.loosePcs || 0,
        partNo: editItemData.partNo || extractPartNo(editItemData) || "",
        rate: editItemData.rate || extractRate(editItemData) || ""
      });
    }
  }, [editItemData]);

  const calculateQuantity = (sets, setsPerPcs, loosePcs, looseOperation) => {
    const baseQty = (parseInt(sets) || 0) * (parseInt(setsPerPcs) || 0);
    const loose = parseInt(loosePcs) || 0;
    return looseOperation === "subtract" ? Math.max(0, baseQty - loose) : baseQty + loose;
  };

  const totalQuantity = calculateQuantity(
    formData.sets,
    formData.setsPerPcs,
    formData.loosePcs,
    formData.looseOperation
  );

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const saveChanges = () => {
    if (!editItemData) return;
    const updatedItem = {
      ...editItemData,
      ...formData,
      quantity: totalQuantity,
      partNo: formData.partNo || extractPartNo(editItemData) || "",
      rate: formData.rate || extractRate(editItemData) || ""
    };
    setEditItemData(updatedItem);
    saveEditedItem();
  };

  if (!editItemData) return null;

  return (
    <div className="blue-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
      <div className="blue-modal blue-modal-medium" onClick={(e) => e.stopPropagation()}>
        <div className="blue-modal-header">
          <div className="blue-modal-header-left">
            <span className="blue-modal-icon">✏️</span>
            <h3>Edit Item</h3>
          </div>
          <button className="blue-modal-close" onClick={() => setIsEditModalOpen(false)}>✕</button>
        </div>

        <div className="blue-modal-body">
          <div className="blue-form-field">
            <label>Lot Number</label>
            <input type="text" value={editItemData.lotNumber || ""} readOnly className="blue-input" />
          </div>

          <div className="blue-form-field">
            <label>Brand</label>
            <input type="text" value={editItemData.brand || ""} readOnly className="blue-input" />
          </div>

          <div className="blue-form-field">
            <label>Description</label>
            <input type="text" value={editItemData.description || ""} readOnly className="blue-input" />
          </div>

          <div className="blue-form-field">
            <label>Part No.</label>
            <input
              type="text"
              value={formData.partNo}
              onChange={(e) => updateField("partNo", e.target.value)}
              className="blue-input"
              placeholder="Enter Part No."
            />
          </div>

          <div className="blue-form-field">
            <label>Rate</label>
            <input
              type="text"
              value={formData.rate}
              onChange={(e) => updateField("rate", e.target.value)}
              className="blue-input"
              placeholder="Enter Rate"
            />
          </div>

          <div className="blue-form-field">
            <label>Sets</label>
            <input
              type="number"
              value={formData.sets}
              onChange={(e) => updateField("sets", parseInt(e.target.value) || 0)}
              className="blue-input"
              autoFocus
            />
          </div>

          <div className="blue-form-field">
            <label>Pieces per Set</label>
            <input
              type="number"
              value={formData.setsPerPcs}
              onChange={(e) => updateField("setsPerPcs", parseInt(e.target.value) || 0)}
              className="blue-input"
            />
          </div>

          <div className="blue-form-field">
            <label>Operation</label>
            <select
              value={formData.looseOperation}
              onChange={(e) => updateField("looseOperation", e.target.value)}
              className="blue-select"
            >
              <option value="add">➕ Add to total</option>
              <option value="subtract">➖ Subtract from total</option>
            </select>
          </div>

          <div className="blue-form-field">
            <label>Loose Pieces</label>
            <input
              type="number"
              value={formData.loosePcs}
              onChange={(e) => updateField("loosePcs", parseInt(e.target.value) || 0)}
              className="blue-input"
            />
          </div>

          <div className="blue-form-field">
            <label>Total Quantity</label>
            <input type="number" value={totalQuantity} readOnly className="blue-input" style={{ fontWeight: 'bold', backgroundColor: '#e8f0fe' }} />
          </div>
        </div>

        <div className="blue-modal-footer">
          <button onClick={() => setIsEditModalOpen(false)} className="blue-btn blue-btn-secondary">
            Cancel
          </button>
          <button onClick={saveChanges} className="blue-btn blue-btn-primary">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
});

const ConfirmationModal = React.memo(({
  tempBillData,
  setTempBillData,
  isProcessingDraft,
  savingToSheet,
  generatingPDF,
  setIsConfirmModalOpen,
  preparedBy,
  userRole,
  selectedPartyState,
  openLotDetails,
  openEditModal,
  handleFinalAction
}) => {
  if (!tempBillData) return null;

  const totalQuantity = tempBillData.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalItems = tempBillData.items.length;

  const calculateSetSum = (setsValue) => {
    if (!setsValue) return 0;
    const setsStr = String(setsValue);
    if (setsStr.includes('+')) {
      return setsStr.split('+').reduce((sum, num) => sum + (parseInt(num) || 0), 0);
    } else if (setsStr.length > 2) {
      const partSize = 2;
      const parts = [];
      for (let i = 0; i < setsStr.length; i += partSize) {
        parts.push(parseInt(setsStr.substr(i, partSize)) || 0);
      }
      return parts.reduce((sum, num) => sum + num, 0);
    } else {
      return parseInt(setsStr) || 0;
    }
  };

  const totalSets = tempBillData.items.reduce((total, item) => {
    return total + calculateSetSum(item.sets);
  }, 0);

  return (
    <div className="blue-modal-overlay" onClick={() => {
      if (!isProcessingDraft) setIsConfirmModalOpen(false);
    }}>
      <div className="blue-modal blue-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="blue-modal-header">
          <div className="blue-modal-header-left">
            <span className="blue-modal-icon">✅</span>
            <h3>Confirm Packing List</h3>
            <span className="blue-modal-badge">Review Before Submission</span>
          </div>
          <button
            className="blue-modal-close"
            onClick={() => {
              if (!isProcessingDraft) setIsConfirmModalOpen(false);
            }}
            disabled={isProcessingDraft}
          >
            ✕
          </button>
        </div>
        <div className="blue-modal-body">
          <div className="blue-user-info-bar" style={{
            backgroundColor: 'var(--primary-light)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '12px',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            color: 'var(--text-secondary)'
          }}>
            <span style={{ fontSize: '16px' }}>👤</span>
            <div>
              <strong>Prepared by:</strong> {preparedBy}
              <span style={{ marginLeft: '6px', opacity: 0.8 }}>({userRole})</span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <strong>Time:</strong> {new Date().toLocaleString()}
            </div>
          </div>

          {isProcessingDraft && (
            <div style={{
              backgroundColor: 'var(--primary-light)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              textAlign: 'center',
              border: '1px solid var(--primary-color)',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ marginRight: '8px' }}>💾</span>
              <strong>Saving draft...</strong> Please wait while we generate PDF and save to sheets
            </div>
          )}

          <div className="blue-confirm-summary">
            <div className="blue-summary-card">
              <div className="blue-summary-label">Party Name</div>
              <div className="blue-summary-value">{selectedPartyState?.name || tempBillData.partyName}</div>
            </div>
            <div className="blue-summary-card">
              <div className="blue-summary-label">Bill Date</div>
              <div className="blue-summary-value">{tempBillData.billDate}</div>
            </div>
            <div className="blue-summary-card">
              <div className="blue-summary-label">Total Items</div>
              <div className="blue-summary-value">{totalItems}</div>
            </div>
            <div className="blue-summary-card">
              <div className="blue-summary-label">Total Quantity</div>
              <div className="blue-summary-value">{totalQuantity}</div>
            </div>
            <div className="blue-summary-card">
              <div className="blue-summary-label">Total Sets</div>
              <div className="blue-summary-value">{totalSets}</div>
            </div>
          </div>

          <div className="blue-confirm-table-wrapper">
            <table className="blue-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lot No</th>
                  <th>Part No</th>
                  <th>Brand</th>
                  <th>Description</th>
                  <th>Sets</th>
                  <th>Pc/Set</th>
                  <th>Op</th>
                  <th>Loose</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tempBillData.items.map((item, idx) => {
                  const setSum = calculateSetSum(item.sets);
                  const isMultipleParts = item.sets &&
                    (String(item.sets).includes('+') || String(item.sets).length > 2);

                  return (
                    <tr key={item.id}>
                      <td className="blue-sno">{idx + 1}</td>
                      <td className="blue-lot-cell">
                        {item.lotNumber || '-'}
                        {item.lotNumber && (
                          <button
                            onClick={() => {
                              setIsConfirmModalOpen(false);
                              openLotDetails(item.lotNumber);
                            }}
                            className="blue-lot-details-btn"
                            title="View lot dispatch history"
                          >
                            📊
                          </button>
                        )}
                      </td>
                      <td className="blue-partno-cell"><strong>{item.partNo || extractPartNo(item) || '-'}</strong></td>
                      <td className="blue-brand-cell">{item.brand || '-'}</td>
                      <td className="blue-item-name">
                        {item.description}
                      </td>
                      <td className="blue-qty-cell">
                        {item.sets ? (
                          isMultipleParts ? (
                            <span style={{ fontWeight: '500' }}>
                              {item.sets} = {setSum}
                            </span>
                          ) : (
                            <span>{setSum}</span>
                          )
                        ) : '0'}
                      </td>
                      <td className="blue-qty-cell">{item.setsPerPcs || 0}</td>
                      <td className="blue-qty-cell">{item.looseOperation === 'subtract' ? '➖' : '➕'}</td>
                      <td className="blue-qty-cell">{item.loosePcs || 0}</td>
                      <td className="blue-qty-cell blue-total-qty">{item.quantity || 0}</td>
                      <td className="blue-actions-cell">
                        <div className="blue-actions-wrapper">
                          <button
                            onClick={() => {
                              setIsConfirmModalOpen(false);
                              openEditModal(idx);
                            }}
                            className="blue-edit-btn"
                            title="Edit Item"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="blue-confirm-notes">
            <label>Notes (Optional)</label>
            <textarea
              value={tempBillData.notes || ""}
              onChange={(e) => setTempBillData({ ...tempBillData, notes: e.target.value })}
              placeholder="Add any additional notes..."
              className="blue-textarea"
              rows="2"
              disabled={isProcessingDraft}
            />
          </div>
        </div>
        <div className="blue-modal-footer">
          <button
            onClick={() => setIsConfirmModalOpen(false)}
            className="blue-btn blue-btn-secondary"
            disabled={isProcessingDraft}
          >
            Cancel
          </button>
          <button
            onClick={() => handleFinalAction('draft')}
            className="blue-btn blue-btn-secondary blue-btn-large"
            disabled={isProcessingDraft || savingToSheet || generatingPDF}
          >
            {isProcessingDraft || savingToSheet ? "💾 Saving Draft..." : "💾 Save as Draft"}
          </button>
          <button
            onClick={() => handleFinalAction('final')}
            className="blue-btn blue-btn-primary blue-btn-large"
            disabled={isProcessingDraft || savingToSheet || generatingPDF}
          >
            {generatingPDF || savingToSheet ? "⏳ Submitting..." : "✅ Final Submission"}
          </button>
        </div>
      </div>
    </div>
  );
});

const LotDetailsModal = React.memo(({
  selectedLotForDetails,
  setIsLotDetailsModalOpen,
  lotDetailsData,
  loadingLotDetails,
  generateLotSummaryPDF
}) => {
  if (!selectedLotForDetails) return null;

  const totalDispatched = lotDetailsData.reduce((sum, dispatch) => sum + dispatch.quantity, 0);
  const totalBills = new Set(lotDetailsData.map(d => d.packingNumber)).size;

  return (
    <div className="blue-modal-overlay" onClick={() => setIsLotDetailsModalOpen(false)}>
      <div className="blue-modal blue-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="blue-modal-header">
          <div className="blue-modal-header-left">
            <span className="blue-modal-icon">📊</span>
            <h3>Lot Details: {selectedLotForDetails}</h3>
            <span className="blue-modal-badge">Dispatch History</span>
          </div>
          <div className="blue-modal-header-actions">
            <button
              onClick={() => generateLotSummaryPDF(selectedLotForDetails, lotDetailsData)}
              className="blue-btn blue-btn-pdf"
              disabled={loadingLotDetails || lotDetailsData.length === 0}
              title="Download PDF Report"
            >
              📄 Download PDF
            </button>
            <button className="blue-modal-close" onClick={() => setIsLotDetailsModalOpen(false)}>✕</button>
          </div>
        </div>
        <div className="blue-modal-body">
          {loadingLotDetails ? (
            <div className="blue-loading-state">
              <div className="blue-spinner-small"></div>
              <p>Loading dispatch history...</p>
            </div>
          ) : lotDetailsData.length === 0 ? (
            <div className="blue-empty-state">
              <div className="blue-empty-icon">📭</div>
              <p>No dispatch records found for this lot</p>
              <span className="blue-empty-hint">This lot has not been dispatched yet</span>
            </div>
          ) : (
            <>
              <div className="blue-lot-details-summary">
                <div className="blue-summary-card">
                  <div className="blue-summary-label">Total Dispatched</div>
                  <div className="blue-summary-value">{totalDispatched.toLocaleString()}</div>
                </div>
                <div className="blue-summary-card">
                  <div className="blue-summary-label">Total Bills</div>
                  <div className="blue-summary-value">{totalBills}</div>
                </div>
                <div className="blue-summary-card">
                  <div className="blue-summary-label">Total Transactions</div>
                  <div className="blue-summary-value">{lotDetailsData.length}</div>
                </div>
              </div>

              <div className="blue-dispatch-table-wrapper">
                <table className="blue-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Lot Number</th>
                      <th>Packing Number</th>
                      <th>Party Name</th>
                      <th>Item</th>
                      <th>Brand</th>
                      <th>Sets</th>
                      <th>Pc/Set</th>
                      <th>Loose Pcs</th>
                      <th>Quantity</th>
                      <th>Dispatch Date</th>
                      <th>Prepared By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotDetailsData.map((dispatch, idx) => (
                      <tr key={idx}>
                        <td className="blue-sno">{idx + 1}</td>
                        <td className="blue-lot-cell">{selectedLotForDetails}</td>
                        <td className="blue-dispatch-number">{dispatch.packingNumber}</td>
                        <td className="blue-party-name-cell">{dispatch.partyName}</td>
                        <td className="blue-item-cell">{dispatch.description}</td>
                        <td className="blue-brand-cell">{dispatch.brand || '-'}</td>
                        <td className="blue-qty-cell">{dispatch.sets}</td>
                        <td className="blue-qty-cell">{dispatch.setsPerPcs || 0}</td>
                        <td className="blue-qty-cell">{dispatch.loosePcs}</td>
                        <td className="blue-qty-cell blue-total-qty">{dispatch.quantity.toLocaleString()}</td>
                        <td className="blue-date-cell">{dispatch.dispatchDate}</td>
                        <td className="blue-prepared-by-cell">{dispatch.preparedBy || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="9" className="blue-footer-label">TOTAL:</td>
                      <td className="blue-footer-value">{totalDispatched.toLocaleString()}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="blue-modal-footer">
          <button onClick={() => setIsLotDetailsModalOpen(false)} className="blue-btn blue-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
});

export default PartyBill;
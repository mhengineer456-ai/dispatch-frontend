// DraftPackingList.js - Full Updated Component with Back Button

import React, { useState, useEffect, useRef } from "react";
import "./DraftPackingList.css";
import jsPDF from 'jspdf';

// Google Apps Script URLs
const APPS_SCRIPT_URL = process.env.REACT_APP_DRAFT_PACKING_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbyTjq-1ZRF9z5tLgRmsG2KE3yADq1CEHnPlQ6Rf6aYfFWvRbkvbkCnkAE-_WhTfIs2Z/exec";
const BILL_APPS_SCRIPT_URL = process.env.REACT_APP_BILL_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwSOsKfAlKYq-wYGFa4KWnGwryK1T0ViJYigil8pCbZz_xkK3gv0tqtCgB-k54rRVfa/exec";

// Google Sheets configuration
const GOOGLE_SHEETS_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID || "1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk";
const DRAFTS_SHEET_NAME = "DraftBills";
const BILLS_SHEET_NAME = "Bills";

// Main product database sheet
const PRODUCT_SHEET_ID = process.env.REACT_APP_PRODUCT_SHEET_ID || "1dOCjNFwaAel5qun0_ZJVIGmREqjI76CJBBFIjM3NHv8";
const PRODUCT_SHEET_NAME = "LotBarcodeData";
const OLD_LOT_SHEET_NAME = "OLD LOTS";

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
  if (obj['PartNo'] && String(obj['PartNo']).trim()) return String(obj['PartNo']).trim();
  if (obj['PARTNO'] && String(obj['PARTNO']).trim()) return String(obj['PARTNO']).trim();

  if (obj.rawData) {
    const rawVal = extractPartNo(obj.rawData);
    if (rawVal) return rawVal;
  }

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

function DraftPackingList({ onBack, onConvertToDispatch, parties, currentUser }) {
  const [drafts, setDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [draftForm, setDraftForm] = useState({
    orderNo: "",
    partyName: "",
    partyId: "",
    items: [{
      name: "",
      quantity: "",
      description: "",
      sets: "",
      setsPerPcs: "",
      loosePcs: "",
      brand: "",
      lotNumber: "",
      barcode: ""
    }],
    dispatchDate: "",
    deliveryAddress: "",
    specialInstructions: "",
    priority: "normal",
    notes: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterParty, setFilterParty] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingToSheet, setSavingToSheet] = useState(false);
  const [processingStage, setProcessingStage] = useState(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftToConvert, setDraftToConvert] = useState(null);

  // Product database state
  const [sheetData, setSheetData] = useState([]);
  const [oldLotData, setOldLotData] = useState([]);
  const [loadingProductData, setLoadingProductData] = useState(false);

  // Local edited drafts (not saved to Google Sheets)
  const [localEditedDrafts, setLocalEditedDrafts] = useState({});

  // Lot search suggestions
  const [lotSearchTerm, setLotSearchTerm] = useState("");
  const [lotSuggestions, setLotSuggestions] = useState([]);
  const [showLotSuggestions, setShowLotSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  // Debug messages
  const [scannerDebug, setScannerDebug] = useState([]);

  // Get current user info
  const preparedBy = currentUser?.fullName || currentUser?.username || "System";
  const userRole = currentUser?.role === "admin" ? "Admin" : currentUser?.role === "user" ? "Staff" : "User";
  const userEmail = currentUser?.email || "";

  // Navigation handler
  // Navigation handler - use the onBack prop directly
  const handleGoBack = () => {
    // If we're in form mode, just close the form
    if (isCreating) {
      setIsCreating(false);
      setSelectedDraft(null);
      setIsEditingExisting(false);
      resetForm();
    }
    // Otherwise, use the onBack prop from Home.js
    else if (onBack && typeof onBack === 'function') {
      onBack();
    }
    // Fallback - just in case
    else {
      window.history.back();
    }
  };

  useEffect(() => {
    loadDraftsFromSheet();
    fetchProductDatabase();
  }, []);

  const addDebugMessage = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setScannerDebug(prev => [...prev, { timestamp, message, type }].slice(-20));
    console.log(`[Debug ${timestamp}]:`, message);
  };

  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 999999;
      background: #0f172a;
      color: #ffffff;
      padding: 14px 22px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 700;
      box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      gap: 12px;
      border-left: 5px solid ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#3b82f6'};
    `;
    toast.innerHTML = `<span style="font-size: 18px">${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };

  // ==================== GOOGLE SHEETS FUNCTIONS ====================

  const loadDraftsFromSheet = async () => {
    setLoading(true);
    addDebugMessage("Loading drafts from Google Sheets...");

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${DRAFTS_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 1) {
        const headers = data.values[0];
        const sheetDrafts = data.values.slice(1).map((row, index) => {
          let jsonData = {};
          const jsonColumnIndex = headers.findIndex(h => h === 'Draft Data (JSON)');

          if (jsonColumnIndex !== -1 && row[jsonColumnIndex]) {
            try {
              jsonData = JSON.parse(row[jsonColumnIndex]);
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }

          const draftIdIndex = headers.findIndex(h => h === 'Draft ID');
          const partyNameIndex = headers.findIndex(h => h === 'Party Name');
          const statusIndex = headers.findIndex(h => h === 'Status');
          const createdDateIndex = headers.findIndex(h => h === 'Created Date');
          const lastModifiedIndex = headers.findIndex(h => h === 'Last Modified');
          const totalQuantityIndex = headers.findIndex(h => h === 'Total Quantity');

          // FIX: Calculate total quantity properly as number
          let totalQuantity = 0;

          // First try to get from JSON data
          if (jsonData.totalQuantity !== undefined && jsonData.totalQuantity !== null) {
            totalQuantity = Number(jsonData.totalQuantity) || 0;
          }
          // Then try from the sheet column
          else if (totalQuantityIndex !== -1 && row[totalQuantityIndex]) {
            totalQuantity = Number(row[totalQuantityIndex]) || 0;
          }
          // Finally calculate from items
          else if (jsonData.items && Array.isArray(jsonData.items)) {
            totalQuantity = jsonData.items.reduce((sum, item) => {
              const qty = Number(item.quantity) || 0;
              return sum + qty;
            }, 0);
          }

          return {
            id: row[draftIdIndex] || `DRAFT-${index}`,
            draftNumber: row[draftIdIndex] || `DRAFT-${index}`,
            orderNo: jsonData.orderNo || jsonData.billNumber || row[draftIdIndex] || '',
            partyName: jsonData.partyName || (partyNameIndex !== -1 ? row[partyNameIndex] : ''),
            partyId: jsonData.partyId || '',
            items: jsonData.items || [],
            dispatchDate: jsonData.dispatchDate || jsonData.billDate || '',
            deliveryAddress: jsonData.deliveryAddress || '',
            specialInstructions: jsonData.specialInstructions || '',
            priority: jsonData.priority || 'normal',
            notes: jsonData.notes || '',
            status: statusIndex !== -1 ? row[statusIndex]?.toLowerCase() || 'draft' : 'draft',
            createdDate: jsonData.createdDate || (createdDateIndex !== -1 ? row[createdDateIndex] : new Date().toISOString()),
            lastModified: lastModifiedIndex !== -1 ? row[lastModifiedIndex] : new Date().toISOString(),
            totalItems: totalQuantity, // Now this is a proper number, not concatenated string
            preparedBy: jsonData.preparedBy || '',
            preparedByRole: jsonData.preparedByRole || '',
            preparedByEmail: jsonData.preparedByEmail || ''
          };
        });

        setDrafts(sheetDrafts);
        addDebugMessage(`Loaded ${sheetDrafts.length} drafts from Google Sheets`, 'success');
      } else {
        addDebugMessage("No drafts found in Google Sheets", 'warning');
        setDrafts([]);
      }
    } catch (error) {
      console.error("Error fetching drafts:", error);
      addDebugMessage(`Failed to load drafts: ${error.message}`, 'error');
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  // Save or Update Draft to Google Sheets (MERGE with existing)
  // Replace the existing saveDraftToGoogleSheets function with this:

  const saveDraftToGoogleSheets = async (draftData, isUpdate = false) => {
    setSavingToSheet(true);
    addDebugMessage(`${isUpdate ? 'Updating' : 'Saving'} draft to Express Backend...`);

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `type=draft&data=${encodeURIComponent(JSON.stringify(draftData))}`
      });

      const result = await response.json();
      if (result.success) {
        addDebugMessage(`✅ Draft ${isUpdate ? 'updated' : 'saved'} successfully`, 'success');
        return { success: true, draftId: draftData.billNumber || draftData.packingNumber };
      } else {
        throw new Error(result.error || "Failed to save draft");
      }

    } catch (error) {
      console.error("Error saving draft:", error);
      addDebugMessage(`❌ Failed to save draft: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      setSavingToSheet(false);
    }
  };

  const deleteDraftFromSheet = async (draftId) => {
    try {
      addDebugMessage(`Deleting draft ${draftId} from Google Sheets...`);

      const encodedData = encodeURIComponent(JSON.stringify({ draftId: draftId }));
      const urlEncodedData = `data=${encodedData}&type=deleteDraft`;

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlEncodedData
      });

      const result = await response.json();

      if (result.success) {
        addDebugMessage(`✅ Draft deleted successfully`, 'success');
        return true;
      } else {
        throw new Error(result.error || "Unknown error");
      }

    } catch (error) {
      console.error("Error deleting draft:", error);
      addDebugMessage(`❌ Failed to delete draft: ${error.message}`, 'error');
      return false;
    }
  };

  const getNextBillNumber = async (prefix = 'PL') => {
    try {
      addDebugMessage(`Fetching last ${prefix} number from Google Sheets...`);

      const numbers = [];

      // 1. If prefix is DL, check local React state drafts first
      if (prefix === 'DL' && drafts && drafts.length > 0) {
        drafts.forEach(draft => {
          const dId = String(draft.id || draft.billNumber || draft.draftNumber || '');
          if (dId.startsWith('DL-')) {
            const numPart = dId.replace('DL-', '');
            if (/^\d+$/.test(numPart)) {
              const num = parseInt(numPart, 10);
              if (!isNaN(num)) numbers.push(num);
            }
          }
        });
      }

      // 2. Fetch from Google Sheets tab (DraftBills for DL, Bills for PL) up to 10,000 rows
      const targetSheet = prefix === 'DL' ? 'DraftBills' : (BILLS_SHEET_NAME || 'Bills');
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${targetSheet}!A1:A10000?key=${GOOGLE_SHEETS_API_KEY}`;

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

      let lastNumber = 0;
      if (numbers.length > 0) {
        lastNumber = Math.max(...numbers);
        addDebugMessage(`Found ${numbers.length} ${prefix} numbers. Highest last number: ${lastNumber}`, 'success');
      }

      const nextNumber = lastNumber + 1;
      const formattedNumber = String(nextNumber).padStart(3, '0');
      const billNumber = `${prefix}-${formattedNumber}`;

      addDebugMessage(`Generated new ${prefix} number: ${billNumber}`, 'success');
      return billNumber;

    } catch (error) {
      console.error("Error getting next bill number:", error);
      addDebugMessage(`Error: ${error.message}`, 'error');
      const fallbackNumber = `${prefix}-001`;
      return fallbackNumber;
    }
  };

  const fetchBillsFromSheet = async () => {
    try {
      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${BILLS_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.values && result.values.length > 1) {
        const headers = result.values[0];
        const rows = result.values.slice(1);

        const bills = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        return bills;
      }

      return [];
    } catch (error) {
      console.error("Error fetching bills:", error);
      addDebugMessage(`Failed to fetch bills: ${error.message}`, 'error');
      return [];
    }
  };

  const saveFinalBillToSheet = async (billData) => {
    try {
      addDebugMessage("Saving final bill to Express Backend...");

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=createPackingList&data=${encodeURIComponent(JSON.stringify(billData))}`
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        addDebugMessage(`✅ Final bill ${billData.billNumber} saved`, 'success');
        return true;
      } else {
        throw new Error(result.error || "Backend returned failure");
      }

    } catch (error) {
      console.error("Error saving final bill:", error);
      addDebugMessage(`❌ Failed to save final bill: ${error.message}`, 'error');
      return false;
    }
  };

  // ==================== DRAFT MANAGEMENT ====================

  const getCurrentDraft = (draftId) => {
    if (localEditedDrafts[draftId]) {
      return localEditedDrafts[draftId];
    }
    return drafts.find(d => d.id === draftId);
  };

  const updateLocalDraft = (draftId, updatedData) => {
    setLocalEditedDrafts(prev => ({
      ...prev,
      [draftId]: updatedData
    }));

    setDrafts(prev => prev.map(draft =>
      draft.id === draftId ? updatedData : draft
    ));
  };

  const createLocalDraft = (draftData) => {
    const newDraft = {
      ...draftData,
      id: Date.now().toString(),
      draftNumber: `DRAFT-${Date.now()}`,
      status: "draft",
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    setDrafts(prev => [newDraft, ...prev]);
    return newDraft;
  };

  const deleteLocalDraft = async (draftId, isFromSheet = true) => {
    if (isFromSheet) {
      const deleted = await deleteDraftFromSheet(draftId);
      if (!deleted) {
        showToast("Failed to delete draft from Google Sheets", "error");
        return false;
      }
    }

    setDrafts(prev => prev.filter(draft => draft.id !== draftId));
    setLocalEditedDrafts(prev => {
      const newState = { ...prev };
      delete newState[draftId];
      return newState;
    });

    if (selectedDraft?.id === draftId) {
      setSelectedDraft(null);
    }

    return true;
  };

  // ==================== DRAFT CRUD OPERATIONS ====================

  const handleCreateDraft = async () => {
    if (!draftForm.orderNo || !draftForm.partyName) {
      showToast("Please fill in Order Number and Party Name", "warning");
      return;
    }

    const newDraftNumber = await getNextBillNumber('DL');

    const totalQuantity = draftForm.items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      return sum + quantity;
    }, 0);

    const processedItems = draftForm.items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      sets: Number(item.sets) || 0,
      setsPerPcs: Number(item.setsPerPcs) || 0,
      loosePcs: Number(item.loosePcs) || 0
    }));

    const newDraft = {
      billNumber: newDraftNumber,
      packingNumber: newDraftNumber,
      orderNo: draftForm.orderNo,
      partyName: draftForm.partyName,
      partyId: draftForm.partyId,
      items: processedItems,
      billDate: draftForm.dispatchDate || new Date().toISOString().split('T')[0],
      dispatchDate: draftForm.dispatchDate,
      deliveryAddress: draftForm.deliveryAddress,
      specialInstructions: draftForm.specialInstructions,
      priority: draftForm.priority,
      notes: draftForm.notes,
      totalQuantity: totalQuantity,
      totalItems: draftForm.items.length,
      createdDate: new Date().toISOString(),
      preparedBy: preparedBy,
      preparedByRole: userRole,
      preparedByEmail: userEmail,
      status: 'DRAFT',
      documentType: 'DRAFT',
      isUpdate: false
    };

    // 1. Generate & Download Draft PDF
    setProcessingStage('pdf');
    addDebugMessage(`Generating PDF for draft ${newDraftNumber}...`, 'info');
    await generatePackingListPDF(newDraft);

    // 2. Save to Express Backend & Google Sheets
    setProcessingStage('sheet');
    const result = await saveDraftToGoogleSheets(newDraft, false);

    if (result.success) {
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);

      await loadDraftsFromSheet();
      resetForm();
      setIsCreating(false);
      setIsEditingExisting(false);
      showToast(`Draft ${newDraftNumber} created & PDF downloaded!`, "success");
    } else {
      showToast("Failed to save draft: " + result.error, "error");
    }
  };

  const handleUpdateDraft = async () => {
    if (!selectedDraft) return;

    const totalQuantity = draftForm.items.reduce((sum, item) => {
      const quantity = parseInt(item.quantity) || 0;
      return sum + quantity;
    }, 0);

    const processedItems = draftForm.items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      sets: Number(item.sets) || 0,
      setsPerPcs: Number(item.setsPerPcs) || 0,
      loosePcs: Number(item.loosePcs) || 0,
      partNo: item.partNo || extractPartNo(item),
      rate: item.rate || extractRate(item)
    }));

    const updatedDraft = {
      id: selectedDraft.id,
      billNumber: selectedDraft.id,
      packingNumber: selectedDraft.id,
      orderNo: draftForm.orderNo || selectedDraft.orderNo || '',
      partyName: draftForm.partyName,
      partyId: draftForm.partyId,
      items: processedItems,
      billDate: draftForm.dispatchDate || selectedDraft.dispatchDate || new Date().toISOString().split('T')[0],
      dispatchDate: draftForm.dispatchDate,
      deliveryAddress: draftForm.deliveryAddress,
      specialInstructions: draftForm.specialInstructions,
      priority: draftForm.priority,
      notes: draftForm.notes,
      totalQuantity: totalQuantity,
      totalItems: draftForm.items.length,
      createdDate: selectedDraft.createdDate || new Date().toISOString(),
      lastModified: new Date().toISOString(),
      preparedBy: preparedBy,
      preparedByRole: userRole,
      preparedByEmail: userEmail,
      status: 'DRAFT',
      documentType: 'DRAFT',
      isUpdate: true
    };

    try {
      setSavingToSheet(true);
      setProcessingStage('updating_sheet');
      showToast("Updating draft...", "info");
      addDebugMessage(`Updating draft ${selectedDraft.id}...`, 'info');

      // 1. Save / Update to Backend & Google Sheets FIRST
      const result = await saveDraftToGoogleSheets(updatedDraft, true);

      if (!result.success) {
        throw new Error(result.error || "Failed to update draft");
      }

      addDebugMessage(`Draft ${selectedDraft.id} updated successfully on server`, 'success');

      // 2. Generate & Download Updated Draft PDF AFTER server update succeeds
      setProcessingStage('pdf');
      addDebugMessage(`Generating updated PDF for draft ${selectedDraft.id}...`, 'info');
      await generatePackingListPDF(updatedDraft);

      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2000);

      await loadDraftsFromSheet();
      setSelectedDraft(null);
      resetForm();
      setIsCreating(false);
      setIsEditingExisting(false);
      showToast(`Draft ${selectedDraft.id} updated & PDF downloaded!`, "success");
    } catch (err) {
      console.error("Error updating draft:", err);
      showToast("Failed to update draft: " + err.message, "error");
      addDebugMessage(`❌ Failed to update draft: ${err.message}`, 'error');
    } finally {
      setSavingToSheet(false);
      setProcessingStage(null);
    }
  };

  const handleEditDraft = (draft) => {
    const currentDraft = getCurrentDraft(draft.id);

    const editFormData = {
      orderNo: currentDraft.orderNo || "",
      partyName: currentDraft.partyName || "",
      partyId: currentDraft.partyId || "",
      items: currentDraft.items && currentDraft.items.length > 0 ? currentDraft.items.map(item => ({
        name: item.name || "",
        quantity: item.quantity || "",
        description: item.description || "",
        sets: item.sets || "",
        setsPerPcs: item.setsPerPcs || "",
        loosePcs: item.loosePcs || "",
        brand: item.brand || "",
        lotNumber: item.lotNumber || "",
        barcode: item.barcode || "",
        partNo: item.partNo || extractPartNo(item),
        rate: item.rate || extractRate(item)
      })) : [{
        name: "",
        quantity: "",
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: "",
        partNo: "",
        rate: ""
      }],
      dispatchDate: currentDraft.dispatchDate || "",
      deliveryAddress: currentDraft.deliveryAddress || "",
      specialInstructions: currentDraft.specialInstructions || "",
      priority: currentDraft.priority || "normal",
      notes: currentDraft.notes || ""
    };

    setSelectedDraft(currentDraft);
    setDraftForm(editFormData);
    setIsCreating(true);
    setIsEditingExisting(true);
  };

  const handleDeleteDraft = async (draftId) => {
    if (window.confirm("Are you sure you want to delete this draft?")) {
      const originalDraft = drafts.find(d => d.id === draftId);
      const isFromSheet = originalDraft && !localEditedDrafts[draftId];

      const deleted = await deleteLocalDraft(draftId, isFromSheet);

      if (deleted) {
        showToast("Draft deleted successfully!", "success");
      } else {
        showToast("Failed to delete draft", "error");
      }
    }
  };

  const resetForm = () => {
    setDraftForm({
      orderNo: "",
      partyName: "",
      partyId: "",
      items: [{
        name: "",
        quantity: "",
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: ""
      }],
      dispatchDate: "",
      deliveryAddress: "",
      specialInstructions: "",
      priority: "normal",
      notes: ""
    });
    setLotSearchTerm("");
    setShowLotSuggestions(false);
  };

  // ==================== PRODUCT DATABASE FUNCTIONS ====================

  const fetchProductDatabase = async () => {
    setLoadingProductData(true);
    addDebugMessage("Fetching product database...");

    try {
      const mainData = await fetchMainProductData();
      const oldData = await fetchOldLotData();

      setSheetData(mainData);
      setOldLotData(oldData);

      addDebugMessage(`Loaded ${mainData.length} products + ${oldData.length} old lots`, 'success');
    } catch (error) {
      console.error("Error fetching product database:", error);
      addDebugMessage(`Failed to load product database: ${error.message}`, 'error');
    } finally {
      setLoadingProductData(false);
    }
  };

  const fetchMainProductData = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PRODUCT_SHEET_ID}/values/${PRODUCT_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 1) {
        const headers = data.values[0];
        const products = data.values.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            let value = row[index] || '';
            if (value && (value.startsWith('[') || value.startsWith('{'))) {
              try { value = JSON.parse(value); } catch (e) { }
            }
            obj[header] = value;
          });
          obj.partNo = extractPartNo(obj);
          obj.rate = extractRate(obj);
          return obj;
        }).filter(p => p['Lot Number'] && p['Lot Number'] !== '');

        return products;
      }
      return [];
    } catch (error) {
      console.error("Error fetching main product data:", error);
      return [];
    }
  };

  const fetchOldLotData = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${PRODUCT_SHEET_ID}/values/${OLD_LOT_SHEET_NAME}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 1) {
        const products = parseOldLotData(data.values);
        return products;
      }
      return [];
    } catch (error) {
      console.error("Error fetching old lot data:", error);
      return [];
    }
  };

  const parseOldLotData = (values) => {
    if (!values || values.length < 2) return [];

    const headers = values[0];

    // Find column indices dynamically with fallbacks for OLD LOTS layout (A: Description, B: Sets 4s, C: PartNo, D: LotNo, E: Rate)
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

    const parsedProducts = [];

    values.slice(1).forEach((row) => {
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
      if (!brand) brand = '----';
      if (piecesPerSet === 0) piecesPerSet = 5;

      parsedProducts.push({
        'Lot Number': lotNumber,
        'Barcode ID': `LOT-${lotNumber}`,
        'Brand': brand,
        'Item Name': itemName,
        'Garment Type': itemName,
        'Pieces Per Set': piecesPerSet,
        'Party Name': brand,
        'Source': 'OLD LOT',
        'PART NO.': partNoVal,
        'PartNo': partNoVal,
        'partNo': partNoVal,
        'RATE': rateVal,
        'rate': rateVal
      });
    });

    return parsedProducts;
  };

  const searchProductByLotNumber = (lotNumber) => {
    addDebugMessage(`Searching for lot number: "${lotNumber}"`);

    const allProducts = [...sheetData, ...oldLotData];

    if (allProducts.length === 0) {
      addDebugMessage("Product database empty!", 'error');
      return null;
    }

    const product = allProducts.find(item => {
      const itemLot = item['Lot Number']?.toString();
      return itemLot === lotNumber.toString();
    });

    if (product) {
      addDebugMessage(`Found: ${product['Garment Type'] || product['Item Name']}`, 'success');
    } else {
      addDebugMessage(`No product found for lot number: "${lotNumber}"`, 'error');
    }

    return product;
  };

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

    const matches = allProducts.filter(product => {
      const lotNumber = product['Lot Number']?.toString().toLowerCase() || "";
      return lotNumber.includes(searchLower);
    });

    addDebugMessage(`Search for "${searchTerm}" found ${matches.length} matches`, 'info');

    const suggestions = matches.slice(0, 20).map((product, idx) => {
      const lotNumber = product['Lot Number']?.toString() || "";
      const description = product['Garment Type'] || product['Item Name'] || "";
      const brand = product['Brand'] || product['Party Name'] || "";
      const piecesPerSet = product['Pieces Per Set'] || 0;

      return {
        id: `${lotNumber}_${idx}_${Date.now()}`,
        lotNumber: lotNumber,
        description: description,
        displayDescription: piecesPerSet > 0 ? `${description} ${piecesPerSet}S` : description,
        brand: brand,
        piecesPerSet: piecesPerSet,
        source: product['Source'] || 'Main',
        isOldLot: product['Source'] === 'OLD LOT',
        rawData: product,
        partNo: extractPartNo(product),
        rate: extractRate(product)
      };
    });

    setLotSuggestions(suggestions);
    setShowLotSuggestions(suggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const selectLotFromSuggestion = (suggestion, itemIndex) => {
    addDebugMessage(`Selected: ${suggestion.lotNumber} - ${suggestion.description}`, 'success');

    const updatedItems = [...draftForm.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      lotNumber: suggestion.lotNumber,
      brand: suggestion.brand,
      name: suggestion.description,
      description: suggestion.description,
      setsPerPcs: suggestion.piecesPerSet, // Store as number
      barcode: suggestion.lotNumber,
      partNo: suggestion.partNo || extractPartNo(suggestion),
      rate: suggestion.rate || extractRate(suggestion)
    };

    const totalPieces = calculateTotalPieces(updatedItems[itemIndex]);
    updatedItems[itemIndex].quantity = totalPieces; // Store as number

    setDraftForm({ ...draftForm, items: updatedItems });
    setLotSearchTerm(suggestion.lotNumber);
    setShowLotSuggestions(false);
  };

  const handleLotInputChange = (index, value) => {
    setLotSearchTerm(value);
    setActiveItemIndex(index);

    const updatedItems = [...draftForm.items];
    updatedItems[index].lotNumber = value;

    if (value && value.trim()) {
      const foundProduct = searchProductByLotNumber(value.trim());
      if (foundProduct) {
        const piecesPerSet = parseInt(foundProduct['Pieces Per Set']) || 0;
        const brand = foundProduct['Brand'] || foundProduct['Party Name'] || "";
        const itemName = foundProduct['Garment Type'] || foundProduct['Item Name'] || "";
        const partNo = extractPartNo(foundProduct);
        const rate = extractRate(foundProduct);

        updatedItems[index].name = itemName;
        updatedItems[index].description = itemName;
        updatedItems[index].brand = brand;
        if (piecesPerSet > 0) updatedItems[index].setsPerPcs = piecesPerSet;
        if (partNo) updatedItems[index].partNo = partNo;
        if (rate) updatedItems[index].rate = rate;

        const totalPieces = calculateTotalPieces(updatedItems[index]);
        updatedItems[index].quantity = totalPieces;
      }
    }

    setDraftForm({ ...draftForm, items: updatedItems });
    searchLotsWithSuggestions(value);
  };

  const handleLotInputKeyDown = (e, index) => {
    if (!showLotSuggestions || lotSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleManualLotSearch(index);
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
        selectLotFromSuggestion(lotSuggestions[selectedSuggestionIndex], index);
      } else {
        handleManualLotSearch(index);
      }
    } else if (e.key === 'Escape') {
      setShowLotSuggestions(false);
    }
  };

  const handleManualLotSearch = (index) => {
    const lotNumber = draftForm.items[index].lotNumber;
    if (!lotNumber || !lotNumber.trim()) {
      addDebugMessage("Please enter a lot number", 'warning');
      return;
    }

    const foundProduct = searchProductByLotNumber(lotNumber.trim());

    if (foundProduct) {
      const piecesPerSet = parseInt(foundProduct['Pieces Per Set']) || 0;
      const brand = foundProduct['Brand'] || foundProduct['Party Name'] || "";
      const itemName = foundProduct['Garment Type'] || foundProduct['Item Name'] || "";
      const partNo = extractPartNo(foundProduct);
      const rate = extractRate(foundProduct);

      const updatedItems = [...draftForm.items];
      updatedItems[index] = {
        ...updatedItems[index],
        brand: brand,
        name: itemName,
        description: itemName,
        setsPerPcs: piecesPerSet, // Store as number
        barcode: foundProduct['Barcode ID'] || `LOT-${lotNumber}`,
        partNo: partNo,
        rate: rate
      };

      const totalPieces = calculateTotalPieces(updatedItems[index]);
      updatedItems[index].quantity = totalPieces; // Store as number

      setDraftForm({ ...draftForm, items: updatedItems });
      addDebugMessage(`Auto-filled: ${itemName} (${piecesPerSet} Pc/Set)`, 'success');
    } else {
      addDebugMessage(`Lot number "${lotNumber}" not found in database`, 'error');
    }

    setShowLotSuggestions(false);
  };

  const calculateTotalPieces = (item) => {
    const sets = Number(item.sets) || 0;
    const setsPerPcs = Number(item.setsPerPcs) || 0;
    const loosePcs = Number(item.loosePcs) || 0;
    const total = (sets * setsPerPcs) + loosePcs;
    return total; // Returns number, not string
  };

  const handleAddItem = () => {
    setDraftForm({
      ...draftForm,
      items: [...draftForm.items, {
        name: "",
        quantity: "",
        description: "",
        sets: "",
        setsPerPcs: "",
        loosePcs: "",
        brand: "",
        lotNumber: "",
        barcode: "",
        partNo: "",
        rate: ""
      }]
    });
    setLotSearchTerm("");
    setShowLotSuggestions(false);
  };

  const handleRemoveItem = (index) => {
    const updatedItems = draftForm.items.filter((_, i) => i !== index);
    setDraftForm({ ...draftForm, items: updatedItems });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...draftForm.items];

    // Store the raw value
    updatedItems[index][field] = value;

    if (field === 'sets' || field === 'setsPerPcs' || field === 'loosePcs') {
      const totalPieces = calculateTotalPieces(updatedItems[index]);
      updatedItems[index].quantity = totalPieces; // Store as number
    }

    setDraftForm({ ...draftForm, items: updatedItems });
  };

  const handlePartySelect = (party) => {
    setDraftForm({
      ...draftForm,
      partyName: party.name,
      partyId: party.id,
      deliveryAddress: party.address || "",
      notes: `Contact: ${party.contact}\nEmail: ${party.email}\nGST: ${party.gst}`
    });
  };

  // ==================== CONFIRMATION MODAL ====================

  const ConfirmConversionModal = () => {
    if (!draftToConvert) return null;

    const totalItems = draftToConvert.items.length;
    const totalQuantity = draftToConvert.items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

    return (
      <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
        <div className="modal-content modal-confirm" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-header-left">
              <span className="modal-icon">⚠️</span>
              <h3>Confirm Conversion</h3>
            </div>
            <button className="modal-close" onClick={() => setShowConfirmModal(false)}>✕</button>
          </div>

          <div className="modal-body">
            <div className="warning-message">
              <span>📄</span>
              <p>You are about to convert this draft to a FINAL BILL</p>
            </div>

            <div className="draft-summary">
              <div className="summary-title">Draft Summary:</div>
              <div className="summary-details">
                <div className="summary-row">
                  <span>Draft ID:</span>
                  <strong>{draftToConvert.id}</strong>
                </div>
                <div className="summary-row">
                  <span>Order Number:</span>
                  <strong>{draftToConvert.orderNo}</strong>
                </div>
                <div className="summary-row">
                  <span>Party Name:</span>
                  <strong>{draftToConvert.partyName}</strong>
                </div>
                <div className="summary-row">
                  <span>Total Items:</span>
                  <strong>{totalItems}</strong>
                </div>
                <div className="summary-row">
                  <span>Total Quantity:</span>
                  <strong>{totalQuantity} PCS</strong>
                </div>
                <div className="summary-row">
                  <span>Final Bill Date:</span>
                  <strong style={{ color: '#059669', fontSize: '15px' }}>
                    {new Date().toISOString().split('T')[0]} (Today)
                  </strong>
                </div>
              </div>
            </div>

            <div className="info-box">
              <div className="info-icon">ℹ️</div>
              <div className="info-text">
                <strong>What will happen?</strong>
                <ul>
                  <li>✓ A final bill number will be generated (PL-XXX)</li>
                  <li>✓ PDF will be downloaded automatically</li>
                  <li>✓ Data will be saved permanently to Google Sheets</li>
                  <li>✓ This draft will be removed from drafts list</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button onClick={() => setShowConfirmModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleConfirmConversion} className="btn-primary btn-danger">
              ✅ Confirm & Convert to Final Bill
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleConvertToFinal = (draft) => {
    if (!draft || draft.items.length === 0) {
      showToast("No items in this draft to convert", "warning");
      return;
    }

    const currentDraft = getCurrentDraft(draft.id);
    setDraftToConvert(currentDraft);
    setShowConfirmModal(true);
  };

  const handleConfirmConversion = async () => {
    if (!draftToConvert) return;

    if (savingToSheet) {
      addDebugMessage("Already processing, please wait...", 'warning');
      return;
    }

    setShowConfirmModal(false);

    try {
      setSavingToSheet(true);
      setProcessingStage('converting');
      showToast("Conversion started...", "info");
      addDebugMessage("Converting draft to final bill...", 'info');

      const latestDraft = getCurrentDraft(draftToConvert.id) || draftToConvert;

      // Silently refresh/sync latest draft state if local edits exist
      if (localEditedDrafts[draftToConvert.id]) {
        try {
          await saveDraftToGoogleSheets(latestDraft, true);
        } catch (silentErr) {
          console.warn("Silent draft update notice:", silentErr.message);
        }
      }

      const billNumber = await getNextBillNumber('PL');

      const totalQuantity = latestDraft.items.reduce((sum, item) => {
        return sum + (parseInt(item.quantity) || 0);
      }, 0);

      const todayStr = new Date().toISOString().split('T')[0];

      const finalBillData = {
        billNumber: billNumber,
        packingNumber: billNumber,
        partyName: latestDraft.partyName,
        orderNo: latestDraft.orderNo,
        orderReference: latestDraft.orderNo,
        dispatchDate: todayStr, // ALWAYS set to TODAY'S DATE when converting draft to final bill
        billDate: todayStr,     // ALWAYS set to TODAY'S DATE when converting draft to final bill
        dueDate: "",
        items: latestDraft.items.map((item, idx) => ({
          id: Date.now() + idx,
          barcode: item.barcode || item.lotNumber,
          lotNumber: item.lotNumber,
          brand: item.brand,
          name: item.name || item.description,
          description: item.description || item.name,
          sets: item.sets || 0,
          setsPerPcs: item.setsPerPcs || 0,
          loosePcs: item.loosePcs || 0,
          looseOperation: "add",
          quantity: parseInt(item.quantity) || 0,
          colors: [],
          sizes: [],
          partNo: item.partNo || extractPartNo(item),
          rate: item.rate || extractRate(item)
        })),
        notes: latestDraft.notes,
        deliveryAddress: latestDraft.deliveryAddress,
        specialInstructions: latestDraft.specialInstructions,
        priority: latestDraft.priority,
        packingMaterials: {
          totalBoxes: 0,
          totalBags: 0,
          totalPolybags: 0
        },
        totalQuantity: totalQuantity,
        totalItems: latestDraft.items.length,
        createdDate: new Date().toISOString(),
        preparedBy: preparedBy,
        preparedByRole: userRole,
        preparedByEmail: userEmail,
        status: 'FINAL',
        documentType: 'FINAL',
        draftId: latestDraft.id,
        originalDraftId: latestDraft.id
      };

      addDebugMessage(`Converting draft to final bill: ${billNumber}`, 'info');

      // 1. Save data to Backend & Google Sheets FIRST
      setProcessingStage('converting_sheet');
      const saved = await saveFinalBillToSheet(finalBillData);

      if (!saved) {
        throw new Error("Failed to save final bill to backend/sheet");
      }

      addDebugMessage(`Final bill ${billNumber} saved successfully`, 'success');

      // 2. Generate and download PDF ONLY AFTER backend processing is done
      setProcessingStage('pdf');
      const pdfGenerated = await generatePackingListPDF(finalBillData);

      if (!pdfGenerated) {
        addDebugMessage(`Warning: PDF generation failed, but bill ${billNumber} was saved.`, 'warning');
      } else {
        addDebugMessage(`PDF generated successfully`, 'success');
      }

      if (saved) {
        addDebugMessage(`Final bill ${billNumber} saved successfully`, 'success');

        const originalDraft = drafts.find(d => d.id === draftToConvert.id);
        if (originalDraft) {
          addDebugMessage(`Deleting draft ${draftToConvert.id} from Google Sheets...`, 'info');
          const deleted = await deleteDraftFromSheet(draftToConvert.id);

          if (deleted) {
            addDebugMessage(`Draft deleted successfully`, 'success');
          } else {
            addDebugMessage(`Warning: Draft may not have been deleted`, 'warning');
          }
        }

        setDrafts(prev => prev.filter(d => d.id !== draftToConvert.id));
        setLocalEditedDrafts(prev => {
          const newState = { ...prev };
          delete newState[draftToConvert.id];
          return newState;
        });

        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 2000);

        if (onConvertToDispatch) {
          onConvertToDispatch(finalBillData);
        }

        setSelectedDraft(null);
        setDraftToConvert(null);

        showToast(`Converted to final bill ${billNumber}! Saved to server & PDF downloaded.`, "success");

      } else {
        throw new Error("Failed to save final bill");
      }

    } catch (error) {
      console.error("Error converting draft:", error);
      addDebugMessage(`Conversion error: ${error.message}`, 'error');
      showToast("Error converting draft: " + error.message, "error");
    } finally {
      setSavingToSheet(false);
      setProcessingStage(null);
      setDraftToConvert(null);
    }
  };

  // ==================== PDF GENERATION FUNCTION ====================

  const generatePackingListPDF = async (packingData) => {
    if (!packingData || !packingData.items || packingData.items.length === 0) {
      console.error("Invalid packing data");
      return false;
    }

    try {
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

      const drawCheckbox = (x, y, size = 3.5) => {
        doc.rect(x, y, size, size);
      };

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
          doc.text(`${packingData.dispatchDate || packingData.billDate || new Date().toLocaleDateString()}`, leftValX, metaY + 6);

          doc.setFont("times", "bold");
          doc.text("Order Ref", leftLabelX, metaY + 13);
          doc.text(":", leftLabelX + 22, metaY + 13);
          doc.setFont("times", "normal");
          doc.text(`${packingData.orderNo || packingData.orderReference || 'N/A'}`, leftValX, metaY + 13);

          doc.setFont("times", "bold");
          doc.text("Doc No", leftLabelX, metaY + 20);
          doc.text(":", leftLabelX + 22, metaY + 20);
          doc.setFont("times", "normal");
          doc.text(`${packingData.billNumber || packingData.packingNumber || packingData.draftNumber || 'N/A'}`, leftValX, metaY + 20);

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
              { header: "Brand", width: 20 },
              { header: "Item Description", width: 42 },
              { header: "Sets", width: 14 },
              { header: "Pc/Set", width: 14 },
              { header: "Loose Pc", width: 15 },
              { header: "Total Qty", width: 16 },
              { header: "Check", width: 10 }
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
              setsX = leftMargin + 8 + 16 + 15 + 20 + 42; // 131
              setsW = 14;
              looseX = setsX + 14 + 14; // 159
              looseW = 15;
              qtyX = looseX + 15; // 174
              qtyW = 16;
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

          // 5. NOTES Box (248mm to 257mm)
          const notesY = 248;
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

          // 6. Signatures Box (259mm to 283mm)
          const sigY = 259;
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
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          doc.text(`Page ${overallPageCounter} of ${totalPagesOverall}`, pageWidth / 2, 288, { align: "center" });
          doc.setTextColor(0, 0, 0);

          overallPageCounter++;
        }
      });

      const sanitizedPartyName = (packingData.partyName || 'UNKNOWN')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);

      const fileName = `${sanitizedPartyName}_PackingList_${packingData.billNumber || packingData.packingNumber || packingData.draftNumber || packingData.orderNo}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      return true;

    } catch (error) {
      console.error("PDF Generation Error:", error);
      return false;
    }
  };

  // Filter drafts
  const getDisplayDrafts = () => {
    return drafts.map(draft => {
      if (localEditedDrafts[draft.id]) {
        return localEditedDrafts[draft.id];
      }
      return draft;
    });
  };

  const filteredDrafts = getDisplayDrafts().filter(draft => {
    const matchesSearch = draft.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.partyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || draft.status === filterStatus;
    const matchesParty = filterParty === "all" || draft.partyName === filterParty;

    let matchesDate = true;
    if (filterDateFrom && draft.dispatchDate) {
      const draftDate = new Date(draft.dispatchDate);
      const fromDate = new Date(filterDateFrom);
      if (draftDate < fromDate) matchesDate = false;
    }
    if (filterDateTo && draft.dispatchDate) {
      const draftDate = new Date(draft.dispatchDate);
      const toDate = new Date(filterDateTo);
      if (draftDate > toDate) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesParty && matchesDate;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high": return "#f44336";
      case "medium": return "#ff9800";
      case "low": return "#4caf50";
      default: return "#9e9e9e";
    }
  };

  const uniqueParties = [...new Set(getDisplayDrafts().map(draft => draft.partyName).filter(Boolean))];

  const renderDraftDetails = (draft) => {
    if (!draft) return (
      <div className="no-draft-selected">
        <div className="no-selection-icon">📄</div>
        <h3>No Draft Selected</h3>
        <p>Select a draft from the left panel to view complete details</p>
      </div>
    );

    const currentDraft = getCurrentDraft(draft.id);

    const correctTotal = currentDraft.items?.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0;
      return sum + qty;
    }, 0) || 0;

    return (
      <div className="complete-draft-details">
        <div className="details-header">
          <h2>📄 Draft Bill Information</h2>
          {localEditedDrafts[draft.id] && (
            <div className="edited-badge">⚠️ Locally Edited (Not saved to Sheet)</div>
          )}
          <div className="details-actions">
            <button onClick={() => handleEditDraft(currentDraft)} className="edit-details-button">
              ✏️ Edit Draft
            </button>
            <button onClick={() => handleConvertToFinal(currentDraft)} className="convert-details-button">
              🚚 Convert to Final Bill
            </button>
            <button onClick={() => handleDeleteDraft(currentDraft.id)} className="delete-details-button">
              🗑️ Delete
            </button>
          </div>
        </div>

        <div className="details-body">
          <div className="detail-section bill-header">
            <div className="bill-title">
              <h3>PACKING LIST / BILL DETAILS</h3>
              <p className="bill-number">Draft No: <strong>{currentDraft.draftNumber || currentDraft.orderNo}</strong></p>
            </div>
            <div className="bill-dates">
              <p><strong>Created:</strong> {new Date(currentDraft.createdDate).toLocaleString()}</p>
              <p><strong>Last Modified:</strong> {new Date(currentDraft.lastModified).toLocaleString()}</p>
            </div>
          </div>

          <div className="detail-section party-info-section">
            <div className="section-header-with-icon">
              <span className="section-icon">🏢</span>
              <h4>Party Information</h4>
            </div>
            <div className="party-details-card">
              <div className="party-info-grid">
                <div className="party-info-item">
                  <label>Party Name:</label>
                  <span className="party-name-value">{currentDraft.partyName}</span>
                </div>
                <div className="party-info-item">
                  <label>Order Number:</label>
                  <span>{currentDraft.orderNo || 'N/A'}</span>
                </div>
                <div className="party-info-item full-width">
                  <label>Delivery Address:</label>
                  <div className="address-value">{currentDraft.deliveryAddress || 'N/A'}</div>
                </div>
                {currentDraft.notes && (
                  <div className="party-info-item full-width">
                    <label>Contact Details:</label>
                    <div className="notes-value">{currentDraft.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="section-header-with-icon">
              <span className="section-icon">📦</span>
              <h4>Items Details</h4>
            </div>
            <table className="items-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Lot Number</th>
                  <th>Part No</th>
                  <th>Item Name</th>
                  <th>Description</th>
                  <th>Brand</th>
                  <th>Sets</th>
                  <th>Pcs/Set</th>
                  <th>Loose Pcs</th>
                  <th>Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {currentDraft.items && currentDraft.items.length > 0 ? (
                  currentDraft.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td><strong>{item.lotNumber || '-'}</strong></td>
                      <td><span style={{ fontWeight: 'bold', color: '#1d4ed8' }}>{item.partNo || '-'}</span></td>
                      <td>{item.name || 'N/A'}</td>
                      <td>{item.description || '-'}</td>
                      <td><strong>{item.brand || '-'}</strong></td>
                      <td>{item.sets || 0}</td>
                      <td>{item.setsPerPcs || 0}</td>
                      <td>{item.loosePcs || 0}</td>
                      <td><strong>{item.quantity || 0}</strong></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center' }}>No items found</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="9" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Quantity:</td>
                  <td style={{ fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>{correctTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {currentDraft.priority && (
            <div className="detail-section">
              <div className="priority-badge" style={{ backgroundColor: getPriorityColor(currentDraft.priority) }}>
                Priority: {currentDraft.priority.toUpperCase()}
              </div>
            </div>
          )}

          <div className="detail-section">
            <div className="prepared-by-info">
              <label>Prepared By:</label>
              <span>{currentDraft.preparedBy || 'System'} ({currentDraft.preparedByRole || 'User'})</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDraftSavingOverlay = () => {
    if (!savingToSheet && !processingStage) return null;

    let title = "Syncing Draft Record";
    let subtitle = "Writing bill entries & lot items to server...";
    let stagePercent = 50;
    const isConversion = processingStage?.startsWith('converting') || (processingStage === 'pdf' && draftToConvert);
    const isUpdatingDraft = processingStage?.startsWith('updating') || (isEditingExisting && (processingStage === 'sheet' || savingToSheet));

    if (processingStage === 'converting' || processingStage === 'converting_sheet') {
      title = "Converting Draft to Final Bill";
      subtitle = "Saving final bill & updating server records...";
      stagePercent = 50;
    } else if (processingStage === 'updating_sheet' || isUpdatingDraft) {
      title = "Updating Draft Record";
      subtitle = "Saving updated items & lot quantities to cloud server...";
      stagePercent = 60;
    } else if (processingStage === 'pdf') {
      title = isConversion ? "Generating Final Bill PDF" : (isUpdatingDraft ? "Generating Updated Draft PDF" : "Generating Bill Document");
      subtitle = isConversion ? "Formatting layout & downloading invoice PDF..." : "Formatting layout & creating invoice PDF...";
      stagePercent = 85;
    } else if (processingStage === 'sheet' || savingToSheet) {
      title = isEditingExisting ? "Updating Draft Record" : "Saving New Draft Record";
      subtitle = "Securing items & lot quantities to cloud server...";
      stagePercent = 85;
    } else if (showSuccessAnimation || processingStage === 'complete') {
      title = isConversion ? "Final Bill Created Successfully!" : (isUpdatingDraft ? "Draft Updated Successfully!" : "Draft Saved Successfully!");
      subtitle = isConversion ? "Final bill saved & draft removed from server." : "All items & draft data synced with server.";
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
            background: showSuccessAnimation
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #2563eb, #3b82f6, #60a5fa)'
          }}></div>

          {/* Dynamic Icon / Loading Indicator */}
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 20px auto',
            borderRadius: '50%',
            backgroundColor: showSuccessAnimation ? '#ecfdf5' : '#eff6ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: showSuccessAnimation
              ? '0 0 0 8px rgba(16, 185, 129, 0.1)'
              : '0 0 0 8px rgba(59, 130, 246, 0.1)'
          }}>
            {showSuccessAnimation ? (
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
            <span style={{ color: (processingStage === 'updating_sheet' || processingStage === 'converting' || processingStage === 'converting_sheet' || processingStage === 'pdf' || showSuccessAnimation) ? (processingStage === 'pdf' || showSuccessAnimation ? '#10b981' : '#2563eb') : '#94a3b8' }}>
              {(processingStage === 'pdf' || showSuccessAnimation) ? (isUpdatingDraft ? '✓ Draft Updated' : '✓ Server Saved') : '1. Server Update'}
            </span>
            <span style={{ color: processingStage === 'pdf' ? '#2563eb' : showSuccessAnimation ? '#10b981' : '#94a3b8' }}>
              {showSuccessAnimation ? '✓ PDF Downloaded' : '2. PDF Download'}
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
              background: showSuccessAnimation
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
            <span>Secured Direct Backend Sync</span>
          </div>
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div className="draft-form-fullscreen">
      <div className="draft-form-container-card">
        <div className="form-header-fullscreen">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="modal-header-icon">{selectedDraft ? '✏️' : '✨'}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {selectedDraft ? "Edit Draft Packing List" : "Create New Draft Packing List"}
              </h3>
              <span className="modal-header-subtitle">
                {selectedDraft ? `Draft Number: ${selectedDraft.id}` : "Fill out details to save a new draft entry"}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsCreating(false);
              setSelectedDraft(null);
              setIsEditingExisting(false);
              resetForm();
            }}
            className="cancel-fullscreen-button"
          >
            ✕ Close
          </button>
        </div>

        <div className="form-scrollable-content">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-section">
              <h4>📋 Basic Information</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Order Number *</label>
                  <input
                    type="text"
                    value={draftForm.orderNo}
                    onChange={(e) => setDraftForm({ ...draftForm, orderNo: e.target.value })}
                    placeholder="Enter order number"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Party Name *</label>
                  {selectedDraft ? (
                    <div className="party-readonly">
                      <input
                        type="text"
                        value={draftForm.partyName}
                        readOnly
                        disabled
                        className="readonly-field"
                        style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed', fontWeight: 700 }}
                      />
                      <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                        Party cannot be changed in edit mode
                      </small>
                    </div>
                  ) : (
                    <select
                      value={draftForm.partyName}
                      onChange={(e) => {
                        const selectedParty = parties.find(p => p.name === e.target.value);
                        if (selectedParty) handlePartySelect(selectedParty);
                      }}
                    >
                      <option value="">Select a party</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.name}>{party.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={draftForm.priority}
                    onChange={(e) => setDraftForm({ ...draftForm, priority: e.target.value })}
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>📦 Items (with Lot Numbers, Sets & Loose Pieces)</h4>
              {loadingProductData && (
                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 700, borderRadius: '8px', marginBottom: '15px' }}>
                  ⏳ Loading product database...
                </div>
              )}

              {draftForm.items.map((item, index) => (
                <div key={index} className="item-row-enhanced" style={{ position: 'relative' }}>
                  <div className="form-group lot-number-group" style={{ position: 'relative' }}>
                    <label>Lot Number *</label>
                    <input
                      type="text"
                      value={item.lotNumber || ''}
                      onChange={(e) => handleLotInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleLotInputKeyDown(e, index)}
                      onFocus={() => {
                        setActiveItemIndex(index);
                        if (item.lotNumber) {
                          searchLotsWithSuggestions(item.lotNumber);
                        }
                      }}
                      placeholder="Enter lot number"
                      className={`lot-input-${index}`}
                      autoComplete="off"
                    />
                    {showLotSuggestions && activeItemIndex === index && lotSuggestions.length > 0 && (
                      <div className="lot-suggestions-dropdown">
                        {lotSuggestions.map((suggestion, idx) => (
                          <div
                            key={suggestion.id}
                            className={`suggestion-item ${selectedSuggestionIndex === idx ? 'selected' : ''}`}
                            onClick={() => selectLotFromSuggestion(suggestion, index)}
                            onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                          >
                            <div style={{ fontWeight: 'bold' }}>📦 LOT: {suggestion.lotNumber}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {suggestion.displayDescription}
                              {suggestion.brand && <span style={{ marginLeft: '8px' }}>🏷️ {suggestion.brand}</span>}
                              {suggestion.isOldLot && <span style={{ marginLeft: '8px', color: '#ff9800' }}>OLD STOCK</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Item Name *</label>
                    <input
                      type="text"
                      value={item.name || ''}
                      onChange={(e) => handleItemChange(index, "name", e.target.value)}
                      placeholder="Auto-filled from lot"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      value={item.description || ''}
                      onChange={(e) => handleItemChange(index, "description", e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="form-group-small">
                    <label>Part No</label>
                    <input
                      type="text"
                      value={item.partNo || ''}
                      onChange={(e) => handleItemChange(index, "partNo", e.target.value)}
                      placeholder="Auto-filled"
                      style={{ fontWeight: 'bold', color: '#1d4ed8' }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Brand</label>
                    <input
                      type="text"
                      value={item.brand || ''}
                      onChange={(e) => handleItemChange(index, "brand", e.target.value)}
                      placeholder="Auto-filled"
                    />
                  </div>

                  <div className="form-group-small">
                    <label>Sets</label>
                    <input
                      type="number"
                      value={item.sets || ''}
                      onChange={(e) => handleItemChange(index, "sets", e.target.value)}
                      placeholder="Sets"
                      min="0"
                      className={`sets-input-${index}`}
                    />
                  </div>

                  <div className="form-group-small">
                    <label>Pcs/Set</label>
                    <input
                      type="number"
                      value={item.setsPerPcs || ''}
                      onChange={(e) => handleItemChange(index, "setsPerPcs", e.target.value)}
                      placeholder="Auto"
                      min="0"
                      readOnly={item.setsPerPcs && !item.setsPerPcs.toString().includes('manual')}
                    />
                  </div>

                  <div className="form-group-small">
                    <label>Loose Pcs</label>
                    <input
                      type="number"
                      value={item.loosePcs || ''}
                      onChange={(e) => handleItemChange(index, "loosePcs", e.target.value)}
                      placeholder="Loose"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Total Qty</label>
                    <input
                      type="number"
                      value={item.quantity || calculateTotalPieces(item)}
                      readOnly
                      className="auto-calc-field"
                    />
                  </div>

                  {draftForm.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="remove-item-button"
                      title="Remove item"
                    >
                      ✖
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddItem} className="add-item-button">
                + Add Another Item
              </button>
            </div>

            <div className="form-section">
              <h4>🚚 Delivery Details</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Dispatch Date</label>
                  <input
                    type="date"
                    value={draftForm.dispatchDate}
                    onChange={(e) => setDraftForm({ ...draftForm, dispatchDate: e.target.value })}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Delivery Address</label>
                  <textarea
                    value={draftForm.deliveryAddress}
                    onChange={(e) => setDraftForm({ ...draftForm, deliveryAddress: e.target.value })}
                    placeholder="Enter complete delivery address"
                    rows="2"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>📝 Additional Information</h4>
              <div className="form-group full-width" style={{ marginBottom: '12px' }}>
                <label>Special Instructions</label>
                <textarea
                  value={draftForm.specialInstructions}
                  onChange={(e) => setDraftForm({ ...draftForm, specialInstructions: e.target.value })}
                  placeholder="Any special handling instructions"
                  rows="2"
                />
              </div>
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  value={draftForm.notes}
                  onChange={(e) => setDraftForm({ ...draftForm, notes: e.target.value })}
                  placeholder="Additional notes or remarks"
                  rows="2"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="form-footer-actions">
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setSelectedDraft(null);
              setIsEditingExisting(false);
              resetForm();
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-color)',
              background: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={selectedDraft ? handleUpdateDraft : handleCreateDraft}
            className="save-draft-button"
            disabled={savingToSheet}
          >
            💾 {selectedDraft ? "Update Draft (Save to Server)" : "Save Draft (Save to Server)"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="draft-packing-container">

      {showConfirmModal && <ConfirmConversionModal />}

      <div className="user-info-bar">
        <span className="user-icon">👤</span>
        <div>
          <strong>Logged in as:</strong> {preparedBy}
          <span className="user-role">({userRole})</span>
        </div>
        {userEmail && (
          <span className="user-email">
            📧 {userEmail}
          </span>
        )}
      </div>

      <div className="draft-header">
        <button onClick={handleGoBack} className="back-button">
          ← Back
        </button>
        <h2 className="draft-title">📝 Draft Packing Lists</h2>
        {!isCreating && (
          <button onClick={() => setIsCreating(true)} className="create-draft-button">
            + Create New Draft
          </button>
        )}
      </div>

      {loading && (
        <div className="loading-spinner">
          Loading drafts from Google Sheets...
        </div>
      )}

      {!isCreating && !loading && (
        <div className="two-column-layout">
          <div className="left-column">
            <div className="filters-section">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="🔍 Search by Order No or Party Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="filter-row">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft Only</option>
                </select>
                <select
                  value={filterParty}
                  onChange={(e) => setFilterParty(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Parties</option>
                  {uniqueParties.map(party => (
                    <option key={party} value={party}>{party}</option>
                  ))}
                </select>
              </div>
              <div className="filter-row date-filters">
                <input
                  type="date"
                  placeholder="From Date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="date-input"
                />
                <span>to</span>
                <input
                  type="date"
                  placeholder="To Date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="date-input"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="clear-dates-button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="drafts-list">
              {filteredDrafts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No Drafts Found</h3>
                  <p>Create your first draft packing list to get started</p>
                  <button onClick={() => setIsCreating(true)} className="empty-create-button">
                    Create Draft
                  </button>
                </div>
              ) : (
                filteredDrafts.map(draft => (
                  <div
                    key={draft.id}
                    className={`draft-card ${selectedDraft?.id === draft.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDraft(draft)}
                  >
                    <div className="draft-card-header">
                      <div className="draft-info">
                        <h3 className="draft-order-no">{draft.orderNo}</h3>
                        <span className="draft-party">{draft.partyName}</span>
                      </div>
                      <div className="draft-badges">
                        <span className="draft-badge" style={{ backgroundColor: getPriorityColor(draft.priority) }}>
                          {draft.priority?.toUpperCase() || 'NORMAL'}
                        </span>
                        {localEditedDrafts[draft.id] && (
                          <span className="edited-badge-small">📝 Edited</span>
                        )}
                      </div>
                    </div>

                    <div className="draft-card-body">
                      <div className="draft-items-summary">
                        <strong>Items:</strong> {draft.items?.length || 0} item(s)
                        {draft.items?.some(item => item.lotNumber) && (
                          <span className="lot-badge">Has Lot Numbers</span>
                        )}
                        <span className="total-quantity">Total Qty: {draft.totalItems || 0}</span>
                      </div>
                      {draft.dispatchDate && (
                        <div className="draft-dispatch-date">
                          📅 {new Date(draft.dispatchDate).toLocaleDateString()}
                        </div>
                      )}
                      <div className="draft-prepared-by">
                        👤 {draft.preparedBy || 'System'} ({draft.preparedByRole || 'User'})
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="right-column">
            {renderDraftDetails(selectedDraft)}
          </div>
        </div>
      )}

      {isCreating && renderForm()}

      <style jsx>{`
        .lot-suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          max-height: 200px;
          overflow-y: auto;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .suggestion-item {
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
        }
        .suggestion-item:hover {
          background-color: #e3f2fd;
        }
        .suggestion-item.selected {
          background-color: #e3f2fd;
        }
        .lot-number-group {
          position: relative;
        }
        .readonly-field {
          background-color: #f5f5f5;
          color: #666;
          cursor: not-allowed;
          border: 1px solid #ddd;
        }
        .party-readonly {
          width: 100%;
        }
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .processing-card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          text-align: center;
          min-width: 250px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .processing-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        .processing-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: #2196f3;
          transition: width 0.3s ease;
        }
        .success {
          color: #4caf50;
        }
        .draft-prepared-by {
          font-size: 11px;
          color: #000000;
          margin-top: 5px;
          padding-top: 5px;
          border-top: 1px solid #eee;
        }
        .prepared-by-info {
          padding: 10px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 12px;
        }
        .prepared-by-info label {
          font-weight: bold;
          margin-right: 10px;
        }
        .user-info-bar {
          background-color: #f0f4ff;
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          border: 1px solid #cbd5e1;
        }
        .user-icon {
          font-size: 16px;
        }
        .user-role {
          margin-left: 8px;
          color: #666;
        }
        .user-email {
          margin-left: auto;
          color: #666;
        }
        .edited-badge {
          background-color: #ff9800;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 15px;
        }
        .edited-badge-small {
          background-color: #ff9800;
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 9px;
          margin-left: 8px;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .modal-confirm {
          max-width: 550px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
          border-radius: 12px 12px 0 0;
        }
        .modal-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modal-icon {
          font-size: 24px;
        }
        .modal-header-left h3 {
          margin: 0;
          font-size: 18px;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
        }
        .modal-close:hover {
          color: #333;
        }
        .modal-body {
          padding: 20px;
        }
        .warning-message {
          background: #fff3e0;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          gap: 10px;
          font-size: 13px;
          border-left: 4px solid #ff9800;
        }
        .draft-summary {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
          border: 1px solid #dee2e6;
        }
        .summary-title {
          font-weight: bold;
          margin-bottom: 12px;
          font-size: 14px;
          color: #000000;
        }
        .summary-details {
          display: grid;
          gap: 8px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          padding: 4px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .summary-row:last-child {
          border-bottom: none;
        }
        .info-box {
          background: #e3f2fd;
          border-radius: 8px;
          padding: 12px;
          display: flex;
          gap: 12px;
          margin-top: 15px;
        }
        .info-icon {
          font-size: 20px;
        }
        .info-text {
          flex: 1;
          font-size: 13px;
        }
        .info-text ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }
        .info-text li {
          margin: 4px 0;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .btn-secondary {
          padding: 8px 16px;
          background: #f0f0f0;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-primary {
          padding: 8px 20px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn-danger {
          background: #ff9800;
        }
        .btn-danger:hover {
          background: #f57c00;
        }
        .back-button {
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .back-button:hover {
          background-color: #5a6268;
          transform: translateY(-1px);
        }
        .draft-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .draft-title {
          margin: 0;
          font-size: 24px;
          color: #333;
        }
        .create-draft-button {
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        .create-draft-button:hover {
          background-color: #45a049;
        }
      `}</style>
    </div>
  );
}

export default DraftPackingList;
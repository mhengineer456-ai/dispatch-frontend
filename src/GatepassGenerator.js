// GatepassGenerator.js - Fixed version with proper null checks
import React, { useState, useEffect } from 'react';
import './GatepassGenerator.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// HARDCODED GOOGLE SHEETS CREDENTIALS
const GOOGLE_SHEETS_CONFIG = {
  apiKey: process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: process.env.REACT_APP_SPREADSHEET_ID || '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills',
  driverSheetName: 'DRIVER INFO'
};

// Apps Script Web App URL for sending emails
const APPS_SCRIPT_URL = process.env.REACT_APP_GATEPASS_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxL5iwsTonjFTHTsy1VO0VO-KWTOM9n6eDrfztclMIjb8mPZc2TBsJD1AHcueZOv0LN/exec';

const GatepassGenerator = ({ parties = [], gatepasses = [], onSubmit, onBack }) => {
  const [gatepassData, setGatepassData] = useState({
    vehicleNumber: '',
    driverName: '',
    driverContact: '',
    totalPetti: 0,
    totalBora: 0,
    totalPolybags: 0,
    purpose: 'delivery',
    remarks: '',
    selectedBills: [],
    consolidatedRemarks: ''
  });

  // New state for bill selection modal
  const [showBillDetailsModal, setShowBillDetailsModal] = useState(false);
  const [currentSelectedBill, setCurrentSelectedBill] = useState(null);
  const [billDetails, setBillDetails] = useState({
    totalPetti: 0,
    totalBora: 0,
    totalPolybags: 0,
    isByHand: false,
    byHandQuantity: 0,
    byHandPersonName: '',
    byPorter: false
  });

  const [bills, setBills] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillDetails, setSelectedBillDetails] = useState([]);
  const [generatedGatepass, setGeneratedGatepass] = useState(null);
  const [activeTab, setActiveTab] = useState('bills');
  const [sendingEmail, setSendingEmail] = useState(false);

  // NEW FILTER STATES
  const [filterParty, setFilterParty] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [uniquePartiesList, setUniquePartiesList] = useState([]);

  // Function to check if any bill has byHandQuantity or byPorter selected
  const hasAnyByHandSelection = () => {
    if (!gatepassData.selectedBills || !Array.isArray(gatepassData.selectedBills)) return false;
    return gatepassData.selectedBills.some(bill =>
      bill.additionalDetails?.isByHand === true
    );
  };

  // Function to check if all bills are by-hand (no vehicle needed)
  const isAllByHand = () => {
    if (!gatepassData.selectedBills || !Array.isArray(gatepassData.selectedBills) || gatepassData.selectedBills.length === 0) return false;
    return gatepassData.selectedBills.every(bill =>
      bill.additionalDetails?.isByHand === true
    );
  };

  // Function to check if vehicle details are required
  const areVehicleDetailsRequired = () => {
    if (isAllByHand()) return false;
    return true;
  };

  // Function to extract first name and second name initials from party name
  const getPartyInitials = (partyName) => {
    if (!partyName) return '-';

    let cleanedName = partyName.replace(/\([^)]*\)/g, '').trim();
    const words = cleanedName.split(' ').filter(word => word.length > 0);

    if (words.length === 0) return '-';
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    const firstInitial = words[0].charAt(0).toUpperCase();
    const secondInitial = words[1].charAt(0).toUpperCase();

    return `${firstInitial}${secondInitial}`;
  };

  // Function to check if a bill is selected
  const isBillSelected = (billNumber) => {
    if (!gatepassData.selectedBills || !Array.isArray(gatepassData.selectedBills)) return false;
    return gatepassData.selectedBills.some(selected => selected && selected['Bill Number'] === billNumber);
  };

  const fetchBillsFromSheet = async () => {
    setLoadingBills(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${sheetName}!A:T`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);

        const parsedBills = rows.map(row => {
          const billData = {};
          headers.forEach((header, index) => {
            billData[header] = row[index] || '';
          });

          billData['Party Initials'] = getPartyInitials(billData['Party Name']);

          if (billData['Bill Data (JSON)']) {
            try {
              const parsedJson = JSON.parse(billData['Bill Data (JSON)']);
              billData.parsedBillData = parsedJson;
            } catch (e) {
              console.error('Error parsing bill JSON:', e);
            }
          }

          return billData;
        });

        const availableBills = parsedBills.filter(bill => {
          const gatepassStatus =
            bill['GATEPASS CREATED'] ||
            bill['Gatepass Created'] ||
            bill['gatepass created'] ||
            bill['GATEPASS_CREATED'] ||
            bill['Gatepass_Created'] ||
            '';

          const normalizedStatus = gatepassStatus.toString().trim().toUpperCase();
          return normalizedStatus !== 'YES';
        });

        const sortedBills = sortBills(availableBills, sortOrder);
        setBills(sortedBills || []);

        const uniqueParties = [...new Set((availableBills || []).map(bill => bill['Party Name']).filter(name => name))];
        setUniquePartiesList(uniqueParties);

        console.log('Available bills fetched:', availableBills ? availableBills.length : 0);

        if (availableBills && availableBills.length === 0) {
          alert('All bills have already been assigned to gatepasses. No available bills found.');
        }
      } else {
        setBills([]);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      alert(`Failed to fetch bills: ${error.message}`);
    } finally {
      setLoadingBills(false);
    }
  };

  const sortBills = (billsArray, order) => {
    if (!billsArray || !Array.isArray(billsArray)) return [];
    return [...billsArray].sort((a, b) => {
      const billNumA = a['Bill Number'] || '';
      const billNumB = b['Bill Number'] || '';

      if (order === 'desc') {
        return billNumB.localeCompare(billNumA, undefined, { numeric: true });
      } else {
        return billNumA.localeCompare(billNumB, undefined, { numeric: true });
      }
    });
  };

  const applyFilters = (billsToFilter) => {
    if (!billsToFilter || !Array.isArray(billsToFilter)) return [];

    let filtered = [...billsToFilter];

    if (filterParty) {
      filtered = filtered.filter(bill => bill['Party Name'] === filterParty);
    }

    if (searchTerm) {
      filtered = filtered.filter(bill =>
        bill['Bill Number']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill['Party Name']?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return sortBills(filtered, sortOrder);
  };

  const clearFilters = () => {
    setFilterParty('');
    setSearchTerm('');
    setSortOrder('desc');
  };

  const fetchDriversFromSheet = async () => {
    setLoadingDrivers(true);
    try {
      const { apiKey, sheetId, driverSheetName } = GOOGLE_SHEETS_CONFIG;
      const range = `${driverSheetName}!A:C`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const rows = data.values.slice(1);
        const parsedDrivers = rows.map(row => ({
          driverName: row[0] || '',
          vehicleNumber: row[1] || '',
          mobileNumber: row[2] || ''
        })).filter(driver => driver.driverName);

        setDrivers(parsedDrivers);
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    fetchBillsFromSheet();
    fetchDriversFromSheet();
  }, []);

  useEffect(() => {
    if (bills && bills.length > 0) {
      const filteredAndSorted = applyFilters(bills);
      setBills(filteredAndSorted);
    }
  }, [filterParty, searchTerm, sortOrder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setGatepassData(prev => ({ ...prev, [name]: value }));
  };

  const handleDriverSelect = (driverName) => {
    const selectedDriver = drivers.find(driver => driver.driverName === driverName);

    if (selectedDriver) {
      setGatepassData(prev => ({
        ...prev,
        driverName: selectedDriver.driverName,
        vehicleNumber: selectedDriver.vehicleNumber,
        driverContact: selectedDriver.mobileNumber
      }));
    } else {
      setGatepassData(prev => ({
        ...prev,
        driverName: driverName,
        vehicleNumber: '',
        driverContact: ''
      }));
    }
  };

  const updateBillsWithGatepassInfo = async (selectedBills, gatepassNumber) => {
    try {
      const billNumbers = selectedBills.map(bill => bill['Bill Number']);

      const gatepassDataToSend = {
        selectedBills: selectedBills.map(bill => ({
          'Bill Number': bill['Bill Number'],
          additionalDetails: bill.additionalDetails
        })),
        driverName: gatepassData.driverName,
        driverContact: gatepassData.driverContact,
        vehicleNumber: gatepassData.vehicleNumber,
        driverVehicleNumber: gatepassData.vehicleNumber,
        purpose: gatepassData.purpose,
        consolidatedRemarks: gatepassData.consolidatedRemarks,
        totalBoxes: gatepassData.totalPetti || 0,
        totalBags: gatepassData.totalBora || 0,
        totalPolybags: gatepassData.totalPolybags || 0,
        porter: gatepassData.isPorter ? 'YES' : 'NO',
        byHand: gatepassData.isByHand ? 'YES' : 'NO',
        byHandPersonName: gatepassData.byHandPersonName || '',
        gatepassNumber: gatepassNumber,
        gatepassTime: new Date().toLocaleString()
      };

      const updateData = {
        action: 'updateGatepass',
        billNumbers: billNumbers,
        gatepassNumber: gatepassNumber,
        gatepassData: gatepassDataToSend
      };

      console.log('Sending Gatepass update to Express Backend:', updateData);

      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `action=updateGatepass&data=${encodeURIComponent(JSON.stringify(updateData))}`
      });

      const result = await response.json();
      console.log('Gatepass update response from Backend:', result);

      return true;

    } catch (error) {
      console.error("Error updating bills with gatepass info:", error);
      return false;
    }
  };

  // NEW FUNCTION: Send Gatepass Email
  const sendGatepassEmail = async (gatepassInfo, pdfBlob) => {
    setSendingEmail(true);

    try {
      // Convert PDF blob to base64 for sending
      const reader = new FileReader();
      const pdfBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      // Prepare email data
      const emailData = {
        action: 'sendGatepassEmail',
        gatepassNumber: gatepassInfo.gatepassNumber,
        gatepassData: {
          gatepassNumber: gatepassInfo.gatepassNumber,
          vehicleNumber: gatepassInfo.vehicleNumber,
          driverName: gatepassInfo.driverName,
          driverContact: gatepassInfo.driverContact,
          purpose: gatepassInfo.purpose,
          consolidatedRemarks: gatepassInfo.consolidatedRemarks,
          totalPetti: gatepassInfo.totalPetti,
          totalBora: gatepassInfo.totalBora,
          totalPolybags: gatepassInfo.totalPolybags,
          totalBills: gatepassInfo.selectedBills.length,
          selectedBills: gatepassInfo.selectedBills.map(bill => ({
            billNumber: bill['Bill Number'],
            billDate: bill['Bill Date'],
            partyName: bill['Party Name'],
            partyInitials: getPartyInitials(bill['Party Name']),
            totalPetti: bill.additionalDetails?.totalPetti || 0,
            totalBora: bill.additionalDetails?.totalBora || 0,
            totalPolybags: bill.additionalDetails?.totalPolybags || 0,
            isByHand: bill.additionalDetails?.isByHand || false,
            byHandQuantity: bill.additionalDetails?.byHandQuantity || 0,
            byHandPersonName: bill.additionalDetails?.byHandPersonName || '',
            byPorter: bill.additionalDetails?.byPorter || false
          })),
          createdAt: new Date().toISOString(),
          isByHandOnly: isAllByHand()
        },
        pdfBase64: pdfBase64,
        pdfFileName: `Gatepass_${gatepassInfo.gatepassNumber}.pdf`
      };

      // Send email via Apps Script
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `payload=${encodeURIComponent(JSON.stringify(emailData))}`
      });

      console.log('Email send request sent');
      return true;

    } catch (error) {
      console.error('Error sending email:', error);
      // Don't show alert to user - email is just a notification
      return false;
    } finally {
      setSendingEmail(false);
    }
  };

  const calculateTotalsFromBills = (selectedBills) => {
    if (!selectedBills || !Array.isArray(selectedBills)) {
      return { totalPetti: 0, totalBora: 0, totalPolybags: 0 };
    }

    const totals = {
      totalPetti: 0,
      totalBora: 0,
      totalPolybags: 0
    };

    selectedBills.forEach(bill => {
      const petti = parseFloat(bill.additionalDetails?.totalPetti) || 0;
      const bora = parseFloat(bill.additionalDetails?.totalBora) || 0;
      const polybags = parseFloat(bill.additionalDetails?.totalPolybags) || 0;

      totals.totalPetti += petti;
      totals.totalBora += bora;
      totals.totalPolybags += polybags;
    });

    return totals;
  };

  // Handle bill details modal input changes
  const handleBillDetailsChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'isByHand') {
      if (!checked) {
        setBillDetails(prev => ({
          ...prev,
          isByHand: checked,
          byHandQuantity: 0,
          byHandPersonName: '',
          byPorter: false
        }));
      } else {
        setBillDetails(prev => ({
          ...prev,
          isByHand: checked
        }));
      }
    } else {
      setBillDetails(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  // Open modal when bill is clicked
  const openBillDetailsModal = (bill) => {
    if (isBillSelected(bill['Bill Number'])) {
      alert(`Bill ${bill['Bill Number']} is already selected`);
      return;
    }

    let totalQuantity = 0;

    if (bill.parsedBillData) {
      if (bill.parsedBillData.totalQuantity) {
        totalQuantity = bill.parsedBillData.totalQuantity;
      } else if (bill.parsedBillData.items && Array.isArray(bill.parsedBillData.items)) {
        totalQuantity = bill.parsedBillData.items.reduce((sum, item) =>
          sum + (parseInt(item.quantity) || 0), 0);
      }
    }
    else if (bill['Bill Data (JSON)']) {
      try {
        const parsedData = typeof bill['Bill Data (JSON)'] === 'string'
          ? JSON.parse(bill['Bill Data (JSON)'])
          : bill['Bill Data (JSON)'];

        if (parsedData.totalQuantity) {
          totalQuantity = parsedData.totalQuantity;
        } else if (parsedData.items && Array.isArray(parsedData.items)) {
          totalQuantity = parsedData.items.reduce((sum, item) =>
            sum + (parseInt(item.quantity) || 0), 0);
        }
      } catch (e) {
        console.error('Error parsing bill JSON:', e);
      }
    }

    setBillDetails({
      totalPetti: 0,
      totalBora: 0,
      totalPolybags: 0,
      isByHand: false,
      byHandQuantity: totalQuantity,
      byHandPersonName: '',
      byPorter: false
    });

    let enhancedBill = { ...bill };
    if (!enhancedBill.parsedBillData && enhancedBill['Bill Data (JSON)']) {
      try {
        const parsedData = typeof enhancedBill['Bill Data (JSON)'] === 'string'
          ? JSON.parse(enhancedBill['Bill Data (JSON)'])
          : enhancedBill['Bill Data (JSON)'];
        enhancedBill.parsedBillData = parsedData;
      } catch (e) {
        console.error('Error parsing bill JSON:', e);
      }
    }

    setCurrentSelectedBill(enhancedBill);
    setShowBillDetailsModal(true);
  };

  // Handle modal submit
  const handleBillDetailsSubmit = () => {
    if (billDetails.totalPetti === 0 && billDetails.totalBora === 0 && billDetails.totalPolybags === 0) {
      alert('Please enter at least one item quantity (Petti, Bora, or Polybags)');
      return;
    }

    if (billDetails.isByHand) {
      if (billDetails.byHandQuantity <= 0 && !billDetails.byPorter) {
        alert('Please enter by-hand quantity or select Porter for by-hand handling');
        return;
      }
    }

    const enhancedBill = {
      ...currentSelectedBill,
      additionalDetails: {
        totalPetti: parseFloat(billDetails.totalPetti) || 0,
        totalBora: parseFloat(billDetails.totalBora) || 0,
        totalPolybags: parseFloat(billDetails.totalPolybags) || 0,
        isByHand: billDetails.isByHand,
        byHandQuantity: billDetails.isByHand ? (parseFloat(billDetails.byHandQuantity) || 0) : 0,
        byHandPersonName: billDetails.isByHand ? billDetails.byHandPersonName : '',
        byPorter: billDetails.isByHand ? billDetails.byPorter : false
      },
      parsedBillData: currentSelectedBill.parsedBillData || (() => {
        try {
          if (currentSelectedBill['Bill Data (JSON)']) {
            return typeof currentSelectedBill['Bill Data (JSON)'] === 'string'
              ? JSON.parse(currentSelectedBill['Bill Data (JSON)'])
              : currentSelectedBill['Bill Data (JSON)'];
          }
        } catch (e) {
          console.error('Error parsing bill JSON:', e);
        }
        return null;
      })()
    };

    const updatedSelectedBills = [...gatepassData.selectedBills, enhancedBill];

    const calculatedTotals = calculateTotalsFromBills(updatedSelectedBills);

    setGatepassData(prev => ({
      ...prev,
      selectedBills: updatedSelectedBills,
      totalPetti: calculatedTotals.totalPetti,
      totalBora: calculatedTotals.totalBora,
      totalPolybags: calculatedTotals.totalPolybags
    }));
    setSelectedBillDetails(updatedSelectedBills);
    setShowBillDetailsModal(false);
    setCurrentSelectedBill(null);
  };

  const handleBillSelect = (bill) => {
    openBillDetailsModal(bill);
  };

  const handleRemoveBill = (billToRemove) => {
    const updatedSelectedBills = gatepassData.selectedBills.filter(
      bill => bill['Bill Number'] !== billToRemove['Bill Number']
    );

    const calculatedTotals = calculateTotalsFromBills(updatedSelectedBills);

    setGatepassData(prev => ({
      ...prev,
      selectedBills: updatedSelectedBills,
      totalPetti: calculatedTotals.totalPetti,
      totalBora: calculatedTotals.totalBora,
      totalPolybags: calculatedTotals.totalPolybags
    }));
    setSelectedBillDetails(updatedSelectedBills);
  };

  const handleClearAllBills = () => {
    setGatepassData(prev => ({
      ...prev,
      selectedBills: [],
      totalPetti: 0,
      totalBora: 0,
      totalPolybags: 0
    }));
    setSelectedBillDetails([]);
  };

  const getUniqueParties = () => {
    if (!gatepassData.selectedBills || !Array.isArray(gatepassData.selectedBills)) return [];
    const parties = gatepassData.selectedBills.map(bill => bill['Party Name']);
    return [...new Set(parties)];
  };

  const getUniquePartyInitials = () => {
    if (!gatepassData.selectedBills || !Array.isArray(gatepassData.selectedBills)) return [];
    const initials = gatepassData.selectedBills.map(bill =>
      getPartyInitials(bill['Party Name'])
    );
    return [...new Set(initials)];
  };

  const generatePDF = (gatepassInfo) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let y = 15;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("DISPATCH GATE PASS", pageWidth / 2, y, { align: "center" });

    y += 5;

    doc.setLineWidth(0.3);
    doc.line(10, y, pageWidth - 10, y);

    y += 8;

    doc.setFontSize(10);
    doc.setFont("times", "bold");

    const currentDateTime = new Date();
    const formattedDateTime = `${currentDateTime.toLocaleDateString()} ${currentDateTime.toLocaleTimeString()}`;

    doc.text(`Gatepass No: ${gatepassInfo.gatepassNumber || "-"}`, 15, y);
    doc.text(`Date & Time: ${formattedDateTime}`, pageWidth - 75, y);

    y += 6;

    doc.setFontSize(9);
    doc.setFont("times", "normal");
    doc.text("Petti | Bora | Polybags", 15, y);

    y += 6;

    const isByHandOnly = gatepassInfo.isByHandOnly || false;

    doc.rect(10, y, 90, 40);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(isByHandOnly ? "HANDLING DETAILS" : "VEHICLE AND TRANSPORT DETAILS", 55, y + 6, { align: "center" });

    doc.setFont("times", "normal");
    doc.setFontSize(9);

    if (isByHandOnly) {
      const byHandBills = gatepassInfo.selectedBills.filter(
        bill => bill.additionalDetails?.isByHand === true
      );

      let handlingText = "";

      if (byHandBills.length > 0) {
        const handlingDetails = [];

        byHandBills.forEach((bill) => {
          const details = bill.additionalDetails;

          if (details?.byPorter && details?.porterPersonName) {
            handlingDetails.push(details.porterPersonName);
          }

          if (details?.byHandQuantity > 0 && details?.byHandPersonName) {
            handlingDetails.push(details.byHandPersonName);
          }
        });

        handlingText = [...new Set(handlingDetails)].join(", ");
      }

      doc.text("Handling Method:", 15, y + 14);
      doc.setFont("times", "bold");
      doc.text("By Hand / Porter", 60, y + 14);

      doc.setFont("times", "normal");
      doc.text("Details:", 15, y + 20);

      doc.setFont("times", "bold");
      const wrappedText = doc.splitTextToSize(
        handlingText || "Porter details not available",
        70
      );

      doc.text(wrappedText, 60, y + 20);
    } else {
      doc.text("Vehicle No:", 15, y + 14);
      doc.setFont("times", "bold");
      doc.text(`${gatepassInfo.vehicleNumber || "-"}`, 60, y + 14);

      doc.setFont("times", "normal");
      doc.text("Driver Name:", 15, y + 20);
      doc.setFont("times", "bold");
      doc.text(`${gatepassInfo.driverName || "-"}`, 60, y + 20);

      doc.setFont("times", "normal");
      doc.text("Driver Contact:", 15, y + 26);
      doc.setFont("times", "bold");
      doc.text(`${gatepassInfo.driverContact || "-"}`, 60, y + 26);

      doc.setFont("times", "normal");
      doc.text("Purpose:", 15, y + 32);
      doc.setFont("times", "bold");
      doc.text(`${gatepassInfo.purpose || "-"}`, 60, y + 32);
    }

    doc.rect(110, y, 90, 40);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("DISPATCH DETAILS", 155, y + 6, { align: "center" });

    const totalPetti = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (bill.additionalDetails?.totalPetti || 0), 0);
    const totalBora = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (bill.additionalDetails?.totalBora || 0), 0);
    const totalPolybags = gatepassInfo.selectedBills.reduce((sum, bill) => sum + (bill.additionalDetails?.totalPolybags || 0), 0);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Total Petti:", 120, y + 16);
    doc.setFont("times", "bold");
    doc.text(`${totalPetti}`, 175, y + 16);

    doc.setFont("times", "normal");
    doc.text("Total Bora:", 120, y + 22);
    doc.setFont("times", "bold");
    doc.text(`${totalBora}`, 175, y + 22);

    doc.setFont("times", "normal");
    doc.text("Total Polybags:", 120, y + 28);
    doc.setFont("times", "bold");
    doc.text(`${totalPolybags}`, 175, y + 28);

    y += 50;

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("BILL SUMMARY", 10, y);

    y += 8;

    const tableStartX = 10;
    const tableWidth = 190;

    const colPositions = {
      serial: 15,
      billNo: 40,
      billDate: 80,
      totalQty: 110,
      partyInitials: 135,
      packing: 160
    };

    doc.setFillColor(200, 200, 200);
    doc.rect(tableStartX, y, tableWidth, 12, 'F');
    doc.setFont("times", "bold");
    doc.setFontSize(10);

    doc.text("#", colPositions.serial, y + 8);
    doc.text("Bill No.", colPositions.billNo, y + 8);
    doc.text("Bill Date", colPositions.billDate, y + 8);
    doc.text("Total Qty", colPositions.totalQty, y + 8);
    doc.text("Party", colPositions.partyInitials, y + 8);
    doc.text("Petti | Bora | Polybags", colPositions.packing, y + 8);

    y += 12;

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const rowHeight = 10;

    const getTotalQuantity = (bill) => {
      if (bill.parsedBillData) {
        if (bill.parsedBillData.totalQuantity) {
          return bill.parsedBillData.totalQuantity;
        }
        if (bill.parsedBillData.items && Array.isArray(bill.parsedBillData.items)) {
          const sum = bill.parsedBillData.items.reduce((total, item) => {
            return total + (parseInt(item.quantity) || 0);
          }, 0);
          if (sum > 0) return sum;
        }
      }

      if (bill['Bill Data (JSON)']) {
        try {
          const parsedData = typeof bill['Bill Data (JSON)'] === 'string'
            ? JSON.parse(bill['Bill Data (JSON)'])
            : bill['Bill Data (JSON)'];

          if (parsedData.totalQuantity) {
            return parsedData.totalQuantity;
          }
          if (parsedData.items && Array.isArray(parsedData.items)) {
            const sum = parsedData.items.reduce((total, item) => {
              return total + (parseInt(item.quantity) || 0);
            }, 0);
            if (sum > 0) return sum;
          }
        } catch (e) {
          console.error('Error parsing bill JSON for quantity:', e);
        }
      }

      if (bill['Total Quantity']) {
        return bill['Total Quantity'];
      }

      return 0;
    };

    if (gatepassInfo.selectedBills && Array.isArray(gatepassInfo.selectedBills)) {
      gatepassInfo.selectedBills.forEach((bill, index) => {
        if (y + rowHeight > pageHeight - 50) {
          doc.addPage();
          y = 20;

          doc.setFillColor(200, 200, 200);
          doc.rect(tableStartX, y, tableWidth, 12, 'F');
          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.text("#", colPositions.serial, y + 8);
          doc.text("Bill No.", colPositions.billNo, y + 8);
          doc.text("Bill Date", colPositions.billDate, y + 8);
          doc.text("Total Qty", colPositions.totalQty, y + 8);
          doc.text("Party", colPositions.partyInitials, y + 8);
          doc.text("Petti | Bora | Polybags", colPositions.packing, y + 8);
          y += 12;
          doc.setFont("times", "normal");
          doc.setFontSize(9);
        }

        doc.rect(tableStartX, y, tableWidth, rowHeight);

        const partyInitials = bill['Party Initials'] || getPartyInitials(bill['Party Name']);

        const billDate = bill["Bill Date"] || "-";
        const formattedBillDate = billDate.split('T')[0];

        const totalQuantity = getTotalQuantity(bill);

        const petti = bill.additionalDetails?.totalPetti || 0;
        const bora = bill.additionalDetails?.totalBora || 0;
        const polybags = bill.additionalDetails?.totalPolybags || 0;

        let packingText = "";
        const packingParts = [];
        if (petti > 0) packingParts.push(`${petti} Petti`);
        if (bora > 0) packingParts.push(`${bora} Bora`);
        if (polybags > 0) packingParts.push(`${polybags} Polybags`);
        packingText = packingParts.join(" | ");

        if (packingText.length > 30) {
          packingText = packingText.substring(0, 27) + "...";
        }

        const textY = y + 7;

        doc.text(String(index + 1), colPositions.serial, textY);
        doc.text(bill["Bill Number"] || "-", colPositions.billNo, textY);
        doc.text(formattedBillDate, colPositions.billDate, textY);
        doc.text(String(totalQuantity), colPositions.totalQty, textY);
        doc.text(partyInitials, colPositions.partyInitials, textY);
        doc.text(packingText || "0", colPositions.packing, textY);

        y += rowHeight;
      });
    }

    const tableEndY = y;
    const tableStartY = y - ((gatepassInfo.selectedBills && gatepassInfo.selectedBills.length) || 0) * rowHeight;

    doc.line(colPositions.serial - 5, tableStartY, colPositions.serial - 5, tableEndY);
    doc.line(colPositions.billNo - 5, tableStartY, colPositions.billNo - 5, tableEndY);
    doc.line(colPositions.billDate - 5, tableStartY, colPositions.billDate - 5, tableEndY);
    doc.line(colPositions.totalQty - 5, tableStartY, colPositions.totalQty - 5, tableEndY);
    doc.line(colPositions.partyInitials - 5, tableStartY, colPositions.partyInitials - 5, tableEndY);
    doc.line(tableStartX, tableStartY, tableStartX, tableEndY);
    doc.line(tableStartX + tableWidth, tableStartY, tableStartX + tableWidth, tableEndY);

    y += 6;

    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("HANDLING DETAILS", 10, y);
    y += 8;

    if (gatepassInfo.selectedBills && Array.isArray(gatepassInfo.selectedBills)) {
      gatepassInfo.selectedBills.forEach((bill, index) => {
        if (bill.additionalDetails && bill.additionalDetails.isByHand) {
          const details = bill.additionalDetails;
          const hasDetails = details.byHandQuantity > 0 || details.byPorter;

          if (hasDetails) {
            if (y + 30 > pageHeight - 30) {
              doc.addPage();
              y = 20;
            }

            doc.setFont("times", "bold");
            doc.setFontSize(10);
            doc.text(`Bill ${bill['Bill Number']}:`, 10, y);
            y += 5;

            doc.setFont("times", "normal");
            doc.setFontSize(9);

            let detailsText = [];
            if (details.byHandQuantity > 0) {
              detailsText.push(`By Hand Quantity: ${details.byHandQuantity}${details.byHandPersonName ? ` (Person: ${details.byHandPersonName})` : ''}`);
            }
            if (details.byPorter) detailsText.push(`Porter Required: Yes`);

            if (detailsText.length > 0) {
              const detailsString = detailsText.join(" | ");
              const wrappedDetails = doc.splitTextToSize(detailsString, 180);
              doc.text(wrappedDetails, 15, y);
              y += 8 * wrappedDetails.length;
            }
          }
        }
      });
    }

    y += 4;

    doc.setFont("times", "bold");
    doc.setFontSize(11);

    doc.text(`Total Bills: ${gatepassInfo.selectedBills ? gatepassInfo.selectedBills.length : 0}`, 10, y);
    y += 7;

    const uniquePartyInitials = getUniquePartyInitials();
    const uniquePartyCount = uniquePartyInitials.length;

    doc.text(`Total Unique Parties: ${uniquePartyCount}`, 10, y);
    y += 7;

    const totalOverallQuantity = gatepassInfo.selectedBills.reduce((sum, bill) => {
      let qty = 0;

      if (bill.parsedBillData) {
        if (bill.parsedBillData.totalQuantity) {
          qty = bill.parsedBillData.totalQuantity;
        } else if (bill.parsedBillData.items && Array.isArray(bill.parsedBillData.items)) {
          qty = bill.parsedBillData.items.reduce((total, item) => {
            return total + (parseInt(item.quantity) || 0);
          }, 0);
        }
      }
      else if (bill['Bill Data (JSON)']) {
        try {
          const parsedData = typeof bill['Bill Data (JSON)'] === 'string'
            ? JSON.parse(bill['Bill Data (JSON)'])
            : bill['Bill Data (JSON)'];

          if (parsedData.totalQuantity) {
            qty = parsedData.totalQuantity;
          } else if (parsedData.items && Array.isArray(parsedData.items)) {
            qty = parsedData.items.reduce((total, item) => {
              return total + (parseInt(item.quantity) || 0);
            }, 0);
          }
        } catch (e) {
          console.error('Error parsing bill JSON for total quantity:', e);
        }
      }

      return sum + qty;
    }, 0);

    doc.text(`Total Quantity: ${totalOverallQuantity}`, 10, y);
    y += 7;

    if (uniquePartyCount > 0) {
      doc.setFont("times", "normal");
      y += 7;
    }

    if (gatepassInfo.consolidatedRemarks) {
      y += 4;
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.text("Remarks:", 10, y);
      y += 5;
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const remarksLines = doc.splitTextToSize(gatepassInfo.consolidatedRemarks, 180);
      doc.text(remarksLines, 10, y);
      y += remarksLines.length * 5;
    }

    if (y > 245) {
      y = 245;
    } else {
      y = 255;
    }

    doc.setFont("times", "bold");
    doc.setFontSize(10);

    doc.line(20, y, 70, y);
    doc.text("Authorized Signature", 45, y + 5, { align: "center" });

    doc.line(80, y, 130, y);
    if (!isByHandOnly) {
      doc.text("Driver Signature", 105, y + 5, { align: "center" });
    } else {
      doc.text("Handled By Signature", 105, y + 5, { align: "center" });
    }

    doc.line(140, y, 190, y);
    doc.text("Security Signature", 165, y + 5, { align: "center" });

    const pdfOutput = doc.output('blob');
    return pdfOutput;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!gatepassData.selectedBills || gatepassData.selectedBills.length === 0) {
      alert('Please select at least one bill for the gatepass');
      return;
    }

    const vehicleDetailsRequired = areVehicleDetailsRequired();

    if (vehicleDetailsRequired) {
      if (!gatepassData.vehicleNumber || !gatepassData.driverName || !gatepassData.driverContact) {
        alert('Please fill in all vehicle and driver details. Vehicle details are required for non-hand delivery bills.');
        return;
      }
    } else {
      if (!window.confirm('This gatepass contains only by-hand items. No vehicle details are required. Continue?')) {
        return;
      }
    }

    const uniqueParties = getUniqueParties();
    const uniquePartyInitials = getUniquePartyInitials();
    const gatepassNumber = `MGP-${Date.now()}`;

    const gatepassWithBills = {
      ...gatepassData,
      gatepassNumber: gatepassNumber,
      status: 'active',
      createdAt: new Date().toISOString(),
      uniqueParties: uniqueParties,
      uniquePartyInitials: uniquePartyInitials,
      selectedBills: gatepassData.selectedBills,
      totalBills: gatepassData.selectedBills.length,
      isByHandOnly: isAllByHand()
    };

    setGeneratedGatepass(gatepassWithBills);

    // Generate PDF
    const pdfBlob = generatePDF(gatepassWithBills);

    // Send email with PDF
    const emailSent = await sendGatepassEmail(gatepassWithBills, pdfBlob);

    // Update Google Sheet
    const updateSuccess = await updateBillsWithGatepassInfo(gatepassData.selectedBills, gatepassNumber);

    // Download PDF
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = pdfUrl;
    downloadLink.download = `Gatepass_${gatepassNumber}.pdf`;
    downloadLink.click();
    URL.revokeObjectURL(pdfUrl);

    if (onSubmit) {
      onSubmit(gatepassWithBills);
    }

    setTimeout(() => {
      setGeneratedGatepass(null);
      setGatepassData({
        vehicleNumber: '',
        driverName: '',
        driverContact: '',
        totalPetti: 0,
        totalBora: 0,
        totalPolybags: 0,
        purpose: 'delivery',
        remarks: '',
        selectedBills: [],
        consolidatedRemarks: ''
      });
      setSelectedBillDetails([]);
      fetchBillsFromSheet();
    }, 2000);
  };

  const filteredBills = bills ? applyFilters(bills) : [];
  const vehicleDetailsRequired = areVehicleDetailsRequired();
  const allByHand = isAllByHand();

  return (
    <div className="gatepass-generator">
      {/* Header */}
      <header className="generator-header">
        <div className="header-left">
          <button className="back-button" onClick={() => window.history.back()}>
            ← Back
          </button>
          <div className="header-info">
            <h1>Dispatch Gatepass</h1>
            <p>Create consolidated gatepass for multiple bills</p>
          </div>
        </div>
        <div className="header-right">
          <div className="stats-card">
            <span className="stats-number">{gatepasses ? gatepasses.length : 0}</span>
            <span className="stats-label">Total Gatepasses</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="generator-main">
        {/* Left Sidebar - Bill Selection with Filters */}
        <div className="bills-sidebar">
          <div className="sidebar-header">
            <h3>
              <span className="icon">📋</span>
              Available Bills
            </h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by bill number or party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button onClick={fetchBillsFromSheet} disabled={loadingBills}>
                🔄
              </button>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <div className="filters-header">
              <h4>Filters</h4>
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear All
              </button>
            </div>

            <div className="filter-group">
              <label>Party Name</label>
              <select
                value={filterParty}
                onChange={(e) => setFilterParty(e.target.value)}
                className="filter-select"
              >
                <option value="">All Parties</option>
                {uniquePartiesList.map((party, index) => (
                  <option key={index} value={party}>
                    {party}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sort Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="filter-select"
              >
                <option value="desc">Descending (Newest First)</option>
                <option value="asc">Ascending (Oldest First)</option>
              </select>
            </div>

            {(filterParty || searchTerm) && (
              <div className="active-filters">
                <span className="active-filters-label">Active Filters:</span>
                <div className="filter-tags">
                  {filterParty && <span className="filter-tag">Party: {filterParty}</span>}
                  {searchTerm && <span className="filter-tag">Search: {searchTerm}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="bills-container">
            {loadingBills ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading bills...</p>
              </div>
            ) : !filteredBills || filteredBills.length === 0 ? (
              <div className="empty-state">
                <p>{searchTerm || filterParty ? 'No matching bills found with current filters' : 'No bills available'}</p>
                {(searchTerm || filterParty) && (
                  <button className="clear-filters-btn" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="bills-count-info">
                  Showing {filteredBills.length} of {bills ? bills.length : 0} bills
                  {sortOrder === 'desc' && <span className="sort-indicator">↓ Sorted by Bill Number (Newest First)</span>}
                  {sortOrder === 'asc' && <span className="sort-indicator">↑ Sorted by Bill Number (Oldest First)</span>}
                </div>
                {filteredBills.map((bill, index) => (
                  <div
                    key={index}
                    className={`bill-card ${isBillSelected(bill['Bill Number']) ? 'selected' : ''}`}
                    onClick={() => handleBillSelect(bill)}
                  >
                    <div className="bill-card-content">
                      <div className="bill-number">
                        {bill['Bill Number']}
                        {isBillSelected(bill['Bill Number']) && (
                          <span className="selected-badge">✓ Selected</span>
                        )}
                      </div>
                      <div className="bill-date">📅 {bill['Bill Date']}</div>
                      <div className="bill-party">
                        {bill['Party Name']}
                        <span className="party-initials">({getPartyInitials(bill['Party Name'])})</span>
                      </div>
                    </div>
                    <button className={`add-button ${isBillSelected(bill['Bill Number']) ? 'disabled' : ''}`}>
                      {isBillSelected(bill['Bill Number']) ? '✓' : '+'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Middle Content - Selected Bills Summary */}
        <div className="selected-summary-column">
          <div className="selected-summary">
            <div className="summary-header">
              <h3>
                <span className="icon">✅</span>
                Selected Bills ({gatepassData.selectedBills ? gatepassData.selectedBills.length : 0})
              </h3>
              {gatepassData.selectedBills && gatepassData.selectedBills.length > 0 && (
                <button className="clear-button" onClick={handleClearAllBills}>
                  Clear All
                </button>
              )}
            </div>

            {!gatepassData.selectedBills || gatepassData.selectedBills.length === 0 ? (
              <div className="empty-selection">
                <div className="empty-icon">📄</div>
                <p>No bills selected</p>
                <small>Click on bills from the left panel to add them</small>
              </div>
            ) : (
              <div className="selected-bills-grid">
                {gatepassData.selectedBills.map((bill, index) => (
                  <div key={index} className="selected-bill-card">
                    <div className="selected-bill-info">
                      <span className="bill-badge">{bill['Bill Number']}</span>
                      <span className="bill-date">📅 {bill['Bill Date']}</span>
                      <span className="party-name">
                        {bill['Party Name']}
                        <small>({getPartyInitials(bill['Party Name'])})</small>
                      </span>
                      <div className="packing-details">
                        📦 Petti: {bill.additionalDetails?.totalPetti || 0} |
                        🛍️ Bora: {bill.additionalDetails?.totalBora || 0} |
                        🎒 Polybags: {bill.additionalDetails?.totalPolybags || 0}
                      </div>
                      {bill.additionalDetails && bill.additionalDetails.isByHand && (
                        <div className="handling-details">
                          {(bill.additionalDetails.byHandQuantity > 0 || bill.additionalDetails.byPorter) && (
                            <div className="handling-badge">
                              {bill.additionalDetails.byHandQuantity > 0 && (
                                <span className="handling-tag by-hand">
                                  ✋ By Hand: {bill.additionalDetails.byHandQuantity}
                                  {bill.additionalDetails.byHandPersonName && ` (${bill.additionalDetails.byHandPersonName})`}
                                </span>
                              )}
                              {bill.additionalDetails.byPorter && (
                                <span className="handling-tag porter">🚶 Porter</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className="remove-button"
                      onClick={() => handleRemoveBill(bill)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Content - Form Area */}
        <div className="form-content">
          {gatepassData.selectedBills && gatepassData.selectedBills.length > 0 ? (
            <form onSubmit={handleSubmit} className="gatepass-form">
              {/* Show warning banner for by-hand only gatepass */}
              {allByHand && (
                <div className="warning-banner">
                  <span className="warning-icon">✋</span>
                  <span>All selected bills are marked as "By Hand" or "Porter". Vehicle details are optional for this gatepass.</span>
                </div>
              )}

              {/* Tabs - Hide vehicle tab if all by-hand */}
              <div className="form-tabs">
                {!allByHand && (
                  <button
                    type="button"
                    className={`tab ${activeTab === 'vehicle' ? 'active' : ''}`}
                    onClick={() => setActiveTab('vehicle')}
                  >
                    🚛 Vehicle Details {vehicleDetailsRequired && <span className="required-star">*</span>}
                  </button>
                )}
                <button
                  type="button"
                  className={`tab ${activeTab === 'remarks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('remarks')}
                >
                  📝 Remarks
                </button>
              </div>

              {/* Vehicle Details Tab - Only show if not all by-hand */}
              {!allByHand && activeTab === 'vehicle' && (
                <div className="tab-content">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Name {vehicleDetailsRequired && <span className="required-star">*</span>}</label>
                      <select
                        name="driverName"
                        value={gatepassData.driverName}
                        onChange={(e) => handleDriverSelect(e.target.value)}
                        required={vehicleDetailsRequired}
                      >
                        <option value="">Select Driver</option>
                        {drivers.map((driver, index) => (
                          <option key={index} value={driver.driverName}>
                            {driver.driverName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Vehicle Number {vehicleDetailsRequired && <span className="required-star">*</span>}</label>
                      <input
                        type="text"
                        name="vehicleNumber"
                        value={gatepassData.vehicleNumber}
                        onChange={handleChange}
                        placeholder="Auto-filled from driver selection"
                        required={vehicleDetailsRequired}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver Contact {vehicleDetailsRequired && <span className="required-star">*</span>}</label>
                      <input
                        type="tel"
                        name="driverContact"
                        value={gatepassData.driverContact}
                        onChange={handleChange}
                        placeholder="Auto-filled from driver selection"
                        required={vehicleDetailsRequired}
                        readOnly
                      />
                    </div>
                    <div className="form-group">
                      <label>Purpose {vehicleDetailsRequired && <span className="required-star">*</span>}</label>
                      <select name="purpose" value={gatepassData.purpose} onChange={handleChange} required={vehicleDetailsRequired}>
                        <option value="delivery">Delivery</option>
                        <option value="pickup">Pickup</option>
                        <option value="transfer">Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Remarks Tab */}
              {activeTab === 'remarks' && (
                <div className="tab-content">
                  <div className="form-group full-width">
                    <label>Consolidated Remarks</label>
                    <textarea
                      name="consolidatedRemarks"
                      value={gatepassData.consolidatedRemarks}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Any special instructions or notes for this consolidated dispatch..."
                    />
                  </div>
                </div>
              )}

              {/* Dispatch Summary */}
              <div className="dispatch-summary">
                <h4>Dispatch Summary (Auto-calculated from Bills)</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Petti:</span>
                    <span className="summary-value">{gatepassData.totalPetti}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Bora:</span>
                    <span className="summary-value">{gatepassData.totalBora}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Polybags:</span>
                    <span className="summary-value">{gatepassData.totalPolybags}</span>
                  </div>
                </div>
                {hasAnyByHandSelection() && (
                  <div className="handling-summary">
                    <div className="handling-summary-header">
                      <span className="handling-summary-icon">✋</span>
                      <span>Handling Summary</span>
                    </div>
                    <div className="handling-summary-content">
                      {gatepassData.selectedBills.map((bill, idx) => {
                        if (bill.additionalDetails?.isByHand && (bill.additionalDetails.byHandQuantity > 0 || bill.additionalDetails.byPorter)) {
                          return (
                            <div key={idx} className="handling-summary-item">
                              <strong>Bill #{bill['Bill Number']}:</strong>
                              {bill.additionalDetails.byHandQuantity > 0 && (
                                <span> By Hand: {bill.additionalDetails.byHandQuantity}
                                  {bill.additionalDetails.byHandPersonName && ` (${bill.additionalDetails.byHandPersonName})`}
                                </span>
                              )}
                              {bill.additionalDetails.byPorter && <span> | Porter Required</span>}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Summary Section */}
              <div className="summary-section">
                <h4>Gatepass Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Total Bills:</span>
                    <span className="summary-value">{gatepassData.selectedBills.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Unique Parties:</span>
                    <span className="summary-value">{getUniqueParties().length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Party Initials:</span>
                    <span className="summary-value">{getUniquePartyInitials().join(", ")}</span>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={onBack}>
                  Cancel
                </button>
                <button type="submit" className="submit-button" disabled={sendingEmail}>
                  {sendingEmail ? "⏳ Sending..." : "📄 Generate Gatepass"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-form-state">
              <div className="empty-form-icon">🚚</div>
              <h3>Dispatch Details Form</h3>
              <p>Add one or more bills in the left panel to enable gatepass generation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bill Details Modal with Checkbox */}
      {showBillDetailsModal && currentSelectedBill && (
        <div className="modal-overlay" onClick={() => setShowBillDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Enter Dispatch Details</h3>
              <button className="modal-close" onClick={() => setShowBillDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bill-info">
                <div className="bill-info-row">
                  <strong>Bill Number:</strong> {currentSelectedBill['Bill Number']}
                </div>
                <div className="bill-info-row">
                  <strong>Party:</strong> {currentSelectedBill['Party Name']}
                </div>
                <div className="bill-info-row">
                  <strong>Total Quantity:</strong> {
                    (() => {
                      if (currentSelectedBill.parsedBillData) {
                        if (currentSelectedBill.parsedBillData.totalQuantity) {
                          return currentSelectedBill.parsedBillData.totalQuantity;
                        }
                        if (currentSelectedBill.parsedBillData.items) {
                          return currentSelectedBill.parsedBillData.items.reduce((sum, item) =>
                            sum + (parseInt(item.quantity) || 0), 0);
                        }
                      }
                      if (currentSelectedBill['Bill Data (JSON)']) {
                        try {
                          const parsed = typeof currentSelectedBill['Bill Data (JSON)'] === 'string'
                            ? JSON.parse(currentSelectedBill['Bill Data (JSON)'])
                            : currentSelectedBill['Bill Data (JSON)'];
                          if (parsed.totalQuantity) return parsed.totalQuantity;
                          if (parsed.items) {
                            return parsed.items.reduce((sum, item) =>
                              sum + (parseInt(item.quantity) || 0), 0);
                          }
                        } catch (e) { }
                      }
                      return 0;
                    })()
                  }
                </div>
              </div>

              <div className="form-section">
                <h4>Packing Details</h4>
                <div className="form-group">
                  <label>Petti (पेट्टी):</label>
                  <input
                    type="number"
                    name="totalPetti"
                    value={billDetails.totalPetti}
                    onChange={handleBillDetailsChange}
                    min="0"
                    step="1"
                    placeholder="Enter number of Petti"
                  />
                </div>

                <div className="form-group">
                  <label>Bora (बोरा):</label>
                  <input
                    type="number"
                    name="totalBora"
                    value={billDetails.totalBora}
                    onChange={handleBillDetailsChange}
                    min="0"
                    step="1"
                    placeholder="Enter number of Bora"
                  />
                </div>

                <div className="form-group">
                  <label>Polybags (पॉलीबैग):</label>
                  <input
                    type="number"
                    name="totalPolybags"
                    value={billDetails.totalPolybags}
                    onChange={handleBillDetailsChange}
                    min="0"
                    step="1"
                    placeholder="Enter number of Polybags"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Handling Details</h4>
                <div className="form-group checkbox-group">
                  <label className="by-hand-checkbox-label">
                    <input
                      type="checkbox"
                      name="isByHand"
                      checked={billDetails.isByHand}
                      onChange={handleBillDetailsChange}
                    />
                    <span className="checkbox-text">✋ By Hand </span>
                  </label>
                  <small className="field-hint">Check this if the items are being delivered by hand </small>
                </div>

                {billDetails.isByHand && (
                  <>
                    <div className="form-group">
                      <label>By Hand Quantity:</label>
                      <input
                        type="number"
                        name="byHandQuantity"
                        value={billDetails.byHandQuantity}
                        onChange={handleBillDetailsChange}
                        min="0"
                        step="1"
                        placeholder="Enter quantity being handled by hand"
                      />
                      <small className="field-hint">✓ Auto-filled with total quantity. You can modify if needed.</small>
                    </div>

                    <div className="form-group">
                      <label>By Hand Person Name (Optional):</label>
                      <input
                        type="text"
                        name="byHandPersonName"
                        value={billDetails.byHandPersonName}
                        onChange={handleBillDetailsChange}
                        placeholder="Enter person name (optional)"
                      />
                    </div>

                    <div className="form-group checkbox-group">
                      <label>
                        <input
                          type="checkbox"
                          name="byPorter"
                          checked={billDetails.byPorter}
                          onChange={handleBillDetailsChange}
                        />
                        Porter (पोर्टर)
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-button" onClick={() => setShowBillDetailsModal(false)}>
                Cancel
              </button>
              <button className="submit-button" onClick={handleBillDetailsSubmit}>
                Add Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {generatedGatepass && (
        <div className="toast-success">
          <span className="toast-icon">✅</span>
          <span>Gatepass generated with {generatedGatepass.selectedBills.length} bills! Email sent with attachment.</span>
        </div>
      )}
    </div>
  );
};

export default GatepassGenerator;
import React, { useState, useEffect } from 'react';
import './DispatchDetails.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function ManagementDispatchDetail({ updateDispatchStatus, onBack }) {
  const [recentDispatches, setRecentDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBill, setExpandedBill] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Date range filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateFilterType, setDateFilterType] = useState('billDate');

  // Item/Style filter states
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [itemFilterResults, setItemFilterResults] = useState([]);
  const [showItemFilterResults, setShowItemFilterResults] = useState(false);

  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [lotSearchResults, setLotSearchResults] = useState([]);
  const [showLotDetails, setShowLotDetails] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);

  const SPREADSHEET_ID = process.env.REACT_APP_SPREADSHEET_ID || '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk';
  const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SHEET_NAME = 'Bills';

  useEffect(() => {
    fetchDispatchData();
  }, []);

  const fetchDispatchData = async () => {
    try {
      setLoading(true);
      const range = `${SHEET_NAME}!A:Z`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const dispatches = transformSheetData(data.values);
        setRecentDispatches(dispatches);
      } else {
        setRecentDispatches([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load dispatch data: ' + err.message);
      setRecentDispatches([]);
    } finally {
      setLoading(false);
    }
  };

  const transformSheetData = (sheetValues) => {
    const headers = sheetValues[0];
    const rows = sheetValues.slice(1);

    const billNumberIndex = headers.findIndex(h => h === 'Bill Number');
    const partyNameIndex = headers.findIndex(h => h === 'Party Name');
    const billDateIndex = headers.findIndex(h => h === 'Bill Date');
    const dueDateIndex = headers.findIndex(h => h === 'Due Date');
    const orderReferenceIndex = headers.findIndex(h => h === 'Order Reference');
    const itemsIndex = headers.findIndex(h => h === 'Items');
    const statusIndex = headers.findIndex(h => h === 'Status');
    const createdDateIndex = headers.findIndex(h => h === 'Created Date');
    const billDataJsonIndex = headers.findIndex(h => h === 'Bill Data (JSON)' || h === 'BillData' || h === 'billData');

    return rows.map((row, index) => {
      let billData = {};
      let items = [];
      let parsedItems = [];

      if (billDataJsonIndex !== -1 && row[billDataJsonIndex]) {
        try {
          const jsonStr = row[billDataJsonIndex];
          let parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
          while (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          billData = parsed;
          items = billData.items || [];
          parsedItems = parseItems(items);
        } catch (e) {
          console.error('Error parsing Bill Data JSON:', e);
        }
      }

      if (parsedItems.length === 0 && itemsIndex !== -1 && row[itemsIndex]) {
        try {
          parsedItems = parseItemsFromString(row[itemsIndex]);
        } catch (e) {
          console.error('Error parsing items from string:', e);
        }
      }

      if (parsedItems.length === 0) {
        parsedItems = [{
          barcode: row[billNumberIndex] || 'N/A',
          lotNumber: 'LOT001',
          brand: 'Generic',
          description: 'Product',
          sets: 0,
          setsPerPcs: 1,
          loosePcs: 0,
          quantity: 0,
          colors: [],
          sizes: []
        }];
      }

      const totalQuantity = parsedItems.reduce((sum, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity) || 0);
        return sum + qty;
      }, 0);

      const totalSets = parsedItems.reduce((sum, item) => {
        let sets = item.sets;
        if (typeof sets === 'string' && sets.includes('+')) {
          sets = sets.split('+').reduce((a, b) => a + (parseInt(b) || 0), 0);
        } else {
          sets = parseFloat(sets) || 0;
        }
        return sum + sets;
      }, 0);

      const totalLoosePcs = parsedItems.reduce((sum, item) => {
        const loosePcs = typeof item.loosePcs === 'number' ? item.loosePcs : (parseFloat(item.loosePcs) || 0);
        return sum + loosePcs;
      }, 0);

      let billDate = billData.billDate || row[billDateIndex] || '';
      let formattedBillDate = billDate;
      let dueDate = billData.dueDate || (dueDateIndex !== -1 ? row[dueDateIndex] : '');

      if (billDate) {
        try {
          const dateObj = new Date(billDate);
          if (!isNaN(dateObj.getTime())) {
            formattedBillDate = dateObj.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }

      return {
        id: billData.billNumber || row[billNumberIndex] || `dispatch-${index}`,
        orderNo: billData.billNumber || row[billNumberIndex] || '',
        partyName: billData.partyName || row[partyNameIndex] || '',
        billDate: formattedBillDate,
        billDateRaw: billDate,
        dueDate: dueDate,
        orderReference: billData.orderReference || (orderReferenceIndex !== -1 ? row[orderReferenceIndex] : ''),
        items: parsedItems,
        itemsCount: parsedItems.length,
        totalQuantity: totalQuantity,
        totalSets: totalSets,
        totalLoosePcs: totalLoosePcs,
        notes: billData.notes || '',
        status: billData.status || (statusIndex !== -1 ? row[statusIndex] : 'pending'),
        createdDate: billData.createdDate || (createdDateIndex !== -1 ? row[createdDateIndex] : new Date().toISOString()),
        billData: billData,
        packingMaterials: billData.packingMaterials || { totalBoxes: 0, totalBags: 0, totalPolybags: 0 },
        preparedBy: billData.preparedBy || 'System',
        preparedByRole: billData.preparedByRole || 'User'
      };
    });
  };

  const parseItems = (items) => {
    if (!items || !Array.isArray(items)) return [];

    return items.map(item => ({
      barcode: item.barcode || item.Barcode || 'N/A',
      lotNumber: item.lotNumber || item.LotNumber || item.lot || 'N/A',
      brand: item.brand || item.Brand || 'Generic',
      description: item.description || item.Description || item.productName || 'Product',
      sets: item.sets || 0,
      setsPerPcs: item.setsPerPcs || item.SetsPerPcs || item.setsPerPiece || 1,
      loosePcs: item.loosePcs || item.LoosePcs || 0,
      quantity: item.quantity || item.Quantity || 0,
      colors: Array.isArray(item.colors) ? item.colors : (item.colors ? [item.colors] : []),
      sizes: Array.isArray(item.sizes) ? item.sizes : (item.sizes ? [item.sizes] : [])
    }));
  };

  const parseItemsFromString = (itemsString) => {
    try {
      const parsed = JSON.parse(itemsString);
      if (Array.isArray(parsed)) {
        return parseItems(parsed);
      }
    } catch (e) {
      console.log('Items not in JSON format:', itemsString);
    }
    return [];
  };

  // Search items by name/style
  const searchItemsByName = (searchValue) => {
    if (!searchValue.trim()) {
      setItemFilterResults([]);
      setShowItemFilterResults(false);
      return [];
    }

    const results = [];
    const lowerSearchValue = searchValue.toLowerCase();

    recentDispatches.forEach(dispatch => {
      const matchingItems = dispatch.items.filter(item =>
        item.description?.toLowerCase().includes(lowerSearchValue) ||
        item.brand?.toLowerCase().includes(lowerSearchValue) ||
        item.barcode?.toLowerCase().includes(lowerSearchValue)
      );

      if (matchingItems.length > 0) {
        matchingItems.forEach(item => {
          results.push({
            dispatchId: dispatch.id,
            orderNo: dispatch.orderNo,
            partyName: dispatch.partyName,
            billDate: dispatch.billDate,
            dueDate: dispatch.dueDate,
            status: dispatch.status,
            itemDetails: item,
            dispatchDetails: dispatch
          });
        });
      }
    });

    setItemFilterResults(results);
    setShowItemFilterResults(results.length > 0);
    return results;
  };

  const handleItemSearch = (e) => {
    const value = e.target.value;
    setItemSearchTerm(value);
    if (value.length >= 2) {
      searchItemsByName(value);
    } else if (value.length === 0) {
      setItemFilterResults([]);
      setShowItemFilterResults(false);
    }
  };

  // Export item filter results to Excel
  const exportItemFilterToExcel = () => {
    if (itemFilterResults.length === 0) {
      alert('No data to export. Please search for an item first.');
      return;
    }

    setGeneratingExcel(true);

    try {
      const excelData = itemFilterResults.map((result, index) => ({
        'S.No': index + 1,
        'Bill Number': result.orderNo,
        'Party Name': result.partyName,
        'Bill Date': result.billDate,
        'Due Date': result.dueDate,
        'Status': result.status?.toUpperCase() || 'PENDING',
        'Item Barcode': result.itemDetails.barcode || 'N/A',
        'Lot Number': result.itemDetails.lotNumber || 'N/A',
        'Brand': result.itemDetails.brand || 'N/A',
        'Item Description': result.itemDetails.description || 'N/A',
        'Sets': result.itemDetails.sets || 0,
        'Sets Per Piece': result.itemDetails.setsPerPcs || 1,
        'Loose Pieces': result.itemDetails.loosePcs || 0,
        'Quantity': result.itemDetails.quantity || 0,
        'Colors': Array.isArray(result.itemDetails.colors) ? result.itemDetails.colors.join(', ') : (result.itemDetails.colors || '-'),
        'Sizes': Array.isArray(result.itemDetails.sizes) ? result.itemDetails.sizes.join(', ') : (result.itemDetails.sizes || '-')
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Item Search Results');

      const fileName = `Item_Search_${itemSearchTerm}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      alert(`Excel file generated successfully! Found ${itemFilterResults.length} item(s) matching "${itemSearchTerm}"`);

    } catch (error) {
      console.error("Excel Export Error:", error);
      alert("Failed to generate Excel file: " + error.message);
    } finally {
      setGeneratingExcel(false);
    }
  };

  // Export all filtered dispatches to Excel
  const exportAllToExcel = () => {
    const filteredData = getFilteredDispatches();

    if (filteredData.length === 0) {
      alert('No data available to export.');
      return;
    }

    setGeneratingExcel(true);

    try {
      const excelData = [];

      filteredData.forEach(dispatch => {
        dispatch.items.forEach((item, idx) => {
          excelData.push({
            'Bill Number': dispatch.orderNo,
            'Party Name': dispatch.partyName,
            'Bill Date': dispatch.billDate,
            'Due Date': dispatch.dueDate,
            'Status': dispatch.status?.toUpperCase() || 'PENDING',
            'Item #': idx + 1,
            'Barcode': item.barcode || 'N/A',
            'Lot Number': item.lotNumber || 'N/A',
            'Brand': item.brand || 'N/A',
            'Item Description': item.description || 'N/A',
            'Sets': item.sets || 0,
            'Sets Per Piece': item.setsPerPcs || 1,
            'Loose Pieces': item.loosePcs || 0,
            'Quantity': item.quantity || 0,
            'Colors': Array.isArray(item.colors) ? item.colors.join(', ') : (item.colors || '-'),
            'Sizes': Array.isArray(item.sizes) ? item.sizes.join(', ') : (item.sizes || '-'),
            'Total Bill Quantity': dispatch.totalQuantity,
            'Total Bill Sets': dispatch.totalSets,
            'Total Bill Loose': dispatch.totalLoosePcs
          });
        });
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dispatch Data');

      let fileName = `Dispatch_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      alert(`Excel file generated successfully! Exported ${excelData.length} items from ${filteredData.length} bills.`);

    } catch (error) {
      console.error("Excel Export Error:", error);
      alert("Failed to generate Excel file: " + error.message);
    } finally {
      setGeneratingExcel(false);
    }
  };

  // Generate PDF for Lot Search Results
  const generateLotSearchPDF = (lotNumber, searchResults) => {
    if (!searchResults || searchResults.length === 0) {
      alert('No data available to generate PDF for this lot.');
      return;
    }

    setGeneratingPDF(true);

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 12;
      const rightMargin = 12;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      let yPos = 15;

      doc.setLineWidth(0.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      doc.setLineWidth(0.3);

      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.text("Lot Tracking Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 8;

      doc.setFontSize(12);
      doc.setTextColor(70, 70, 200);
      doc.text(`Lot Number: ${lotNumber}`, pageWidth / 2, yPos, { align: "center" });
      doc.setTextColor(0, 0, 0);
      yPos += 8;

      const totalDispatches = searchResults.length;
      const totalSets = searchResults.reduce((sum, r) => sum + r.totalSets, 0);
      const totalLoosePcs = searchResults.reduce((sum, r) => sum + r.totalLoosePcs, 0);
      const totalQuantity = searchResults.reduce((sum, r) => sum + r.totalQuantity, 0);

      const boxHeight = 30;
      doc.rect(leftMargin, yPos, contentWidth, boxHeight);
      doc.setFillColor(245, 245, 245);
      doc.rect(leftMargin, yPos, contentWidth, 8, 'F');

      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text("SUMMARY", leftMargin + 5, yPos + 6);

      doc.setFontSize(8);
      const summaryY = yPos + 14;
      const colWidth = contentWidth / 3;

      doc.setFont("times", "normal");
      doc.text("Total Dispatches:", leftMargin + 5, summaryY);
      doc.setFont("times", "bold");
      doc.text(totalDispatches.toString(), leftMargin + 40, summaryY);

      doc.setFont("times", "normal");
      doc.text("Total Sets:", leftMargin + colWidth + 5, summaryY);
      doc.setFont("times", "bold");
      doc.text(totalSets.toString(), leftMargin + colWidth + 35, summaryY);

      doc.setFont("times", "normal");
      doc.text("Total Loose Pcs:", leftMargin + (colWidth * 2) + 5, summaryY);
      doc.setFont("times", "bold");
      doc.text(totalLoosePcs.toString(), leftMargin + (colWidth * 2) + 40, summaryY);

      doc.setFont("times", "normal");
      doc.text("Total Quantity:", leftMargin + 5, summaryY + 8);
      doc.setFont("times", "bold");
      doc.text(totalQuantity.toString(), leftMargin + 40, summaryY + 8);

      yPos += boxHeight + 8;

      const tableColumns = [
        { header: "S.No", width: 10 },
        { header: "Bill No.", width: 30 },
        { header: "Party Name", width: 50 },
        { header: "Bill Date", width: 25 },
        { header: "Status", width: 20 },
        { header: "Sets", width: 15 },
        { header: "Loose", width: 15 },
        { header: "Total Qty", width: 20 }
      ];

      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
      doc.rect(leftMargin, yPos, contentWidth, 8);

      let currentX = leftMargin;
      tableColumns.forEach(col => {
        const textWidth = doc.getTextWidth(col.header);
        const textX = currentX + (col.width / 2) - (textWidth / 2);
        doc.text(col.header, textX, yPos + 5.5);
        currentX += col.width;
        if (currentX < pageWidth - rightMargin) {
          doc.line(currentX, yPos, currentX, yPos + 8);
        }
      });

      yPos += 8;

      let itemsProcessed = 0;
      const colWidths = [10, 30, 50, 25, 20, 15, 15, 20];

      while (itemsProcessed < searchResults.length) {
        const result = searchResults[itemsProcessed];
        const rowHeight = 8;

        doc.rect(leftMargin, yPos, contentWidth, rowHeight);

        let colX = leftMargin;
        colWidths.forEach(width => {
          colX += width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + rowHeight);
          }
        });

        const values = [
          (itemsProcessed + 1).toString(),
          (result.orderNo || "").toString(),
          (result.partyName || "").toString().substring(0, 25),
          (result.billDate || "").toString(),
          (result.status || "").toUpperCase(),
          result.totalSets.toString(),
          result.totalLoosePcs.toString(),
          result.totalQuantity.toString()
        ];

        let textX = leftMargin;
        values.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (colWidths[colIndex] / 2) - (textWidth / 2);

          if (colIndex === 4 || colIndex === 7) {
            doc.setFont("times", "bold");
            doc.setFontSize(9);
          } else {
            doc.setFont("times", "normal");
            doc.setFontSize(8);
          }
          doc.text(value, textXPos, yPos + 5.5);

          textX += colWidths[colIndex];
        });

        yPos += rowHeight;
        itemsProcessed++;

        if (yPos > pageHeight - 55 && itemsProcessed < searchResults.length) {
          doc.addPage();
          yPos = 15;

          doc.setLineWidth(0.5);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setLineWidth(0.3);

          doc.setFont("times", "bold");
          doc.setFontSize(18);
          doc.text("Lot Tracking Report", pageWidth / 2, yPos, { align: "center" });
          yPos += 8;

          doc.setFontSize(12);
          doc.setTextColor(70, 70, 200);
          doc.text(`Lot Number: ${lotNumber} (Continued)`, pageWidth / 2, yPos, { align: "center" });
          doc.setTextColor(0, 0, 0);
          yPos += 10;

          doc.setFont("times", "bold");
          doc.setFontSize(9);
          doc.setFillColor(240, 240, 240);
          doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
          doc.rect(leftMargin, yPos, contentWidth, 8);

          currentX = leftMargin;
          tableColumns.forEach(col => {
            const textWidth = doc.getTextWidth(col.header);
            const textX = currentX + (col.width / 2) - (textWidth / 2);
            doc.text(col.header, textX, yPos + 5.5);
            currentX += col.width;
            if (currentX < pageWidth - rightMargin) {
              doc.line(currentX, yPos, currentX, yPos + 8);
            }
          });

          yPos += 8;
        }
      }

      if (searchResults.length > 0) {
        const totalRowHeight = 8;

        doc.setFillColor(245, 245, 245);
        doc.rect(leftMargin, yPos, contentWidth, totalRowHeight, 'F');
        doc.rect(leftMargin, yPos, contentWidth, totalRowHeight);

        let colX = leftMargin;
        colWidths.forEach(width => {
          colX += width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + totalRowHeight);
          }
        });

        const totalValues = [
          "",
          "TOTAL",
          "",
          "",
          "",
          totalSets.toString(),
          totalLoosePcs.toString(),
          totalQuantity.toString()
        ];

        let textX = leftMargin;
        totalValues.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (colWidths[colIndex] / 2) - (textWidth / 2);

          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.text(value, textXPos, yPos + 5.5);

          textX += colWidths[colIndex];
        });

        yPos += totalRowHeight;
      }

      yPos += 3;
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);

      const footerY = pageHeight - 22;
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setLineWidth(0.3);

      const sectionWidth = (contentWidth - 20) / 4;
      let sigX = leftMargin;

      doc.text("Prepared By", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("System", sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Verified By", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Checked By", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Authorized Signatory", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, pageWidth - rightMargin - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        doc.setTextColor(0, 0, 0);
      }

      const fileName = `Lot_Tracking_${lotNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      alert(`Lot tracking PDF generated successfully for ${lotNumber}!`);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF: " + error.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate Individual Packing List PDF
  const generateBillPDF = async (dispatch) => {
    setGeneratingPDF(true);

    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const leftMargin = 12;
      const rightMargin = 12;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      const uniqueLots = new Set(dispatch.items.map(item => item.lotNumber)).size;
      const totalItems = dispatch.items.length;
      const totalQuantity = dispatch.totalQuantity;

      let totalSets = 0;
      let totalLoose = 0;

      dispatch.items.forEach(item => {
        let sets = item.sets;
        if (sets) {
          if (typeof sets === 'string' && sets.includes('+')) {
            sets = sets.split('+').reduce((a, b) => a + (Number(b) || 0), 0);
          } else {
            sets = Number(sets) || 0;
          }
          totalSets += sets;
        }
        totalLoose += Number(item.loosePcs) || 0;
      });

      let yPos = 15;

      doc.setLineWidth(0.5);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      doc.setLineWidth(0.3);

      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.text("Packing List", pageWidth / 2, yPos, { align: "center" });
      yPos += 6.5;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("PACKING LIST FOR ACCOUNT OFFICE", pageWidth / 2, yPos, { align: "center" });
      doc.setTextColor(0, 0, 0);
      yPos += 8;

      const partyName = dispatch.partyName || 'N/A';
      doc.setFont("times", "bold");
      doc.setFontSize(18);

      if (doc.getTextWidth(partyName) > contentWidth) {
        let remainingName = partyName;
        let lines = [];
        while (remainingName.length > 0) {
          let line = "";
          for (let i = 0; i < remainingName.length; i++) {
            const testLine = line + remainingName[i];
            if (doc.getTextWidth(testLine) <= contentWidth) {
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
          yPos += 6;
        }
        yPos += 3;
      } else {
        doc.text(partyName, pageWidth / 2, yPos, { align: "center" });
        yPos += 6;
      }

      const boxHeight = 42;
      doc.rect(leftMargin, yPos, contentWidth, boxHeight);

      const midPoint = leftMargin + (contentWidth / 2);
      doc.line(midPoint, yPos, midPoint, yPos + boxHeight);

      const leftLabelX = leftMargin + 5;
      const leftValueX = leftMargin + 40;

      doc.setFont("times", "bold");
      doc.setFontSize(9);

      doc.text("Date", leftLabelX, yPos + 7);
      doc.text(":", leftLabelX + 18, yPos + 7);
      doc.setFont("times", "normal");
      doc.text(dispatch.billDate || new Date().toLocaleDateString(), leftValueX, yPos + 7);

      doc.setFont("times", "bold");
      doc.text("Order Ref", leftLabelX, yPos + 14);
      doc.text(":", leftLabelX + 18, yPos + 14);
      doc.setFont("times", "normal");
      const orderRef = (dispatch.orderReference || 'N/A').substring(0, 25);
      doc.text(orderRef, leftValueX, yPos + 14);

      doc.setFont("times", "bold");
      doc.text("Doc No", leftLabelX, yPos + 21);
      doc.text(":", leftLabelX + 18, yPos + 21);
      doc.setFont("times", "normal");
      doc.text(dispatch.orderNo || 'N/A', leftValueX, yPos + 21);

      doc.setFont("times", "bold");
      doc.text("Generated By", leftLabelX, yPos + 28);
      doc.text(":", leftLabelX + 18, yPos + 28);
      doc.setFont("times", "normal");
      const preparedByText = `${dispatch.preparedBy || 'System'} (${dispatch.preparedByRole || 'User'})`;
      doc.text(preparedByText.substring(0, 25), leftValueX, yPos + 28);

      doc.setFont("times", "bold");
      doc.text("Packing Materials", leftLabelX, yPos + 35);
      doc.text(":", leftLabelX + 18, yPos + 35);
      doc.setFont("times", "normal");
      const packingMaterials = dispatch.packingMaterials || { totalBoxes: 0, totalBags: 0, totalPolybags: 0 };
      const materialParts = [];
      if (packingMaterials.totalBoxes > 0) materialParts.push(`${packingMaterials.totalBoxes} Boxes`);
      if (packingMaterials.totalBags > 0) materialParts.push(`${packingMaterials.totalBags} Bags`);
      if (packingMaterials.totalPolybags > 0) materialParts.push(`${packingMaterials.totalPolybags} Polybags`);
      const materialsText = materialParts.length > 0 ? materialParts.join(', ') : 'None';
      doc.text(materialsText.substring(0, 30), leftValueX, yPos + 35);

      const rightLabelX = midPoint + 5;
      const rightValueX = midPoint + 38;

      doc.setFont("times", "bold");
      doc.setFontSize(9);

      doc.text("Total Lots", rightLabelX, yPos + 7);
      doc.text(":", rightLabelX + 18, yPos + 7);
      doc.setFont("times", "normal");
      doc.text(uniqueLots.toString(), rightValueX, yPos + 7);

      doc.setFont("times", "bold");
      doc.text("Total Items", rightLabelX, yPos + 14);
      doc.text(":", rightLabelX + 18, yPos + 14);
      doc.setFont("times", "normal");
      doc.text(totalItems.toString(), rightValueX, yPos + 14);

      doc.setFont("times", "bold");
      doc.text("Total Qty", rightLabelX, yPos + 21);
      doc.text(":", rightLabelX + 18, yPos + 21);
      doc.setFont("times", "normal");
      doc.text(`${totalQuantity} PCS`, rightValueX, yPos + 21);

      doc.setFont("times", "bold");
      doc.text("Total Sets", rightLabelX, yPos + 28);
      doc.text(":", rightLabelX + 18, yPos + 28);
      doc.setFont("times", "normal");
      doc.text(totalSets.toString(), rightValueX, yPos + 28);

      doc.setFont("times", "bold");
      doc.text("Document Type", rightLabelX, yPos + 35);
      doc.text(":", rightLabelX + 18, yPos + 35);
      doc.setFont("times", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(dispatch.status === 'completed' ? "COMPLETED" : (dispatch.status?.toUpperCase() || "PENDING"), rightValueX, yPos + 35);
      doc.setTextColor(0, 0, 0);

      yPos += boxHeight + 6;

      const tableColumns = [
        { header: "S.No", width: 10 },
        { header: "Lot Number", width: 22 },
        { header: "Brand", width: 26 },
        { header: "Description", width: 55 },
        { header: "Sets", width: 15 },
        { header: "Pc/Set", width: 15 },
        { header: "OP", width: 10 },
        { header: "Loose", width: 15 },
        { header: "Total", width: 20 }
      ];

      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
      doc.rect(leftMargin, yPos, contentWidth, 8);

      let currentX = leftMargin;
      tableColumns.forEach(col => {
        const textWidth = doc.getTextWidth(col.header);
        const textX = currentX + (col.width / 2) - (textWidth / 2);
        doc.text(col.header, textX, yPos + 5.5);
        currentX += col.width;
        if (currentX < pageWidth - rightMargin) {
          doc.line(currentX, yPos, currentX, yPos + 8);
        }
      });

      yPos += 8;

      let itemsProcessed = 0;
      while (itemsProcessed < dispatch.items.length) {
        const item = dispatch.items[itemsProcessed];
        const rowHeight = 8;

        doc.rect(leftMargin, yPos, contentWidth, rowHeight);

        let colX = leftMargin;
        const colWidths = [10, 22, 26, 55, 15, 15, 10, 15, 20];
        colWidths.forEach(width => {
          colX += width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + rowHeight);
          }
        });

        let displaySets = item.sets || 0;
        if (typeof displaySets === 'string' && displaySets.includes('+')) {
          const sum = displaySets.split('+').reduce((a, b) => a + (Number(b) || 0), 0);
          displaySets = `${displaySets}=${sum}`;
        }

        let opSymbol = "";
        const loosePcsValue = Number(item.loosePcs) || 0;
        const operation = item.looseOperation || "add";

        if (loosePcsValue > 0) {
          opSymbol = operation === "subtract" ? "-" : "+";
        } else {
          opSymbol = "";
        }

        const values = [
          (itemsProcessed + 1).toString(),
          (item.lotNumber || "").toString(),
          (item.brand || "").toString().substring(0, 15),
          (item.description || "").toString().substring(0, 30),
          displaySets.toString(),
          (item.setsPerPcs || 0).toString(),
          opSymbol,
          (item.loosePcs || 0).toString(),
          (item.quantity || 0).toString()
        ];

        const boldColumns = [1, 5, 8];

        let textX = leftMargin;
        values.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (colWidths[colIndex] / 2) - (textWidth / 2);

          if (boldColumns.includes(colIndex)) {
            doc.setFont("times", "bold");
            doc.setFontSize(10);
          } else {
            doc.setFont("times", "normal");
            doc.setFontSize(9);
          }
          doc.text(value, textXPos, yPos + 5.5);

          textX += colWidths[colIndex];
        });

        yPos += rowHeight;
        itemsProcessed++;

        if (yPos > pageHeight - 55 && itemsProcessed < dispatch.items.length) {
          doc.addPage();
          yPos = 15;

          doc.setLineWidth(0.5);
          doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
          doc.setLineWidth(0.3);

          doc.setFont("times", "bold");
          doc.setFontSize(22);
          doc.text("Packing List", pageWidth / 2, yPos, { align: "center" });
          yPos += 10;

          doc.setFontSize(14);
          doc.setTextColor(0, 0, 0);
          doc.text("PACKING LIST FOR ACCOUNT OFFICE", pageWidth / 2, yPos, { align: "center" });
          doc.setTextColor(0, 0, 0);
          yPos += 8;

          doc.setFont("times", "bold");
          doc.setFontSize(13);
          doc.text(partyName, pageWidth / 2, yPos, { align: "center" });
          yPos += 6;

          doc.rect(leftMargin, yPos, contentWidth, boxHeight);
          doc.line(midPoint, yPos, midPoint, yPos + boxHeight);
          yPos += boxHeight + 6;

          doc.setFont("times", "bold");
          doc.setFontSize(9);
          doc.setFillColor(240, 240, 240);
          doc.rect(leftMargin, yPos, contentWidth, 8, 'F');
          doc.rect(leftMargin, yPos, contentWidth, 8);

          currentX = leftMargin;
          tableColumns.forEach(col => {
            const textWidth = doc.getTextWidth(col.header);
            const textX = currentX + (col.width / 2) - (textWidth / 2);
            doc.text(col.header, textX, yPos + 5.5);
            currentX += col.width;
            if (currentX < pageWidth - rightMargin) {
              doc.line(currentX, yPos, currentX, yPos + 8);
            }
          });

          yPos += 8;
        }
      }

      if (dispatch.items.length > 0) {
        const totalRowHeight = 8;

        doc.setFillColor(245, 245, 245);
        doc.rect(leftMargin, yPos, contentWidth, totalRowHeight, 'F');
        doc.rect(leftMargin, yPos, contentWidth, totalRowHeight);

        let colX = leftMargin;
        const colWidths = [10, 22, 26, 55, 15, 15, 10, 15, 20];
        colWidths.forEach(width => {
          colX += width;
          if (colX < pageWidth - rightMargin) {
            doc.line(colX, yPos, colX, yPos + totalRowHeight);
          }
        });

        const totalValues = [
          "",
          "TOTAL",
          "",
          "",
          totalSets.toString(),
          "",
          "",
          totalLoose.toString(),
          totalQuantity.toString()
        ];

        let textX = leftMargin;
        totalValues.forEach((value, colIndex) => {
          const textWidth = doc.getTextWidth(value);
          const textXPos = textX + (colWidths[colIndex] / 2) - (textWidth / 2);

          doc.setFont("times", "bold");
          doc.setFontSize(10);
          doc.text(value, textXPos, yPos + 5.5);

          textX += colWidths[colIndex];
        });

        yPos += totalRowHeight;
      }

      yPos += 3;
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPos, leftMargin + contentWidth, yPos);

      const footerY = pageHeight - 22;
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setLineWidth(0.3);

      const sectionWidth = (contentWidth - 20) / 4;
      let sigX = leftMargin;

      doc.text("Prepared By", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      const preparedText = `${dispatch.preparedBy || 'System'} (${dispatch.preparedByRole || 'User'})`;
      doc.text(preparedText.substring(0, 18), sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Account Officer", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Checked By", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, sigX + sectionWidth - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      sigX += sectionWidth;
      doc.setFontSize(9);
      doc.text("Authorized Signatory", sigX + 5, footerY);
      doc.line(sigX + 5, footerY + 3, pageWidth - rightMargin - 5, footerY + 3);
      doc.setFontSize(8);
      doc.text("(Name & Signature)", sigX + 5, footerY + 8);

      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
        doc.setTextColor(0, 0, 0);
      }

      const safePartyName = (dispatch.partyName || 'Unknown')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);

      const fileName = `PackingList_${dispatch.orderNo}_${safePartyName}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      alert(`PDF generated successfully for ${dispatch.orderNo}!`);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate PDF: " + error.message);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Generate Sales Register PDF (Tally format)
  const generateSalesRegisterPDF = () => {
    const filteredData = getFilteredDispatches();

    if (filteredData.length === 0) {
      alert('No data available for the selected date range to generate PDF.');
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Estimate Mh', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text('State Name : , Code :', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('Sales Register', pageWidth / 2, 28, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let dateText = startDate
      ? `For ${new Date(startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`
      : 'All Time';
    doc.text(dateText, pageWidth / 2, 34, { align: 'center' });

    const tableData = filteredData.map((dispatch) => {
      let particulars = dispatch.partyName;
      if (dispatch.orderReference && dispatch.orderReference !== '-') {
        particulars += ` ( ${dispatch.orderReference} )`;
      }

      return [
        dispatch.billDate || '-',
        particulars.toUpperCase(),
        'Sales',
        dispatch.orderNo,
        `${dispatch.totalQuantity} Pcs`,
        dispatch.itemsCount
      ];
    });

    const totalQty = filteredData.reduce((sum, d) => sum + d.totalQuantity, 0);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Particulars', 'Voucher Type', 'Bill No.', 'Quantity', 'No. of Items']],
      body: tableData,
      foot: [['Grand Total', '', '', '', `${totalQty} Pcs`, '']],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left',
        lineWidth: 0.1,
      },
      footStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' }
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      margin: { left: 10, right: 10, bottom: 20 },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        const str = 'Page ' + doc.internal.getCurrentPageInfo().pageNumber;
        doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
    });

    doc.save(`Sales_Register_${startDate || 'All'}_to_${endDate || 'All'}.pdf`);
  };

  const searchLotNumber = (lotNumber) => {
    if (!lotNumber.trim()) {
      setLotSearchResults([]);
      setShowLotDetails(false);
      return;
    }

    const results = [];
    const lowerLotNumber = lotNumber.toLowerCase();

    recentDispatches.forEach(dispatch => {
      const matchingItems = dispatch.items.filter(item =>
        item.lotNumber?.toLowerCase().includes(lowerLotNumber)
      );

      if (matchingItems.length > 0) {
        const totalSetsForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.sets) || 0), 0);
        const totalLoosePcsForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.loosePcs) || 0), 0);
        const totalQuantityForLot = matchingItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        results.push({
          dispatchId: dispatch.id,
          orderNo: dispatch.orderNo,
          partyName: dispatch.partyName,
          status: dispatch.status,
          billDate: dispatch.billDate,
          items: matchingItems,
          totalSets: totalSetsForLot,
          totalLoosePcs: totalLoosePcsForLot,
          totalQuantity: totalQuantityForLot,
          lotNumber: lotNumber
        });
      }
    });

    setLotSearchResults(results);
    setShowLotDetails(results.length > 0);

    if (results.length > 0 && results[0].items.length > 0) {
      setSelectedLot(results[0].items[0].lotNumber);
    }
  };

  const handleLotSearch = (e) => {
    const value = e.target.value;
    setLotSearchTerm(value);
    if (value.length >= 2) {
      searchLotNumber(value);
    } else if (value.length === 0) {
      setLotSearchResults([]);
      setShowLotDetails(false);
    }
  };

  const handleUpdateDispatchStatus = async (dispatchId, newStatus) => {
    try {
      setRecentDispatches(prevDispatches =>
        prevDispatches.map(d =>
          d.id === dispatchId ? { ...d, status: newStatus } : d
        )
      );

      if (updateDispatchStatus) {
        updateDispatchStatus(dispatchId, newStatus);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      fetchDispatchData();
    }
  };

  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return { color: '#059669', bg: '#d1fae5', icon: '✓', label: 'Completed' };
      case 'active':
        return { color: '#2563eb', bg: '#dbeafe', icon: '🚚', label: 'Active' };
      case 'pending':
        return { color: '#d97706', bg: '#fef3c7', icon: '⏰', label: 'Pending' };
      default:
        return { color: '#6b7280', bg: '#f3f4f6', icon: '📋', label: status || 'Unknown' };
    }
  };

  const getFilteredDispatches = () => {
    return recentDispatches.filter(dispatch => {
      const matchesSearch = dispatch.orderNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.partyName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || dispatch.status?.toLowerCase() === statusFilter;

      let matchesDateRange = true;
      if (startDate || endDate) {
        const dateToCompare = dateFilterType === 'billDate' ? dispatch.billDate : dispatch.dueDate;
        if (dateToCompare) {
          const compareDate = new Date(dateToCompare);
          if (startDate) {
            const start = new Date(startDate);
            if (compareDate < start) matchesDateRange = false;
          }
          if (endDate && matchesDateRange) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59);
            if (compareDate > end) matchesDateRange = false;
          }
        } else {
          matchesDateRange = false;
        }
      }

      return matchesSearch && matchesStatus && matchesDateRange;
    });
  };

  const filteredDispatches = getFilteredDispatches();

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setDateFilterType('billDate');
    setItemSearchTerm('');
    setItemFilterResults([]);
    setShowItemFilterResults(false);
  };

  const stats = {
    total: recentDispatches.length,
    pending: recentDispatches.filter(d => d.status?.toLowerCase() === 'pending').length,
    active: recentDispatches.filter(d => d.status?.toLowerCase() === 'active').length,
    completed: recentDispatches.filter(d => d.status?.toLowerCase() === 'completed').length,
    totalItems: recentDispatches.reduce((sum, d) => sum + (parseInt(d.itemsCount) || 0), 0),
    totalQuantity: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalQuantity) || 0), 0),
    totalSets: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalSets) || 0), 0),
    totalLoosePcs: recentDispatches.reduce((sum, d) => sum + (parseFloat(d.totalLoosePcs) || 0), 0),
  };

  if (loading) {
    return (
      <div className="dispatch-modern-container">
        <div className="dispatch-modern-loading">
          <div className="dispatch-modern-loading-animation">
            <div className="dispatch-modern-loading-truck">🚚</div>
          </div>
          <p className="dispatch-modern-loading-text">Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispatch-modern-container">
        <div className="dispatch-modern-error">
          <div className="dispatch-modern-error-icon">⚠️</div>
          <h3>Oops! Something went wrong</h3>
          <p>{error}</p>
          <button onClick={fetchDispatchData} className="dispatch-modern-btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatch-modern-container">
      <div className="dispatch-modern-wrapper">
        {/* Header Section */}
        {/* Header Section */}
        <div className="dispatch-modern-header">
          <div className="dispatch-modern-header-left">
            <button
              onClick={() => window.history.back()}
              className="dispatch-modern-back-btn"
              title="Go Back"
            >
              <span className="dispatch-modern-back-icon">←</span>
              <span>Back</span>
            </button>
            <div className="dispatch-modern-title-section">
              <div className="dispatch-modern-title-icon">📦</div>
              <div>
                <h1 className="dispatch-modern-title">Dispatch Management</h1>
                <p className="dispatch-modern-subtitle">Track and manage all your dispatches in one place</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="dispatch-modern-stats-grid">
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-blue">
              <span>📄</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.total}</span>
              <span className="dispatch-modern-stat-label">Total Bills</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-orange">
              <span>⏰</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.pending}</span>
              <span className="dispatch-modern-stat-label">Pending</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-blue-light">
              <span>🚚</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.active}</span>
              <span className="dispatch-modern-stat-label">Active</span>
            </div>
          </div>
          <div className="dispatch-modern-stat-card">
            <div className="dispatch-modern-stat-icon dispatch-modern-stat-icon-green">
              <span>✓</span>
            </div>
            <div className="dispatch-modern-stat-info">
              <span className="dispatch-modern-stat-value">{stats.completed}</span>
              <span className="dispatch-modern-stat-label">Completed</span>
            </div>
          </div>
        </div>

        {/* Enhanced Metrics */}
        <div className="dispatch-modern-metrics">
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">📊</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalItems}</div>
              <div className="dispatch-modern-metric-label">Total Items</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">📦</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalQuantity}</div>
              <div className="dispatch-modern-metric-label">Total Quantity</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">🔢</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalSets}</div>
              <div className="dispatch-modern-metric-label">Total Sets</div>
            </div>
          </div>
          <div className="dispatch-modern-metric-item">
            <span className="dispatch-modern-metric-icon">🔧</span>
            <div>
              <div className="dispatch-modern-metric-value">{stats.totalLoosePcs}</div>
              <div className="dispatch-modern-metric-label">Loose Pieces</div>
            </div>
          </div>
        </div>

        {/* Date Range Filter Section */}
        <div className="dispatch-modern-filter-section">
          <div className="dispatch-modern-filter-header">
            <span className="dispatch-modern-filter-header-icon">📅</span>
            <h3>Date Range Filter</h3>
            <span className="dispatch-modern-filter-badge">Filter bills by date</span>
          </div>

          <div className="dispatch-modern-date-range-container">
            <div className="dispatch-modern-date-range-controls">
              <div className="dispatch-modern-date-input-group">
                <label>Filter By:</label>
                <select
                  value={dateFilterType}
                  onChange={(e) => setDateFilterType(e.target.value)}
                  className="dispatch-modern-filter-select"
                >
                  <option value="billDate">Bill Date</option>
                  <option value="dueDate">Due Date</option>
                </select>
              </div>

              <div className="dispatch-modern-date-input-group">
                <label>From Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="dispatch-modern-date-input"
                />
              </div>

              <div className="dispatch-modern-date-input-group">
                <label>To Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="dispatch-modern-date-input"
                />
              </div>

              <div className="dispatch-modern-date-actions">
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="dispatch-modern-clear-date-btn"
                >
                  Clear Dates
                </button>
              </div>
            </div>

            {/* PDF Download Buttons - Sales Register */}
            {(startDate || endDate) && filteredDispatches.length > 0 && (
              <div className="dispatch-modern-pdf-actions">
                <button
                  onClick={generateSalesRegisterPDF}
                  className="dispatch-modern-pdf-btn dispatch-modern-pdf-register"
                >
                  <span>📊</span>
                  Download Sales Register
                </button>
                <button
                  onClick={exportAllToExcel}
                  disabled={generatingExcel}
                  className="dispatch-modern-excel-btn"
                  style={{
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📊</span>
                  {generatingExcel ? 'Exporting...' : 'Export to Excel'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Item/Style Name Search Section */}
        <div className="dispatch-modern-item-search-section">
          <div className="dispatch-modern-section-header">
            <div className="dispatch-modern-section-title">
              <span>🏷️</span>
              <h3>Item Name / Style Search</h3>
            </div>
            <p className="dispatch-modern-section-desc">Search for specific items across all dispatches (e.g., tracksuit, shirt, jeans, etc.)</p>
          </div>

          <div className="dispatch-modern-item-search-container">
            <div className="dispatch-modern-search-wrapper">
              <span className="dispatch-modern-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Enter item name, style, or description (e.g., tracksuit, cotton shirt, denim)..."
                value={itemSearchTerm}
                onChange={handleItemSearch}
                className="dispatch-modern-item-input"
              />
              {itemSearchTerm && (
                <button className="dispatch-modern-clear-btn" onClick={() => {
                  setItemSearchTerm('');
                  setItemFilterResults([]);
                  setShowItemFilterResults(false);
                }}>
                  ✕
                </button>
              )}
            </div>

            {itemSearchTerm && showItemFilterResults && (
              <div className="dispatch-modern-item-results-header">
                <div className="dispatch-modern-item-summary">
                  <span className="dispatch-modern-found-count">
                    📋 Found {itemFilterResults.length} item(s) matching "{itemSearchTerm}"
                  </span>
                  <button
                    onClick={exportItemFilterToExcel}
                    disabled={generatingExcel}
                    className="dispatch-modern-excel-export-btn"
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>📊</span>
                    {generatingExcel ? 'Exporting...' : 'Export to Excel'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Item Search Results Display */}
          {showItemFilterResults && itemFilterResults.length > 0 && (
            <div className="dispatch-modern-item-results">
              <div className="dispatch-modern-item-cards">
                {itemFilterResults.map((result, idx) => (
                  <div key={idx} className="dispatch-modern-item-card">
                    <div className="dispatch-modern-item-card-header">
                      <div className="dispatch-modern-item-card-info">
                        <span className="dispatch-modern-bill-no">🧾 Bill: {result.orderNo}</span>
                        <span className="dispatch-modern-party-name">👤 Party: {result.partyName}</span>
                        <span className="dispatch-modern-date">📅 Date: {result.billDate}</span>
                      </div>
                      <span className={`dispatch-modern-status-badge dispatch-modern-status-${result.status}`}>
                        {result.status === 'pending' && '⏰'}
                        {result.status === 'active' && '🚚'}
                        {result.status === 'completed' && '✓'}
                        {result.status}
                      </span>
                    </div>

                    <div className="dispatch-modern-item-details">
                      <div className="dispatch-modern-item-property">
                        <label>Item Description:</label>
                        <strong>{result.itemDetails.description}</strong>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Lot Number:</label>
                        <span>{result.itemDetails.lotNumber}</span>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Brand:</label>
                        <span>{result.itemDetails.brand}</span>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Barcode:</label>
                        <code>{result.itemDetails.barcode}</code>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Quantity:</label>
                        <span className="dispatch-modern-quantity">{result.itemDetails.quantity} pcs</span>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Sets:</label>
                        <span>{result.itemDetails.sets}</span>
                      </div>
                      <div className="dispatch-modern-item-property">
                        <label>Loose Pcs:</label>
                        <span>{result.itemDetails.loosePcs}</span>
                      </div>
                      {result.itemDetails.colors && result.itemDetails.colors.length > 0 && (
                        <div className="dispatch-modern-item-property">
                          <label>Colors:</label>
                          <div className="dispatch-modern-tags">
                            {result.itemDetails.colors.map((color, i) => (
                              <span key={i} className="dispatch-modern-color-tag">{color}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.itemDetails.sizes && result.itemDetails.sizes.length > 0 && (
                        <div className="dispatch-modern-item-property">
                          <label>Sizes:</label>
                          <div className="dispatch-modern-tags">
                            {result.itemDetails.sizes.map((size, i) => (
                              <span key={i} className="dispatch-modern-size-tag">{size}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="dispatch-modern-item-actions">
                      <button
                        onClick={() => {
                          const dispatch = recentDispatches.find(d => d.id === result.dispatchId);
                          if (dispatch) generateBillPDF(dispatch);
                        }}
                        disabled={generatingPDF}
                        className="dispatch-modern-pdf-small-btn"
                        style={{
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>📄</span>
                        Generate Packing List
                      </button>
                      <button
                        onClick={() => setExpandedBill(result.dispatchId)}
                        className="dispatch-modern-view-details-btn"
                        style={{
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        View Full Bill
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showItemFilterResults && itemFilterResults.length === 0 && itemSearchTerm && (
            <div className="dispatch-modern-no-results">
              <span>🔍</span>
              <p>No items found matching "<strong>{itemSearchTerm}</strong>"</p>
              <p className="dispatch-modern-no-results-hint">Try searching with different keywords like brand name, product type, or description</p>
            </div>
          )}
        </div>

        {/* Lot Number Tracking Section */}
        <div className="dispatch-modern-lot-section">
          <div className="dispatch-modern-section-header">
            <div className="dispatch-modern-section-title">
              <span>🏷️</span>
              <h3>Lot Number Tracking</h3>
            </div>
            <p className="dispatch-modern-section-desc">Search and track lots across all dispatches</p>
          </div>

          <div className="dispatch-modern-search-wrapper">
            <span className="dispatch-modern-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Enter lot number to track across all dispatches..."
              value={lotSearchTerm}
              onChange={handleLotSearch}
              className="dispatch-modern-lot-input"
            />
            {lotSearchTerm && (
              <button className="dispatch-modern-clear-btn" onClick={() => {
                setLotSearchTerm('');
                setLotSearchResults([]);
                setShowLotDetails(false);
              }}>
                ✕
              </button>
            )}
          </div>

          {showLotDetails && (
            <div className="dispatch-modern-lot-results">
              {lotSearchResults.length > 0 ? (
                <>
                  <div className="dispatch-modern-lot-summary">
                    <div className="dispatch-modern-summary-header">
                      <span className="dispatch-modern-found-count">📋 {lotSearchResults.length} Dispatch(es) Found</span>
                      <span className="dispatch-modern-lot-highlight">Lot: {lotSearchTerm}</span>
                      <button
                        onClick={() => generateLotSearchPDF(lotSearchTerm, lotSearchResults)}
                        disabled={generatingPDF}
                        className="dispatch-modern-pdf-download-btn"
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginLeft: 'auto'
                        }}
                      >
                        <span>📄</span>
                        {generatingPDF ? 'Generating...' : 'Download PDF Report'}
                      </button>
                    </div>
                    <div className="dispatch-modern-lot-totals">
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Sets</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalSets, 0)}</strong>
                      </div>
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Loose Pcs</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalLoosePcs, 0)}</strong>
                      </div>
                      <div className="dispatch-modern-lot-total">
                        <span className="dispatch-modern-total-label">Total Quantity</span>
                        <strong>{lotSearchResults.reduce((sum, r) => sum + r.totalQuantity, 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {lotSearchResults.map((result, idx) => (
                    <div key={idx} className="dispatch-modern-lot-card">
                      <div className="dispatch-modern-lot-card-header">
                        <div className="dispatch-modern-lot-card-info">
                          <span className="dispatch-modern-bill-no">🧾 {result.orderNo}</span>
                          <span className="dispatch-modern-party-name">👤 {result.partyName}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={`dispatch-modern-status-badge dispatch-modern-status-${result.status}`}>
                            {result.status === 'pending' && '⏰'}
                            {result.status === 'active' && '🚚'}
                            {result.status === 'completed' && '✓'}
                            {result.status}
                          </span>
                          <button
                            onClick={() => generateBillPDF(recentDispatches.find(d => d.id === result.dispatchId))}
                            disabled={generatingPDF}
                            style={{
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>📄</span>
                            {generatingPDF ? '...' : 'PDF'}
                          </button>
                        </div>
                      </div>

                      <div className="dispatch-modern-lot-table-wrapper">
                        <table className="dispatch-modern-lot-table">
                          <thead>
                            <tr>
                              <th>Barcode</th>
                              <th>Lot Number</th>
                              <th>Brand</th>
                              <th>Description</th>
                              <th>Sets</th>
                              <th>Loose Pcs</th>
                              <th>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.items.map((item, itemIdx) => (
                              <tr key={itemIdx}>
                                <td><code>{item.barcode}</code></td>
                                <td><strong>{item.lotNumber}</strong></td>
                                <td>{item.brand}</td>
                                <td>{item.description}</td>
                                <td>{parseFloat(item.sets) || 0}</td>
                                <td>{parseFloat(item.loosePcs) || 0}</td>
                                <td className="dispatch-modern-quantity-cell">{parseFloat(item.quantity) || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="4" className="dispatch-modern-total-label">Totals:</td>
                              <td className="dispatch-modern-total-value">{result.totalSets}</td>
                              <td className="dispatch-modern-total-value">{result.totalLoosePcs}</td>
                              <td className="dispatch-modern-total-value">{result.totalQuantity}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="dispatch-modern-no-results">
                  <span>🔍</span>
                  <p>No dispatches found with lot number: <strong>{lotSearchTerm}</strong></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div className="dispatch-modern-filters">
          <div className="dispatch-modern-search-filter">
            <span className="dispatch-modern-filter-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by bill number or party name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dispatch-modern-filter-input"
            />
          </div>

          <div className="dispatch-modern-status-filters">
            {['all', 'pending', 'active', 'completed'].map(status => {
              const icon = status === 'all' ? '📊' :
                status === 'pending' ? '⏰' :
                  status === 'active' ? '🚚' : '✓';
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`dispatch-modern-status-btn ${statusFilter === status ? 'dispatch-modern-status-active' : ''}`}
                >
                  <span>{icon}</span>
                  <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  {status !== 'all' && (
                    <span className="dispatch-modern-filter-count">
                      {stats[status === 'pending' ? 'pending' : status === 'active' ? 'active' : 'completed']}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Export All Button */}
          <button
            onClick={exportAllToExcel}
            disabled={generatingExcel}
            className="dispatch-modern-export-all-btn"
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: 'auto'
            }}
          >
            <span>📊</span>
            {generatingExcel ? 'Exporting...' : 'Export All to Excel'}
          </button>
        </div>

        {/* Active Filters Display */}
        {(startDate || endDate || searchTerm || statusFilter !== 'all' || itemSearchTerm) && (
          <div className="dispatch-modern-active-filters">
            <span className="dispatch-modern-active-filters-label">Active Filters:</span>
            {(startDate || endDate) && (
              <span className="dispatch-modern-filter-tag">
                📅 {dateFilterType === 'billDate' ? 'Bill Date' : 'Due Date'}:
                {startDate && ` ${new Date(startDate).toLocaleDateString()}`}
                {endDate && ` - ${new Date(endDate).toLocaleDateString()}`}
                <button onClick={() => { setStartDate(''); setEndDate(''); }} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            {searchTerm && (
              <span className="dispatch-modern-filter-tag">
                🔍 Search: {searchTerm}
                <button onClick={() => setSearchTerm('')} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="dispatch-modern-filter-tag">
                {statusFilter === 'pending' ? '⏰' : statusFilter === 'active' ? '🚚' : '✓'} Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            {itemSearchTerm && (
              <span className="dispatch-modern-filter-tag">
                🏷️ Item Search: {itemSearchTerm}
                <button onClick={() => {
                  setItemSearchTerm('');
                  setItemFilterResults([]);
                  setShowItemFilterResults(false);
                }} className="dispatch-modern-remove-filter">×</button>
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="dispatch-modern-clear-all-filters"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Filter Result Info */}
        <div className="dispatch-modern-filter-info">
          <span>Showing {filteredDispatches.length} of {recentDispatches.length} bills</span>
          {(startDate || endDate) && (
            <span className="dispatch-modern-date-badge">
              📅 {startDate && new Date(startDate).toLocaleDateString()}
              {endDate && ` - ${new Date(endDate).toLocaleDateString()}`}
            </span>
          )}
        </div>

        {/* Dispatches Table */}
        <div className="dispatch-modern-table-container">
          <table className="dispatch-modern-table">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Party Name</th>
                <th>Bill Date</th>
                <th>Due Date</th>
                <th>Items</th>
                <th>Total Qty</th>
                <th>Sets</th>
                <th>Loose Pcs</th>
                <th>Status</th>
                <th>Actions</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.length > 0 ? (
                filteredDispatches.map(dispatch => {
                  const statusConfig = getStatusConfig(dispatch.status);
                  const isExpanded = expandedBill === dispatch.id;

                  return (
                    <React.Fragment key={dispatch.id}>
                      <tr className={`dispatch-modern-row ${isExpanded ? 'dispatch-modern-row-expanded' : ''}`}>
                        <td>
                          <span className="dispatch-modern-bill-number">{dispatch.orderNo}</span>
                          {dispatch.orderReference && (
                            <span className="dispatch-modern-ref-badge">{dispatch.orderReference}</span>
                          )}
                        </td>
                        <td>
                          <div className="dispatch-modern-party-cell">
                            <span>👤</span>
                            <span>{dispatch.partyName}</span>
                          </div>
                        </td>
                        <td className="dispatch-modern-date-cell">{dispatch.billDate || '-'}</td>
                        <td className="dispatch-modern-date-cell">{dispatch.dueDate || '-'}</td>
                        <td className="dispatch-modern-center">{dispatch.itemsCount}</td>
                        <td className="dispatch-modern-center dispatch-modern-highlight">{dispatch.totalQuantity}</td>
                        <td className="dispatch-modern-center">{dispatch.totalSets}</td>
                        <td className="dispatch-modern-center">{dispatch.totalLoosePcs}</td>
                        <td>
                          <span className="dispatch-modern-status-badge" style={{ background: statusConfig.bg, color: statusConfig.color }}>
                            <span>{statusConfig.icon}</span>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td>
                          <div className="dispatch-modern-actions">
                            <button
                              className="dispatch-modern-pdf-generate-btn"
                              onClick={() => generateBillPDF(dispatch)}
                              disabled={generatingPDF}
                              title="Generate Packing List PDF"
                              style={{
                                background: '#2563eb',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                            >
                              <span>📄</span>
                              {generatingPDF ? 'Generating...' : 'Generate PDF'}
                            </button>
                          </div>
                        </td>
                        <td>
                          <button
                            className="dispatch-modern-expand-btn"
                            onClick={() => setExpandedBill(isExpanded ? null : dispatch.id)}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="dispatch-modern-details-row">
                          <td colSpan="11">
                            <div className="dispatch-modern-details-content">
                              <div className="dispatch-modern-details-header">
                                <h4>📋 Bill Details</h4>
                                <button
                                  className="dispatch-modern-details-action"
                                  onClick={() => generateBillPDF(dispatch)}
                                  disabled={generatingPDF}
                                  style={{
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  <span>📄</span>
                                  Generate Packing List
                                </button>
                              </div>

                              <div className="dispatch-modern-details-grid">
                                <div className="dispatch-modern-detail-item">
                                  <label>Bill Number</label>
                                  <span>{dispatch.orderNo}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Party Name</label>
                                  <span>{dispatch.partyName}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Bill Date</label>
                                  <span>{dispatch.billDate || 'Not specified'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Due Date</label>
                                  <span>{dispatch.dueDate || 'Not specified'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Order Reference</label>
                                  <span>{dispatch.orderReference || 'N/A'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Status</label>
                                  <span className={`dispatch-modern-status-text dispatch-modern-status-${dispatch.status}`}>
                                    {dispatch.status?.toUpperCase()}
                                  </span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Prepared By</label>
                                  <span>{dispatch.preparedBy || 'System'}</span>
                                </div>
                                <div className="dispatch-modern-detail-item">
                                  <label>Packing Materials</label>
                                  <span>
                                    {dispatch.packingMaterials?.totalBoxes > 0 && `${dispatch.packingMaterials.totalBoxes} Boxes `}
                                    {dispatch.packingMaterials?.totalBags > 0 && `${dispatch.packingMaterials.totalBags} Bags `}
                                    {dispatch.packingMaterials?.totalPolybags > 0 && `${dispatch.packingMaterials.totalPolybags} Polybags`}
                                    {(!dispatch.packingMaterials?.totalBoxes && !dispatch.packingMaterials?.totalBags && !dispatch.packingMaterials?.totalPolybags) && 'None'}
                                  </span>
                                </div>
                              </div>

                              <h5 className="dispatch-modern-items-title">📦 Items List ({dispatch.itemsCount} items)</h5>
                              <div className="dispatch-modern-items-table-wrapper">
                                <table className="dispatch-modern-items-table">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Barcode</th>
                                      <th>Lot Number</th>
                                      <th>Brand</th>
                                      <th>Description</th>
                                      <th>Sets</th>
                                      <th>Sets/Pcs</th>
                                      <th>Loose Pcs</th>
                                      <th>Quantity</th>
                                      <th>Colors</th>
                                      <th>Sizes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {dispatch.items && dispatch.items.length > 0 ? (
                                      dispatch.items.map((item, idx) => (
                                        <tr key={idx}>
                                          <td>{idx + 1}</td>
                                          <td><code>{item.barcode || '-'}</code></td>
                                          <td><strong>{item.lotNumber || '-'}</strong></td>
                                          <td>{item.brand || '-'}</td>
                                          <td className="dispatch-modern-desc-cell">{item.description || '-'}</td>
                                          <td className="dispatch-modern-number-cell">{item.sets || 0}</td>
                                          <td className="dispatch-modern-number-cell">{item.setsPerPcs || 1}</td>
                                          <td className="dispatch-modern-number-cell">{item.loosePcs || 0}</td>
                                          <td className="dispatch-modern-qty-cell"><strong>{item.quantity || 0}</strong></td>
                                          <td>
                                            {item.colors && item.colors.length > 0 ? (
                                              <div className="dispatch-modern-tags">
                                                {item.colors.map((color, i) => (
                                                  <span key={i} className="dispatch-modern-color-tag">{color}</span>
                                                ))}
                                              </div>
                                            ) : '-'}
                                          </td>
                                          <td>
                                            {item.sizes && item.sizes.length > 0 ? (
                                              <div className="dispatch-modern-tags">
                                                {item.sizes.map((size, i) => (
                                                  <span key={i} className="dispatch-modern-size-tag">{size}</span>
                                                ))}
                                              </div>
                                            ) : '-'}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan="11" className="dispatch-modern-no-items">No items found</td>
                                      </tr>
                                    )}
                                  </tbody>
                                  <tfoot>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Sets:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalSets || 0}</td>
                                    </tr>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Loose Pcs:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalLoosePcs || 0}</td>
                                    </tr>
                                    <tr className="dispatch-modern-summary-row">
                                      <td colSpan="5" className="dispatch-modern-summary-label">Total Quantity:</td>
                                      <td colSpan="6" className="dispatch-modern-summary-value">{dispatch.totalQuantity} pcs</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="dispatch-modern-empty">
                    <span>📦</span>
                    <h3>No dispatches found</h3>
                    <p>
                      {(startDate || endDate)
                        ? `No bills found for the selected date range`
                        : searchTerm
                          ? `No results matching "${searchTerm}"`
                          : "Create your first packing copy to get started!"}
                    </p>
                    {(startDate || endDate) && (
                      <button onClick={() => { setStartDate(''); setEndDate(''); }} className="dispatch-modern-btn-primary">
                        Clear Date Filter
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManagementDispatchDetail;
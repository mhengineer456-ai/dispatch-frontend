import React, { useState, useEffect } from 'react';
import './GatepassDetails.css';
import jsPDF from 'jspdf';

// Google Sheets configuration
const GOOGLE_SHEETS_CONFIG = {
  apiKey: process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk',
  sheetId: process.env.REACT_APP_SPREADSHEET_ID || '1s8cXaMtG2XSxdOu1Ecve5aLI2MQcbMjVsn6Sih4hItk',
  sheetName: 'Bills',
};

const GatepassDetails = ({ onBack, userRole, userData }) => {
  const [gatepassData, setGatepassData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Role-based access control state
  const [roleInfo, setRoleInfo] = useState({
    role: 'viewer',
    accessLevel: 'viewer',
    message: ''
  });

  // Function to get role from multiple sources
  const getEffectiveRole = () => {
    if (userRole && userRole !== '') return userRole;
    if (userData && userData.role && userData.role !== '') return userData.role;

    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      try {
        const parsed = JSON.parse(storedUserData);
        if (parsed.role && parsed.role !== '') return parsed.role;
      } catch (e) { }
    }

    const storedRole = localStorage.getItem('userRole');
    if (storedRole && storedRole !== '') return storedRole;

    return 'viewer';
  };

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const isWithinLastTwoDays = (dateString) => {
    if (!dateString) return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let gatepassDate;
      if (typeof dateString === 'string') {
        if (dateString.includes('-')) {
          const [year, month, day] = dateString.split('-');
          gatepassDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          gatepassDate = new Date(dateString);
        }
      } else {
        gatepassDate = new Date(dateString);
      }

      gatepassDate.setHours(0, 0, 0, 0);
      return gatepassDate.getTime() === today.getTime() || gatepassDate.getTime() === yesterday.getTime();
    } catch (error) {
      console.error('Error checking date range:', error);
      return false;
    }
  };

  const isToday = (dateString) => {
    if (!dateString) return false;
    try {
      const gatepassDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      gatepassDate.setHours(0, 0, 0, 0);
      return gatepassDate.getTime() === today.getTime();
    } catch (error) {
      return false;
    }
  };

  const fetchGatepassData = async (accessLevel) => {
    setLoading(true);
    try {
      const { apiKey, sheetId, sheetName } = GOOGLE_SHEETS_CONFIG;
      let allRows = [];
      let pageToken = '';
      let hasMoreData = true;

      while (hasMoreData) {
        let url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A:Z?key=${apiKey}&majorDimension=ROWS`;
        if (pageToken) url += `&pageToken=${pageToken}`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.values && data.values.length > 0) {
          if (allRows.length === 0) {
            allRows = [...data.values];
          } else {
            allRows = [...allRows, ...data.values.slice(1)];
          }
        }

        if (data.nextPageToken) {
          pageToken = data.nextPageToken;
        } else {
          hasMoreData = false;
        }
      }

      if (allRows.length > 0) {
        const headers = allRows[0];
        const rows = allRows.slice(1);

        const columnIndices = {
          billNumber: headers.findIndex(h => h === 'Bill Number'),
          partyName: headers.findIndex(h => h === 'Party Name'),
          billDate: headers.findIndex(h => h === 'Bill Date'),
          totalBoxes: headers.findIndex(h => h === 'Total Boxes'),
          totalBags: headers.findIndex(h => h === 'Total Bags'),
          totalPolybags: headers.findIndex(h => h === 'Total Polybags'),
          gatepassCreated: headers.findIndex(h => h === 'GATEPASS CREATED'),
          gatepassTime: headers.findIndex(h => h === 'GATEPASS CREATION TIME'),
          driverName: headers.findIndex(h => h === 'DRIVER NAME'),
          driverContact: headers.findIndex(h => h === 'DRIVER CONTACT'),
          driverVehicle: headers.findIndex(h => h === 'DRIVER VEHICLE NUMBER'),
          porter: headers.findIndex(h => h === 'PORTER'),
          byHand: headers.findIndex(h => h === 'BY HAND'),
          byHandPerson: headers.findIndex(h => h === 'BY HAND PERSON NAME'),
        };

        const formattedData = rows
          .map((row, index) => {
            if (!row || row.length === 0 || !row[columnIndices.billNumber]) return null;

            const gatepassValue = row[columnIndices.gatepassCreated] || '';
            const hasGatepass = gatepassValue.trim() !== '';

            let formattedDate = '';
            const rawBillDate = row[columnIndices.billDate] || '';

            if (rawBillDate) {
              if (rawBillDate.match(/^\d{4}-\d{2}-\d{2}/)) {
                formattedDate = rawBillDate;
              } else {
                const dateObj = new Date(rawBillDate);
                if (!isNaN(dateObj.getTime())) {
                  formattedDate = dateObj.toISOString().split('T')[0];
                } else {
                  formattedDate = rawBillDate;
                }
              }
            }

            const totalBoxes = parseInt(row[columnIndices.totalBoxes]) || 0;
            const totalBags = parseInt(row[columnIndices.totalBags]) || 0;
            const totalPolybags = parseInt(row[columnIndices.totalPolybags]) || 0;

            let bagDetails = [];
            if (totalBoxes > 0) bagDetails.push(`${totalBoxes} Petti`);
            if (totalBags > 0) bagDetails.push(`${totalBags} Bora`);
            if (totalPolybags > 0) bagDetails.push(`${totalPolybags} Polybags`);
            const bagDetailsText = bagDetails.join(' + ') || '0';

            return {
              id: `${row[columnIndices.billNumber] || index}_${index}`,
              date: formattedDate,
              originalBillDate: rawBillDate,
              billNumber: row[columnIndices.billNumber] || '',
              partyName: row[columnIndices.partyName] || '',
              bagDetails: bagDetailsText,
              driverName: row[columnIndices.driverName] || '',
              vehicleNumber: row[columnIndices.driverVehicle] || '',
              driverContact: row[columnIndices.driverContact] || '',
              porter: row[columnIndices.porter] || '',
              byHand: row[columnIndices.byHand] || '',
              byHandPerson: row[columnIndices.byHandPerson] || '',
              gatepassTime: row[columnIndices.gatepassTime] || '',
              gatepassCreated: gatepassValue,
              hasGatepass: hasGatepass,
              totalBoxes: totalBoxes,
              totalBags: totalBags,
              totalPolybags: totalPolybags,
              rawData: row
            };
          })
          .filter(row => row !== null);

        let roleFilteredData;
        if (accessLevel === 'admin') {
          roleFilteredData = formattedData;
        } else if (accessLevel === 'manager') {
          roleFilteredData = formattedData.filter(item => isWithinLastTwoDays(item.date));
        } else {
          roleFilteredData = formattedData.filter(item => isToday(item.date));
        }

        setGatepassData(formattedData);
        setFilteredData(roleFilteredData);
      } else {
        setGatepassData([]);
        setFilteredData([]);
      }
    } catch (error) {
      console.error('Error fetching gatepass data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...gatepassData];

    if (roleInfo.accessLevel === 'admin') {
      filtered = [...gatepassData];
    } else if (roleInfo.accessLevel === 'manager') {
      filtered = gatepassData.filter(item => isWithinLastTwoDays(item.date));
    } else {
      filtered = gatepassData.filter(item => isToday(item.date));
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.partyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.driverContact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (startDate && (roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager')) {
      filtered = filtered.filter(item => item.date >= startDate);
    }

    if (endDate && (roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager')) {
      filtered = filtered.filter(item => item.date <= endDate);
    }

    setFilteredData(filtered);
  };

  useEffect(() => {
    const effectiveRole = getEffectiveRole();
    const roleLower = effectiveRole?.toLowerCase() || '';

    let accessLevel = 'viewer';
    let message = 'Viewing today\'s gatepass records only';

    if (roleLower === 'admin' || roleLower === 'administrative' || roleLower === 'superadmin' || roleLower === 'administrator') {
      accessLevel = 'admin';
      message = 'Viewing all gatepass records (Full Access)';
    } else if (roleLower === 'manager') {
      accessLevel = 'manager';
      message = 'Viewing last 2 days of gatepass records';
    } else {
      accessLevel = 'viewer';
      message = 'Viewing today\'s gatepass records only';
    }

    setRoleInfo({
      role: effectiveRole,
      accessLevel: accessLevel,
      message: message
    });

    fetchGatepassData(accessLevel);
  }, []);

  useEffect(() => {
    if (gatepassData.length > 0) {
      filterData();
    }
  }, [searchTerm, startDate, endDate, gatepassData, roleInfo.accessLevel]);

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const viewDetails = (row) => {
    setSelectedRow(row);
    setShowModal(true);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '-';
    if (dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  const downloadGatepassPDF = (isSingle = false, singleItem = null) => {
    try {
      if (typeof jsPDF === 'undefined') {
        alert("PDF library not loaded. Please refresh the page.");
        return false;
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - (margin * 2);

      const itemsToShow = isSingle ? [singleItem] : filteredData;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("MH DISPATCH & STORE MANAGEMENT SYSTEM", pageWidth / 2, 14, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("SECURITY GATEPASS REGISTER", pageWidth / 2, 20, { align: "center" });

      // Table Columns & Headers setup (Exact 273mm total width matching contentWidth)
      const colWidths = [10, 22, 28, 70, 42, 46, 30, 25];
      const headers = [
        "#",
        "DATE",
        "BILL NO",
        "PARTY ACCOUNT NAME",
        "PACKAGING",
        "DRIVER & VEHICLE",
        "GATEPASS TIME",
        "STATUS"
      ];

      const drawTableHeader = (currentY) => {
        doc.setFillColor(30, 58, 138); // Royal Blue
        doc.rect(margin, currentY, contentWidth, 8, 'F');
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.3);
        doc.rect(margin, currentY, contentWidth, 8, 'S');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");

        let xPos = margin;
        headers.forEach((h, i) => {
          if (i > 0) {
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.2);
            doc.line(xPos, currentY, xPos, currentY + 8);
          }
          doc.setTextColor(255, 255, 255);
          doc.text(h, xPos + 1.5, currentY + 5.5);
          xPos += colWidths[i];
        });

        doc.setTextColor(0, 0, 0);
        return currentY + 8;
      };

      let yPos = drawTableHeader(26);

      itemsToShow.forEach((item, index) => {
        const vals = [
          String(index + 1),
          formatDisplayDate(item.date),
          item.billNumber || '-',
          item.partyName || '-',
          item.bagDetails || '-',
          item.driverName || item.vehicleNumber ? `${item.driverName || '-'} (${item.vehicleNumber || '-'})` : '-',
          item.gatepassTime || '-',
          item.hasGatepass ? 'ISSUED' : 'PENDING'
        ];

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        // Wrap text for each column and calculate max lines needed for this row
        let maxLines = 1;
        const wrappedVals = vals.map((val, i) => {
          const cellWidth = colWidths[i] - 3;
          const lines = doc.splitTextToSize(String(val || '-'), cellWidth);
          if (lines.length > maxLines) {
            maxLines = lines.length;
          }
          return lines;
        });

        const lineHeight = 3.8;
        const rowHeight = Math.max(7, (maxLines * lineHeight) + 2.5);

        // Check page overflow
        if (yPos + rowHeight > pageHeight - 15) {
          doc.addPage();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("SECURITY GATEPASS REGISTER (Contd.)", pageWidth / 2, 10, { align: "center" });
          yPos = drawTableHeader(14);
        }

        // Alternate row colors & row outer border
        const bg = index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
        doc.setDrawColor(203, 213, 225); // #cbd5e1 Slate border
        doc.setLineWidth(0.25);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'S');

        // Draw vertical cell borders for each column
        let colX = margin;
        colWidths.forEach((w, i) => {
          if (i > 0) {
            doc.line(colX, yPos, colX, yPos + rowHeight);
          }
          colX += w;
        });

        // Draw text inside cells
        let rowX = margin;
        wrappedVals.forEach((lines, i) => {
          if (i === 7) {
            if (vals[7] === 'ISSUED') {
              doc.setTextColor(16, 185, 129); // Green
              doc.setFont("helvetica", "bold");
            } else {
              doc.setTextColor(239, 68, 68); // Red
              doc.setFont("helvetica", "bold");
            }
          } else {
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", i === 2 || i === 0 ? "bold" : "normal");
          }

          lines.forEach((lineText, lineIdx) => {
            doc.text(lineText, rowX + 1.5, yPos + 4.5 + (lineIdx * lineHeight));
          });

          rowX += colWidths[i];
        });

        yPos += rowHeight;
      });

      doc.save(`Gatepass_Register_${new Date().toISOString().split('T')[0]}.pdf`);
      return true;
    } catch (error) {
      console.error("PDF Error:", error);
      alert(`Failed to generate PDF: ${error.message}`);
      return false;
    }
  };

  const downloadAllDataPDF = () => {
    if (filteredData.length === 0) {
      alert('No data to download');
      return;
    }
    downloadGatepassPDF(false, null);
  };

  const generateSinglePDF = (item) => {
    downloadGatepassPDF(true, item);
  };

  const getRoleDisplayName = () => {
    switch (roleInfo.accessLevel) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      default: return 'Viewer';
    }
  };

  return (
    <div className="gatepass-container">
      {/* EXECUTIVE HERO HEADER */}
      <div className="header">
        <div className="header-content">
          <div className="title-section">
            <div className="title-icon-wrapper">🚪</div>
            <div>
              <h1>Security Gatepass Directory</h1>
              <p>Verified Transport Exit Records & Security Gate Clearances</p>
            </div>
          </div>

          <div className="header-actions-group">
            <div className="stats-badge">
              <span className="stats-count">{filteredData.length}</span>
              <span className="stats-text">Gatepass Records</span>
            </div>

            <div className="role-access-pill">
              👤 {getRoleDisplayName()} • {roleInfo.message}
            </div>

            <button onClick={() => fetchGatepassData(roleInfo.accessLevel)} className="refresh-btn" title="Refresh Records">
              ↻
            </button>

            <button onClick={downloadAllDataPDF} className="download-pdf-btn">
              <span>📥 Download PDF</span>
            </button>

            <button onClick={handleBackNavigation} className="back-btn">
              <span>← Dashboard</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="filters-bar">
        <div className="filters-container">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="🔍 Search by Gatepass, Bill No, Party Name, Driver Name, or Vehicle Number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-field"
            />
          </div>

          {(roleInfo.accessLevel === 'admin' || roleInfo.accessLevel === 'manager') && (
            <div className="date-range">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-field"
              />
              <span className="date-sep">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-field"
              />
            </div>
          )}

          {(searchTerm || startDate || endDate) && (
            <button onClick={clearFilters} className="clear-btn">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* DATA TABLE WRAPPER */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>Synchronizing security gatepass records from Google Sheets...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th width="5%">#</th>
                <th width="10%">DATE</th>
                <th width="12%">BILL NO</th>
                <th width="28%">PARTY ACCOUNT NAME</th>
                <th width="14%">PACKAGING</th>
                <th width="16%">DRIVER & VEHICLE</th>
                <th width="8%">STATUS</th>
                <th width="7%">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="9">
                    <div className="empty-state">
                      <span>📋</span>
                      <p>No Gatepass Records Found</p>
                      <small>
                        {roleInfo.accessLevel === 'admin' && 'Try adjusting search keywords or date bounds.'}
                        {roleInfo.accessLevel === 'manager' && 'No gatepass dispatches recorded in the last 2 days.'}
                        {roleInfo.accessLevel === 'viewer' && 'No gatepass dispatches recorded today.'}
                      </small>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{formatDisplayDate(item.date)}</td>
                    <td className="bill-no">{item.billNumber}</td>
                    <td className="party-name-txt">{item.partyName}</td>
                    <td>{item.bagDetails}</td>
                    <td>
                      <div><b>{item.driverName || 'N/A'}</b></div>
                      <small style={{ color: '#64748B' }}>{item.vehicleNumber || 'No Vehicle'}</small>
                    </td>
                    <td>
                      <span className={item.hasGatepass ? 'status-pill-issued' : 'status-pill-pending'}>
                        {item.hasGatepass ? '✓ ISSUED' : '⏳ PENDING'}
                      </span>
                    </td>
                    <td>
                      <div className="action-group">
                        <button
                          onClick={() => viewDetails(item)}
                          className="action-icon view"
                          title="View Full Gatepass Details"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => generateSinglePDF(item)}
                          className="action-icon pdf"
                          title="Download PDF Gatepass Voucher"
                        >
                          📄
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* DETAIL MODAL */}
      {showModal && selectedRow && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>🚪 Gatepass Record Details</h3>
              <button onClick={() => setShowModal(false)} className="close-modal">×</button>
            </div>

            <div className="modal-body">
              <div className="info-group">
                <label>Bill Voucher Number</label>
                <span className="bill-no">{selectedRow.billNumber}</span>
              </div>
              <div className="info-group">
                <label>Dispatch Date</label>
                <span>{formatDisplayDate(selectedRow.date)}</span>
              </div>
              <div className="info-group">
                <label>Party Account Name</label>
                <span>{selectedRow.partyName}</span>
              </div>
              <div className="info-group">
                <label>Packaging Breakdown</label>
                <span>{selectedRow.bagDetails}</span>
              </div>
              <div className="info-group">
                <label>Assigned Driver</label>
                <span>{selectedRow.driverName || 'Not Assigned'}</span>
              </div>
              <div className="info-group">
                <label>Vehicle Number</label>
                <span>{selectedRow.vehicleNumber || 'Not Assigned'}</span>
              </div>
              <div className="info-group">
                <label>Driver Phone Contact</label>
                <span>{selectedRow.driverContact || 'Not Specified'}</span>
              </div>
              <div className="info-group">
                <label>Porter Required</label>
                <span>{selectedRow.porter === 'YES' ? 'Yes' : 'No'}</span>
              </div>
              <div className="info-group">
                <label>By Hand Quantity</label>
                <span>{selectedRow.byHand || '0'} Pcs</span>
              </div>
            </div>

            <div className="modal-foot">
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Close Window
              </button>
              <button onClick={() => generateSinglePDF(selectedRow)} className="btn-primary">
                📄 Download Voucher PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GatepassDetails;
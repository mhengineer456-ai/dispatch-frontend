// PartySelection.js - Executive Royal Navy & Light Theme Party Selection Console
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import "./PartySelection.css";

const PartySelection = ({ onSelectParty, onBack }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [parties, setParties] = useState([]);
  const [filteredParties, setFilteredParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedParty, setSelectedParty] = useState(null);

  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Google Sheets API configuration
  const GOOGLE_SHEETS_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
  const SPREADSHEET_ID = process.env.REACT_APP_PARTY_SHEET_ID || "10l3ECz9OFNle_jcEUyo2V17-_CkwvkH-PhFlYnfS-Rg";
  const SHEET_NAME = "PartyName";
  const RANGE = `${SHEET_NAME}!A:E`;

  // Fetch parties from Google Sheets
  const fetchPartiesFromSheet = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${GOOGLE_SHEETS_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const data = await response.json();

      if (!data.values || data.values.length <= 1) {
        setParties([]);
        setFilteredParties([]);
        return;
      }

      const rows = data.values.slice(1);

      const partiesList = rows.map((row, index) => ({
        id: index + 1,
        name: row[0] || "Unnamed Party",
        contact: row[1] || "",
        email: row[2] || "",
        gst: row[3] || "",
        address: row[4] || "",
        rowIndex: index + 1
      })).filter(party => party.name !== "Unnamed Party");

      setParties(partiesList);
      localStorage.setItem("cachedParties", JSON.stringify(partiesList));
      localStorage.setItem("partiesLastFetched", new Date().toISOString());

    } catch (err) {
      console.error("Error fetching parties from Google Sheets:", err);
      setError("Failed to load parties from Google Sheets");

      const cachedParties = localStorage.getItem("cachedParties");
      if (cachedParties) {
        try {
          const cached = JSON.parse(cachedParties);
          setParties(cached);
          setError("Using cached data - offline mode active");
        } catch (e) {
          console.error("Error loading cached parties:", e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartiesFromSheet();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPartiesFromSheet();
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!parties || parties.length === 0) {
      setFilteredParties([]);
      return;
    }

    if (!searchTerm.trim()) {
      setFilteredParties([]);
      setShowSuggestions(false);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = parties.filter(party =>
        party.name.toLowerCase().includes(term) ||
        party.contact?.toLowerCase().includes(term) ||
        party.email?.toLowerCase().includes(term) ||
        party.gst?.toLowerCase().includes(term)
      );

      setFilteredParties(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  }, [searchTerm, parties]);

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredParties.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredParties.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredParties[selectedIndex]) {
          handlePartySelect(filteredParties[selectedIndex]);
        } else if (filteredParties[0]) {
          handlePartySelect(filteredParties[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSearchTerm("");
        setSelectedParty(null);
        break;
      default:
        break;
    }
  };

  const handlePartySelect = (party) => {
    setSelectedParty(party);
    setSelectedIndex(-1);
  };

  const handleConfirmSelection = () => {
    if (selectedParty) {
      localStorage.setItem('selectedParty', JSON.stringify(selectedParty));
      if (onSelectParty) {
        onSelectParty(selectedParty);
      }
      navigate('/party-bill');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setShowSuggestions(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        // Keep view active
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const refreshData = () => {
    fetchPartiesFromSheet();
  };

  const getInitials = (name) => {
    if (!name) return "P";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  if (loading && parties.length === 0) {
    return (
      <div className="ps-container">
        <div className="ps-loading-screen">
          <div className="ps-loading-spinner">
            <div className="ps-spinner-circle"></div>
          </div>
          <h2>Loading Customer Directory</h2>
          <p>Synchronizing party accounts from Google Sheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-container">
      <div className="ps-bg-pattern"></div>

      <div className="ps-content">
        {/* EXECUTIVE ROYAL HEADER */}
        <div className="ps-header">
          <button onClick={handleBack} className="ps-back-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back to Dashboard</span>
          </button>

          <div className="ps-header-title">
            <div className="ps-header-badge">PARTY MANAGEMENT CONSOLE</div>
            <h1>Customer Directory & Bill Selection</h1>
            <p>Select a party account to create item dispatches, packing lists, and official invoices</p>
          </div>

          <div className="ps-header-actions">
            <div className="ps-count-chip">
              <span className="ps-chip-dot"></span>
              <span> Parties Loaded</span>
            </div>
            <button onClick={refreshData} className="ps-refresh-btn" title="Refresh Google Sheets Party Data">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="ps-error-banner">
            <span>⚠️ {error}</span>
            <button onClick={refreshData}>Retry Sync</button>
          </div>
        )}

        {/* Split Layout */}
        <div className="ps-split-layout">

          {/* LEFT PANEL: PARTY SEARCH & SUGGESTION CARDS */}
          <div className="ps-left-panel">

            {/* Search Input Bar */}
            <div className="ps-search-box">
              <div className="ps-search-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search party name, phone, GSTIN or email..."
                value={searchTerm}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                autoFocus
                className="ps-search-input"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                  }}
                  className="ps-clear-btn"
                  title="Clear Search"
                >
                  ×
                </button>
              )}
            </div>

            {/* Keyboard Shortcuts Bar */}
            <div className="ps-keyboard-tips">
              <span className="ps-tip"><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
              <span className="ps-tip"><kbd>Enter</kbd> Select</span>
              <span className="ps-tip"><kbd>Esc</kbd> Clear</span>
            </div>

            <div className="ps-panel-sub-header">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Customer Directory Results
              </h3>
              <span className="ps-results-badge">{filteredParties.length} Parties</span>
            </div>

            {/* Suggestion Cards Grid */}
            <div className="ps-suggestions-list" ref={suggestionsRef}>
              {filteredParties.length > 0 ? (
                filteredParties.map((party, index) => {
                  const isSelected = selectedParty?.id === party.id;
                  const isHovered = selectedIndex === index;

                  return (
                    <div
                      key={party.id}
                      className={`ps-suggestion-card ${isHovered ? 'ps-card-hovered' : ''} ${isSelected ? 'ps-card-active' : ''}`}
                      onClick={() => handlePartySelect(party)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="ps-card-left-badge">
                        <div className="ps-party-avatar">
                          {getInitials(party.name)}
                        </div>
                      </div>

                      <div className="ps-card-main-info">
                        <div className="ps-party-name-row">
                          <h4 className="ps-party-title">{party.name}</h4>
                          {isSelected && <span className="ps-active-pill">SELECTED ✓</span>}
                        </div>

                        <div className="ps-party-meta-grid">
                          {party.contact && (
                            <span className="ps-meta-tag">
                              📞 {party.contact}
                            </span>
                          )}
                          {party.gst && (
                            <span className="ps-meta-tag tag-gst">
                              🏷️ {party.gst}
                            </span>
                          )}
                          {party.email && (
                            <span className="ps-meta-tag">
                              ✉️ {party.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="ps-card-arrow">→</div>
                    </div>
                  );
                })
              ) : !searchTerm.trim() ? (
                <div className="ps-empty-search">
                  <div className="ps-empty-icon">🔍</div>
                  <h4>Search Customer Directory</h4>
                  <p>Start typing a party name, phone number, email, or GSTIN to view matching suggestions...</p>
                </div>
              ) : (
                <div className="ps-empty-search">
                  <div className="ps-empty-icon">❌</div>
                  <h4>No Matching Party Found</h4>
                  <p>No customer account matches "{searchTerm}". Check search terms or refresh directory from Google Sheets.</p>
                  <button onClick={refreshData} className="ps-action-link-btn">
                    Refresh Directory Data
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT PANEL: SELECTED PARTY EXECUTIVE MASTER CARD */}
          <div className="ps-right-panel">
            {selectedParty ? (
              <div className="ps-selected-master-card">
                <div className="ps-master-top-bar">
                  <div className="ps-master-badge">VERIFIED CUSTOMER ACCOUNT</div>
                  <span className="ps-master-status">Ready For Invoicing</span>
                </div>

                <div className="ps-master-header-row">
                  <div className="ps-master-avatar-lg">
                    {getInitials(selectedParty.name)}
                  </div>
                  <div>
                    <h2 className="ps-master-party-name">{selectedParty.name}</h2>
                    <span className="ps-master-id-tag">Account Record #{selectedParty.id}</span>
                  </div>
                </div>

                <div className="ps-master-details-grid">
                  <div className="ps-master-field-card">
                    <span className="field-label">📞 Primary Contact</span>
                    <span className="field-value">{selectedParty.contact || 'Not Specified'}</span>
                  </div>

                  <div className="ps-master-field-card">
                    <span className="field-label">🏷️ GSTIN Registration</span>
                    <span className="field-value highlight-gst">{selectedParty.gst || 'Unregistered / Exempt'}</span>
                  </div>

                  <div className="ps-master-field-card">
                    <span className="field-label">✉️ Billing Email Address</span>
                    <span className="field-value">{selectedParty.email || 'No Email Registered'}</span>
                  </div>

                  <div className="ps-master-field-card field-full">
                    <span className="field-label">📍 Registered Business Address</span>
                    <span className="field-value">{selectedParty.address || 'Standard Registered Dispatch Address'}</span>
                  </div>
                </div>

                <button onClick={handleConfirmSelection} className="ps-confirm-primary-btn">
                  <span>🚀 Proceed to Create Party Bill</span>
                  <span className="btn-arrow">→</span>
                </button>
              </div>
            ) : (
              <div className="ps-empty-selection-card">
                <div className="ps-empty-illustration">
                  <span className="illustration-icon">💼</span>
                </div>
                <h3>Select a Party Account</h3>
                <p>Click on any party from the customer directory list on the left to review account details and proceed to bill generation.</p>

                {/* Theoretical Guidelines Box */}
                <div className="ps-theory-guidelines-box">
                  <div className="theory-header">
                    <span>💡</span>
                    <h4>Invoicing & Audit Standards</h4>
                  </div>
                  <div className="theory-points">
                    <div className="point-item">
                      <span className="point-check">✓</span>
                      <span><b>Single-Point Client Accounting:</b> Ensures party ledger entries reconcile seamlessly across local and cloud database registers.</span>
                    </div>
                    <div className="point-item">
                      <span className="point-check">✓</span>
                      <span><b>GSTIN Verification:</b> Prevents tax allocation mismatches during monthly GST compliance reporting.</span>
                    </div>
                    <div className="point-item">
                      <span className="point-check">✓</span>
                      <span><b>Audit Trail Generation:</b> Every party selection attaches exact customer metadata to packing lists and gatepasses.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default PartySelection;
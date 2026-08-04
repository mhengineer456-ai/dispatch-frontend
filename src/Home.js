// Home.js - Redesigned High-Tech & Modern Executive Dashboard
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import SplashScreen from "./SplashScreen";

function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [dispatchStats, setDispatchStats] = useState({
    totalDispatches: 0,
    activeDispatches: 0,
    completedToday: 0,
    pendingDispatches: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    onTimeRate: 0,
    totalParties: 0,
    totalBills: 0,
    totalGatepasses: 0,
    totalManualStickers: 0
  });

  const [toastMessage, setToastMessage] = useState(null);

  const isInitialized = useRef(false);
  const loadTimeoutRef = useRef(null);

  // Auto-rotate workflow step animation
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWorkflowStep(prev => (prev + 1) % 5);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // System Modules Data
  const staticBaseCards = useMemo(() => [
    {
      path: "/barcode",
      title: "GS1 Barcode Generator",
      icon: "🔖",
      category: "INVENTORY & INTAKE",
      description: "Generate unique GS1-128 high-density barcodes for fabrics, roll lots, and item tracking.",
      theoreticalInfo: "GS1-128 standard encodes variable data including Batch/Lot Number, Item Code, and Quantity into a high-precision barcode pattern read by optical laser scanners.",
      details: "✓ GS1-128 Compliant Barcodes\n✓ Multi-part Lot Encoding\n✓ High-Resolution Thermal Print",
      stats: "Instant Scanning Ready",
      color: "#10B981",
      lightColor: "rgba(16, 185, 129, 0.1)",
      gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)"
    },
    {
      path: "/manual-sticker",
      title: "Manual Sticker Labelling",
      icon: "🏷️",
      category: "PRINTING & PACKAGING",
      description: "Design and print custom identification stickers for packages, rolls, and specialized shipments.",
      theoreticalInfo: "Variable data printing engine allows custom text, batch identifiers, piece counts, and customer instructions to be printed directly on self-adhesive thermal sticker stock.",
      details: "✓ Custom Text & Batch Specs\n✓ Flexible Dimensions & Fonts\n✓ Direct Printer Output",
      stats: "Custom Thermal Output",
      color: "#F59E0B",
      lightColor: "rgba(245, 158, 11, 0.1)",
      gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
    },
    {
      path: "/party-selection",
      title: "Party Billing & Invoice",
      icon: "💰",
      category: "BILLING & DISPATCH",
      description: "Compile item dispatches, calculate taxes, and generate party-wise packing bills & invoices.",
      theoreticalInfo: "Multi-item aggregation engine groups scanned roll dispatches per party account, computes total piece counts, formats printable invoices, and triggers cloud database synchronization.",
      details: "✓ Multi-Bill Aggregation\n✓ Live Google Sheets Sync\n✓ One-Click Email Trigger",
      stats: "Party Invoicing Engine",
      color: "#EC4899",
      lightColor: "rgba(236, 72, 153, 0.1)",
      gradient: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)"
    },
    {
      path: "/draft-packing",
      title: "Draft Packing Workspace",
      icon: "📝",
      category: "STAGING & AUDIT",
      description: "Stage, review, and modify preliminary packing lists prior to final dispatch approval.",
      theoreticalInfo: "Staging buffer prevents partial or accidental commits by storing working drafts locally. Allows warehouse operators to verify physical counts against digital records before final lock.",
      details: "✓ Working Draft Buffer\n✓ Multi-operator Review\n✓ Zero-Data-Loss Persistence",
      stats: "Staging Area Buffer",
      color: "#64748B",
      lightColor: "rgba(100, 116, 139, 0.1)",
      gradient: "linear-gradient(135deg, #64748B 0%, #475569 100%)"
    },
    {
      path: "/gatepass-generator",
      title: "Security Gatepass Creation",
      icon: "🚪",
      category: "LOGISTICS & EXIT",
      description: "Issue official security gatepasses with vehicle verification and driver authentication.",
      theoreticalInfo: "Access control protocol links party bills with transport details, driver credentials, and vehicle registration numbers, generating an authoritative gate pass for gate security clearance.",
      details: "✓ Vehicle & Driver Auth\n✓ Transport Voucher Tracking\n✓ Official Gate Clearances",
      stats: "Security Clearance",
      color: "#6366F1",
      lightColor: "rgba(99, 102, 241, 0.1)",
      gradient: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)"
    },
    {
      path: "/gatepass-details",
      title: "Gatepass Register Logs",
      icon: "📋",
      category: "AUDIT & SECURITY",
      description: "Audit and search all historical gatepasses, transport vouchers, and exit timestamps.",
      theoreticalInfo: "Centralized relational audit log index enables instant lookup of dispatched vehicles, gatepass serial numbers, associated packing lists, and security exit timestamps.",
      details: "✓ Centralized Log Search\n✓ Timestamp Verification\n✓ Exportable Audit Records",
      stats: "Security Log Repository",
      color: "#06B6D4",
      lightColor: "rgba(6, 182, 212, 0.1)",
      gradient: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)"
    },
  ], []);

  const adminManagerCard = useMemo(() => ({
    path: "/dispatch-details",
    title: "Executive Dispatch Master",
    icon: "🚚",
    category: "MANAGEMENT CONSOLE",
    description: "Monitor real-time fleet operations, track active deliveries, and review dispatch performance.",
    theoreticalInfo: "High-level operational overview combining real-time status feeds, delivery completion ratios, and automated Nodemailer Tally PDF summary email controls.",
    details: "✓ Real-Time Route Control\n✓ Nightly Email Triggers\n✓ PDF Register Generator",
    stats: "Full Operational Control",
    color: "#8B5CF6",
    lightColor: "rgba(139, 92, 246, 0.1)",
    gradient: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
  }), []);

  const teamMemberCard = useMemo(() => ({
    path: "/user-dispatch-details",
    title: "My Assigned Dispatches",
    icon: "📦",
    category: "OPERATOR WORKSPACE",
    description: "View your daily assigned dispatches, update delivery status, and upload confirmation notes.",
    theoreticalInfo: "Operator-focused interface designed for rapid task execution, status updates, and proof-of-delivery logging during active warehouse shifts.",
    details: "✓ View Active Assignments\n✓ Instant Status Update\n✓ Shift Completion Log",
    stats: "Operator Shift Center",
    color: "#14B8A6",
    lightColor: "rgba(20, 184, 166, 0.1)",
    gradient: "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)"
  }), []);

  const adminOnlyCard = useMemo(() => ({
    path: "/management-dispatch",
    title: "Analytics & Executive Reports",
    icon: "📊",
    category: "ADMINISTRATIVE ANALYTICS",
    description: "Deep analytics dashboard, historical trend forecasting, and executive PDF audit reports.",
    theoreticalInfo: "Enterprise data warehouse integration extracting metrics across all historical bills, sheet logs, and transport records for financial reconciliation and operational forecasting.",
    details: "✓ Predictive Volume Trends\n✓ Financial Reconciliation\n✓ Tally PDF Statement Export",
    stats: "Enterprise Intelligence",
    color: "#F43F5E",
    lightColor: "rgba(244, 63, 94, 0.1)",
    gradient: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)"
  }), []);

  const loadDashboardData = useCallback(() => {
    try {
      const savedDispatches = JSON.parse(localStorage.getItem("dispatches") || "[]");
      const savedParties = JSON.parse(localStorage.getItem("parties") || "[]");
      const savedBills = JSON.parse(localStorage.getItem("bills") || "[]");
      const savedGatepasses = JSON.parse(localStorage.getItem("gatepasses") || "[]");
      const savedManualStickers = JSON.parse(localStorage.getItem("manualStickers") || "[]");
      const today = new Date().toDateString();

      const completedToday = savedDispatches.filter(
        d => d.status === "completed" && new Date(d.completedDate).toDateString() === today
      ).length;

      const onTimeDeliveries = savedDispatches.filter(d => d.status === "completed" && d.onTime).length;
      const totalCompleted = savedDispatches.filter(d => d.status === "completed").length;
      const onTimeRate = totalCompleted > 0 ? (onTimeDeliveries / totalCompleted * 100).toFixed(1) : 100;

      setDispatchStats({
        totalDispatches: savedDispatches.length,
        activeDispatches: savedDispatches.filter(d => d.status === "active").length,
        completedToday: completedToday,
        pendingDispatches: savedDispatches.filter(d => d.status === "pending").length,
        totalDrivers: 15,
        availableDrivers: 8,
        onTimeRate: onTimeRate,
        totalParties: savedParties.length,
        totalBills: savedBills.length,
        totalGatepasses: savedGatepasses.length,
        totalManualStickers: savedManualStickers.length
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToastMessage({ message, type });
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleLogout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userData");

    window.dispatchEvent(new Event('authChange'));
    setUser(null);
    showToast("Logged out successfully", 'info');

    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 500);
  }, [navigate, showToast]);

  const handleNavigation = useCallback((path) => {
    navigate(path);
  }, [navigate]);

  const getNavigationCards = useCallback(() => {
    const role = user?.role || user?.position || '';
    const normalizedRole = role.toLowerCase().trim();

    if (normalizedRole === 'administrator' || normalizedRole === 'administrative') {
      return [...staticBaseCards, adminManagerCard, teamMemberCard, adminOnlyCard];
    }
    else if (normalizedRole === 'manager') {
      return [...staticBaseCards, adminManagerCard];
    }
    else {
      return [...staticBaseCards, teamMemberCard];
    }
  }, [user, staticBaseCards, adminManagerCard, teamMemberCard, adminOnlyCard]);

  useEffect(() => {
    if (isInitialized.current) return;

    const authenticated = localStorage.getItem("isAuthenticated");
    const userData = localStorage.getItem("userData");

    if (authenticated === "true" && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        loadDashboardData();
        isInitialized.current = true;
      } catch (error) {
        console.error("Error parsing user data:", error);
        navigate('/login', { replace: true });
      }
    } else if (authenticated !== "true") {
      navigate('/login', { replace: true });
    }

    const splashShown = sessionStorage.getItem("splashShown");
    if (splashShown) {
      setShowSplash(false);
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [navigate, loadDashboardData]);

  useEffect(() => {
    const handleAuthChange = () => {
      const authenticated = localStorage.getItem("isAuthenticated");
      if (authenticated !== "true") {
        setUser(null);
        isInitialized.current = false;
      } else {
        const userData = localStorage.getItem("userData");
        if (userData) {
          try {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            loadDashboardData();
            isInitialized.current = true;
          } catch (error) {
            console.error("Error parsing user data:", error);
          }
        }
      }
    };

    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, [loadDashboardData]);

  if (showSplash) {
    return <SplashScreen onFinish={() => {
      sessionStorage.setItem("splashShown", "true");
      setShowSplash(false);
    }} duration={3000} />;
  }

  const navigationCards = getNavigationCards();
  const userRole = user?.role || user?.position || "Team Member";
  const isAdminRole = userRole.toLowerCase().trim() === 'administrator' || userRole.toLowerCase().trim() === 'administrative';
  const isManagerRole = userRole.toLowerCase().trim() === 'manager';

  // System Workflow Steps Definitions
  const workflowSteps = [
    {
      num: "01",
      title: "Lot Intake & Barcode Scanning",
      icon: "🔖",
      badge: "INTAKE & SCAN",
      desc: "Fabric rolls are scanned using high-precision GS1-128 barcode scanners. Item lot numbers, piece counts, and set quantities are captured into local memory instantly."
    },
    {
      num: "02",
      title: "Party Invoicing & Sticker Print",
      icon: "🏷️",
      badge: "BILLING & STICKERS",
      desc: "Scanned items are aggregated under selected Party Accounts. Smart thermal stickers are printed, and a formal Party Bill is generated with complete item breakdowns."
    },
    {
      num: "03",
      title: "Dual Persistence Engine",
      icon: "⚡",
      badge: "CLOUD SYNC",
      desc: "Dispatches are saved to local offline storage (`bills.json`) and simultaneously synced in real-time to Google Sheets (`Bills` & `BillItems` tabs) for double redundancy."
    },
    {
      num: "04",
      title: "Gatepass & Security Dispatch",
      icon: "🚪",
      badge: "SECURITY CLEARANCE",
      desc: "Security gatepasses (`GP-1001`) are generated with driver details and vehicle registration numbers, allowing security personnel to verify and sign off on exits."
    },
    {
      num: "05",
      title: "Automated Email & Tally PDF Statements",
      icon: "📧",
      badge: "NIGHTLY AUDIT",
      desc: "Automated cron jobs trigger at 10:00 PM sending Royal Navy HTML summary emails with attached official Tally Register PDFs (Daily, Weekly, Monthly) to management."
    }
  ];

  return (
    <div className="home-super-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`toast-modern ${toastMessage.type}`}>
          <div className="toast-inner">
            <span className="toast-symbol">
              {toastMessage.type === 'success' ? '✓' : toastMessage.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-txt">{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="dashboard-content-wrapper">

        {/* HIGH TECH HERO HEADER */}
        <header className="modern-hero-header">
          <div className="hero-background-shapes">
            <div className="shape-blob shape-1"></div>
            <div className="shape-blob shape-2"></div>
            <div className="shape-grid-pattern"></div>
          </div>

          <div className="hero-top-row">
            <div className="hero-brand-block">
              <div className="brand-logo-glow">
                <span>⚡</span>
              </div>
              <div>
                <span className="brand-super-tag">ENTERPRISE LOGISTICS CONTROL</span>
                <h1 className="hero-main-title">MH DISPATCH & STORE MANAGEMENT</h1>
              </div>
            </div>

            <div className="hero-user-block">
              <div className="user-profile-badge">
                <div className="user-avatar-circle" style={{
                  background: isAdminRole
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : isManagerRole
                      ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                      : 'linear-gradient(135deg, #10B981, #047857)'
                }}>
                  {isAdminRole ? '👑' : isManagerRole ? '📊' : '👤'}
                </div>
                <div className="user-text-info">
                  <span className="user-display-name">{user?.fullName || user?.username || 'System User'}</span>
                  <span className="user-role-tag" style={{
                    color: isAdminRole ? '#F59E0B' : isManagerRole ? '#3B82F6' : '#10B981'
                  }}>
                    ● {userRole}
                  </span>
                </div>
              </div>

              <button onClick={handleLogout} className="hero-logout-btn" title="Logout Session">
                <span>Logout</span>
                <span className="logout-arrow">→</span>
              </button>
            </div>
          </div>

          {/* System Status Indicators Bar */}
          <div className="hero-status-strip">
            <div className="status-chip chip-active">
              <span className="pulsing-green-dot"></span>
              <span>System Core: <b>ONLINE</b></span>
            </div>
            <div className="status-chip">
              <span>📊 Cloud Sync: <b>Active</b></span>
            </div>
            <div className="status-chip">
              <span>📧 Email Service: <b> Engine Ready</b></span>
            </div>
            <div className="status-chip">
              <span>⏰ Nightly Reports: <b> Scheduled</b></span>
            </div>
          </div>
        </header>

        {/* METRICS & OVERVIEW CARDS */}
        {/* <section className="metrics-section">
          <div className="metric-card card-gold">
            <div className="metric-icon-box">🚚</div>
            <div className="metric-details">
              <span className="metric-label">Active Dispatches</span>
              <div className="metric-value-group">
                <span className="metric-number">{dispatchStats.activeDispatches}</span>
                <span className="metric-sub">/ {dispatchStats.totalDispatches} Total</span>
              </div>
            </div>
          </div>

          <div className="metric-card card-emerald">
            <div className="metric-icon-box">✓</div>
            <div className="metric-details">
              <span className="metric-label">Completed Today</span>
              <div className="metric-value-group">
                <span className="metric-number">{dispatchStats.completedToday}</span>
                <span className="metric-sub">Dispatches</span>
              </div>
            </div>
          </div>

          <div className="metric-card card-blue">
            <div className="metric-icon-box">💰</div>
            <div className="metric-details">
              <span className="metric-label">Total Bills & Parties</span>
              <div className="metric-value-group">
                <span className="metric-number">{dispatchStats.totalBills}</span>
                <span className="metric-sub">({dispatchStats.totalParties} Parties)</span>
              </div>
            </div>
          </div>

          <div className="metric-card card-purple">
            <div className="metric-icon-box">🔒</div>
            <div className="metric-details">
              <span className="metric-label">Gatepasses & Labels</span>
              <div className="metric-value-group">
                <span className="metric-number">{dispatchStats.totalGatepasses}</span>
                <span className="metric-sub">({dispatchStats.totalManualStickers} Stickers)</span>
              </div>
            </div>
          </div>
        </section> */}

        {/* SYSTEM WORKFLOW ANIMATION & THEORETICAL GUIDE SECTION */}
        <section className="workflow-theory-section">
          <div className="section-header-block">
            <div className="section-title-group">
              <span className="section-badge">INTERACTIVE ARCHITECTURE</span>
              <h2 className="section-main-heading">⚡ How MH Dispatch System Works</h2>
            </div>
            <p className="section-subtitle">
              Explore the 5-step automated workflow powering barcode intake, party billing, cloud database persistence, security gatepasses, and nightly executive email statements.
            </p>
          </div>

          {/* Interactive Stepper Navigation Bar */}
          <div className="workflow-stepper-bar">
            {workflowSteps.map((step, index) => (
              <button
                key={index}
                className={`stepper-nav-btn ${activeWorkflowStep === index ? 'step-active' : ''}`}
                onClick={() => setActiveWorkflowStep(index)}
              >
                <span className="step-num">{step.num}</span>
                <span className="step-icon">{step.icon}</span>
                <span className="step-nav-label">{step.badge}</span>
              </button>
            ))}
          </div>

          {/* Animated Active Workflow Card */}
          <div className="workflow-stage-display">
            <div className="workflow-animated-canvas">
              <div className="canvas-header">
                <div className="canvas-dots">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                </div>
                <div className="canvas-step-tag">STEP {workflowSteps[activeWorkflowStep].num} ARCHITECTURE FLOW</div>
              </div>

              <div className="canvas-body">
                <div className="workflow-graphic-container">
                  {/* Step 1 Animation */}
                  {activeWorkflowStep === 0 && (
                    <div className="anim-box anim-step1">
                      <div className="scanner-line"></div>
                      <div className="barcode-graphic">
                        <div className="bar b1"></div><div className="bar b2"></div><div className="bar b3"></div>
                        <div className="bar b4"></div><div className="bar b5"></div><div className="bar b6"></div>
                      </div>
                      <div className="anim-text">GS1-128 LASER SCANNING ACTIVE</div>
                    </div>
                  )}

                  {/* Step 2 Animation */}
                  {activeWorkflowStep === 1 && (
                    <div className="anim-box anim-step2">
                      <div className="bill-card-graphic">
                        <div className="bill-line"></div>
                        <div className="bill-line short"></div>
                        <div className="sticker-badge-anim">🏷️ STICKER PRINTING</div>
                      </div>
                    </div>
                  )}

                  {/* Step 3 Animation */}
                  {activeWorkflowStep === 2 && (
                    <div className="anim-box anim-step3">
                      <div className="db-node local-db">
                        <span>📁 Local JSON DB</span>
                      </div>
                      <div className="sync-arrows">
                        <span className="arrow-pulse">⚡ REAL-TIME SYNC ⚡</span>
                      </div>
                      <div className="db-node cloud-db">
                        <span>📊 Google Sheets API</span>
                      </div>
                    </div>
                  )}

                  {/* Step 4 Animation */}
                  {activeWorkflowStep === 3 && (
                    <div className="anim-box anim-step4">
                      <div className="gate-barrier">
                        <div className="gate-arm"></div>
                        <div className="truck-graphic">🚚 VEHICLE DISPATCH APPROVED</div>
                      </div>
                    </div>
                  )}

                  {/* Step 5 Animation */}
                  {activeWorkflowStep === 4 && (
                    <div className="anim-box anim-step5">
                      <div className="email-envelope-graphic">
                        <span className="mail-icon">📧</span>
                        <div className="pdf-attachment-badge">📄 TALLY REGISTER PDF ATTACHED</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="workflow-info-details">
                  <div className="step-info-badge">PHASE {workflowSteps[activeWorkflowStep].num} — {workflowSteps[activeWorkflowStep].badge}</div>
                  <h3 className="step-info-title">{workflowSteps[activeWorkflowStep].title}</h3>
                  <p className="step-info-desc">{workflowSteps[activeWorkflowStep].desc}</p>

                  <div className="step-tech-specs">
                    <div className="spec-pill">✓ Zero Data Loss Guarantee</div>
                    <div className="spec-pill">✓ Real-time Validation</div>
                    <div className="spec-pill">✓ Audit Compliance</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SYSTEM MODULES GRID */}
        <section className="modules-grid-section">
          <div className="section-header-block">
            <span className="section-badge">OPERATIONAL CONSOLE</span>
            <h2 className="section-main-heading">🚀 System Control Modules</h2>
            <p className="section-subtitle">Select a module below to launch operations, manage dispatches, or generate gatepasses.</p>
          </div>

          <div className="modules-grid">
            {navigationCards.map((card, index) => (
              <div
                key={card.path}
                className="modern-module-card"
                onClick={() => handleNavigation(card.path)}
                style={{
                  animationDelay: `${index * 0.04}s`,
                  '--card-color': card.color,
                  '--card-gradient': card.gradient
                }}
              >
                <div className="card-top-gradient" style={{ background: card.gradient }}></div>

                <div className="card-header">
                  <div className="card-category-tag">{card.category || 'MODULE'}</div>
                  <div className="card-icon-wrapper" style={{ background: card.lightColor, color: card.color }}>
                    <span className="card-icon">{card.icon}</span>
                  </div>
                </div>

                <div className="card-body">
                  <h3 className="card-title">{card.title}</h3>
                  <p className="card-description">{card.description}</p>

                  <div className="card-checklist">
                    {card.details.split('\n').map((item, i) => (
                      <div key={i} className="checklist-item">
                        <span className="check-bullet" style={{ color: card.color }}>✓</span>
                        <span className="check-text">{item.replace('✓ ', '').replace('✓', '').trim()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="card-theory-box">
                    <span className="theory-bulb">💡</span>
                    <p className="theory-text">{card.theoreticalInfo}</p>
                  </div>
                </div>

                <div className="card-footer">
                  <span className="card-status-badge">{card.stats}</span>
                  <button className="module-launch-btn" style={{ background: card.gradient }}>
                    <span>Launch</span>
                    <span className="launch-arrow">→</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default Home;
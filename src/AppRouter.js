// AppRouter.js - Complete fixed version
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './Home';
import BarcodeGenerator from './BarcodeGenerator';
import BarcodeScanner from './BarcodeScanner';
import ManualStickerCreate from './ManualStickerCreate';
import PartyProfile from './PartyProfile';
import PartySelection from './PartySelection';
import PartyBill from './PartyBill';
import PackingCopy from './PackingCopy';
import DraftPackingList from './DraftPackingList';
import DispatchDetails from './DispatchDetails';
import ManagementDispatchDetail from './ManagementDispatchDetail';
import StickerGenerator from './StickerGenerator';
import GatepassGenerator from './GatepassGenerator';
import GatepassDetails from './GatepassDetails';
import Login from './Login';
import PrivateRoute from './PrivateRoute';
import Unauthorized from './Unauthorized';
import TodayDispatchDetail from './TodayDispatchDetails';

function AppRouter() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('isAuthenticated') === 'true'
  );
  const [userRole, setUserRole] = useState('');
  const [userData, setUserData] = useState(null);

  // Function to load user data from localStorage
  const loadUserData = () => {
    const storedUserData = localStorage.getItem('userData');
    if (storedUserData) {
      try {
        const parsedUserData = JSON.parse(storedUserData);
        setUserData(parsedUserData);
        setUserRole(parsedUserData.role || '');
        console.log("Loaded user data:", parsedUserData);
        console.log("User role set to:", parsedUserData.role);
        return parsedUserData;
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
    return null;
  };

  useEffect(() => {
    // Initial load
    loadUserData();

    // Listen for storage changes (for logout from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === 'userData' || e.key === 'isAuthenticated') {
        const auth = localStorage.getItem('isAuthenticated') === 'true';
        setIsAuthenticated(auth);
        if (auth) {
          loadUserData();
        } else {
          setUserData(null);
          setUserRole('');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for auth changes within the app
    const handleAuthChange = () => {
      const auth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(auth);
      if (auth) {
        loadUserData();
      } else {
        setUserData(null);
        setUserRole('');
      }
    };
    
    window.addEventListener('authChange', handleAuthChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []);

  const handleLogin = (userData) => {
    console.log('User logged in:', userData);
    setIsAuthenticated(true);
    setUserData(userData);
    setUserRole(userData.role || '');
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? 
            <Navigate to="/" replace /> : 
            <Login onLogin={handleLogin} />
          } 
        />
        
        <Route path="/unauthorized" element={<Unauthorized />} />
        
        {/* Public routes - accessible to all authenticated users */}
        <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/barcode" element={<PrivateRoute><BarcodeGenerator /></PrivateRoute>} />
        <Route path="/packing-copy" element={<PrivateRoute><PackingCopy /></PrivateRoute>} />
        
        {/* Gatepass Details with role and user data - FIXED */}
        <Route path="/gatepass-details" element={
          <PrivateRoute>
            <GatepassDetails 
              userRole={userRole}
              userData={userData}
              onBack={() => window.history.back()}
            />
          </PrivateRoute>
        } />
        
        {/* Team Member and above routes */}
        <Route path="/barcode-scanner" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <BarcodeScanner />
          </PrivateRoute>
        } />
        <Route path="/party-profile" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <PartyProfile />
          </PrivateRoute>
        } />
        <Route path="/manual-sticker" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <ManualStickerCreate onBack={() => window.history.back()} />
          </PrivateRoute>
        } />
        <Route path="/party-selection" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <PartySelection />
          </PrivateRoute>
        } />
        <Route path="/sticker-generator" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <StickerGenerator />
          </PrivateRoute>
        } />
        <Route path="/gatepass-generator" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <GatepassGenerator />
          </PrivateRoute>
        } />
        <Route path="/draft-packing" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <DraftPackingList />
          </PrivateRoute>
        } />
        <Route path="/user-dispatch-details" element={
          <PrivateRoute requiredRoles={['Team Member', 'Supervisor', 'Manager', 'Administrator']}>
            <TodayDispatchDetail />
          </PrivateRoute>
        } />
        
        {/* Manager and above routes */}
        <Route path="/party-bill" element={
          <PrivateRoute requiredRoles={['Manager', 'Administrator', 'Team Member']}>
            <PartyBill />
          </PrivateRoute>
        } />
        <Route path="/dispatch-details" element={
          <PrivateRoute requiredRoles={['Manager', 'Administrator']}>
            <DispatchDetails />
          </PrivateRoute>
        } />
        <Route path="/management-dispatch" element={
          <PrivateRoute requiredRoles={['Manager', 'Administrator']}>
            <ManagementDispatchDetail />
          </PrivateRoute>
        } />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default AppRouter;
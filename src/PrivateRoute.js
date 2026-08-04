// PrivateRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';

function PrivateRoute({ children, requiredRoles = null }) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const userDataStr = localStorage.getItem('userData');
  const userData = userDataStr ? JSON.parse(userDataStr) : null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // Check role-based access if requiredRoles is specified
  if (requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // Admin has access to everything
    if (userData?.role === 'Administrator') {
      return children;
    }
    
    // Check if user's role is allowed
    if (!roles.includes(userData?.role)) {
      return <Navigate to="/unauthorized" />;
    }
  }
  
  return children;
}

export default PrivateRoute;
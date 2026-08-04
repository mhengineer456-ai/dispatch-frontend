// useRoleAccess.js
import { useEffect, useState } from 'react';

export const useRoleAccess = () => {
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const userDataStr = localStorage.getItem('userData');
    if (userDataStr) {
      const data = JSON.parse(userDataStr);
      setUserData(data);
      setUserRole(data.role);
    }
  }, []);

  const hasAccess = (requiredRoles) => {
    if (!userRole) return false;
    
    // If requiredRoles is a string, convert to array
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    // Admin has access to everything
    if (userRole === 'Administrator') return true;
    
    // Check if user's role is in the allowed roles
    return roles.includes(userRole);
  };

  const getAccessLevel = () => {
    switch(userRole) {
      case 'Administrator': return 4;
      case 'Manager': return 3;
      case 'Supervisor': return 2;
      case 'Team Member': return 1;
      default: return 0;
    }
  };

  const canEdit = () => {
    const level = getAccessLevel();
    return level >= 2; // Supervisor and above can edit
  };

  const canDelete = () => {
    const level = getAccessLevel();
    return level >= 3; // Manager and above can delete
  };

  const canViewReports = () => {
    const level = getAccessLevel();
    return level >= 1; // All authenticated users can view reports
  };

  const canManageUsers = () => {
    return userRole === 'Administrator'; // Only admin can manage users
  };

  return {
    userRole,
    userData,
    hasAccess,
    getAccessLevel,
    canEdit,
    canDelete,
    canViewReports,
    canManageUsers
  };
};
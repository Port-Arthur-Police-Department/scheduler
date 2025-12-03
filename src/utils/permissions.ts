// Create a new file: utils/permissions.ts
export const checkPermissions = (userRole: string, requiredRole: 'officer' | 'supervisor' | 'admin') => {
  const roleHierarchy = {
    'officer': 1,
    'supervisor': 2,
    'admin': 3
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

export const canEditSchedule = (userRole: string) => {
  return userRole === 'supervisor' || userRole === 'admin';
};

export const canViewAuditLogs = (userRole: string) => {
  return userRole === 'admin'; // Only admins can view audit logs
};

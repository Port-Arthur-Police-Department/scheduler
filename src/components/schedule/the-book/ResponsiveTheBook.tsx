import React from 'react';
import TheBook from './TheBook';
import TheBookMobile from './TheBookMobile';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveTheBookProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
  userCurrentShift?: string; // ADD THIS
}

export const ResponsiveTheBook: React.FC<ResponsiveTheBookProps> = ({
  userRole,
  isAdminOrSupervisor,
  userCurrentShift = "all" // ADD THIS with default
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <TheBookMobile 
        userRole={userRole}
        isAdminOrSupervisor={isAdminOrSupervisor}
        userCurrentShift={userCurrentShift} // PASS TO MOBILE
      />
    );
  }

  return (
    <TheBook 
      userRole={userRole}
      isAdminOrSupervisor={isAdminOrSupervisor}
      userCurrentShift={userCurrentShift} // PASS TO DESKTOP
    />
  );
};

export default ResponsiveTheBook;

import React from 'react';
import TheBook from './TheBook';
import TheBookMobile from './TheBookMobile';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsiveTheBookProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
}

export const ResponsiveTheBook: React.FC<ResponsiveTheBookProps> = ({
  userRole,
  isAdminOrSupervisor
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <TheBookMobile 
        userRole={userRole}
        isAdminOrSupervisor={isAdminOrSupervisor}
      />
    );
  }

  return (
    <TheBook 
      userRole={userRole}
      isAdminOrSupervisor={isAdminOrSupervisor}
    />
  );
};

export default ResponsiveTheBook;

import React from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import TheBook from './TheBook';
import TheBookMobile from './TheBookMobile';

interface ResponsiveTheBookProps {
  userRole?: 'officer' | 'supervisor' | 'admin';
  isAdminOrSupervisor?: boolean;
}

export const ResponsiveTheBook: React.FC<ResponsiveTheBookProps> = ({
  userRole,
  isAdminOrSupervisor
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

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

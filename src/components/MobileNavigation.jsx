import React from 'react';

const MobileNavigation = ({ activeTab, onTabChange, isAdminOrSupervisor, isAdmin, isSupervisor }) => {
  // Define tabs based on user role
  const adminTabs = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'schedule', label: 'Weekly', icon: '📋' },
    { id: 'officers', label: 'Officers', icon: '👥' },
    { id: 'vacancies', label: 'Vacancies', icon: '⚠️' },
    { id: 'staff', label: 'Staff', icon: '👤' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const supervisorTabs = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'schedule', label: 'Weekly', icon: '📋' },
    { id: 'officers', label: 'Officers', icon: '👥' },
    { id: 'vacancies', label: 'Vacancies', icon: '⚠️' },
    { id: 'staff', label: 'Staff', icon: '👤' }
  ];

  const officerTabs = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'schedule', label: 'Weekly', icon: '📋' }
  ];

  // Use isAdmin and isSupervisor to determine tabs
  const tabs = isAdmin ? adminTabs : (isSupervisor ? supervisorTabs : officerTabs);

  return (
    <div className="mobile-bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`mobile-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="mobile-tab-icon">{tab.icon}</span>
          <span className="mobile-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MobileNavigation;

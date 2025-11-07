import React from 'react';
import { Link, useLocation } from "react-router-dom";

const MobileNavigation = ({ activeTab, onTabChange, isAdminOrSupervisor }) => {
  // Define tabs based on user role
  const adminTabs = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'schedule', label: 'Weekly', icon: '📋' },
    { id: 'officers', label: 'Officers', icon: '👥' },
    { id: 'vacancies', label: 'Vacancies', icon: '⚠️' },
    { id: 'staff', label: 'Staff', icon: '👤' },
    { id: 'requests', label: 'Time Off', icon: '⏰' }
  ];

  const officerTabs = [
    { id: 'daily', label: 'Daily', icon: '📅' },
    { id: 'schedule', label: 'Weekly', icon: '📋' },
    { id: 'vacancies', label: 'Alerts', icon: '⚠️' },
    { id: 'requests', label: 'Time Off', icon: '⏰' }
  ];

  const tabs = isAdminOrSupervisor ? adminTabs : officerTabs;

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

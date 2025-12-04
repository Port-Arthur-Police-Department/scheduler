// src/components/MobileNavigation.jsx
import React, { useRef, useState } from 'react';
import { MoreVertical, ChevronLeft, ChevronRight, Home, Calendar, Users, AlertTriangle, Settings, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const MobileNavigation = ({ activeTab, onTabChange, isAdminOrSupervisor, isAdmin }) => {
  const tabsContainerRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Core tabs that are always visible
  const coreTabs = [
    { id: 'daily', label: 'Daily', icon: <Home className="h-5 w-5" /> },
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="h-5 w-5" /> },
  ];

  // Additional tabs for admin/supervisor
  const additionalTabs = isAdminOrSupervisor ? [
    { id: 'officers', label: 'Officers', icon: <Users className="h-5 w-5" /> },
    { id: 'vacancies', label: 'Vacancies', icon: <AlertTriangle className="h-5 w-5" /> },
  ] : [];

  // All visible tabs (core + additional)
  const visibleTabs = [...coreTabs, ...additionalTabs];

  // More options (for overflow)
  const moreOptions = isAdmin ? [
    { id: 'staff', label: 'Staff', icon: <Users className="h-5 w-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ] : [];

  const scrollTabs = (direction) => {
    if (tabsContainerRef.current) {
      const scrollAmount = 100;
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;
      
      tabsContainerRef.current.scrollTo({
        left: newPosition,
        behavior: 'smooth'
      });
      setScrollPosition(newPosition);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-bottom">
      <div className="px-2 py-2">
        <div className="relative flex items-center">
          {/* Left scroll button */}
          {scrollPosition > 0 && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 z-10 bg-background p-1 shadow-sm rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Tab container with horizontal scroll */}
          <div
            ref={tabsContainerRef}
            className="flex flex-1 overflow-x-auto scrollbar-hide px-8"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex space-x-1">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`
                    flex flex-col items-center justify-center flex-shrink-0 p-2 min-w-[70px]
                    rounded-lg transition-colors
                    ${activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  <div className="mb-1">{tab.icon}</div>
                  <span className="text-xs font-medium truncate">
                    {tab.label}
                  </span>
                </button>
              ))}

              {/* More options dropdown */}
              {moreOptions.length > 0 && (
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="flex flex-col items-center justify-center flex-shrink-0 p-2 min-w-[70px] rounded-lg text-muted-foreground hover:bg-muted">
                      <MoreVertical className="h-5 w-5 mb-1" />
                      <span className="text-xs font-medium">More</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[50vh] rounded-t-xl">
                    <div className="pt-6">
                      <h3 className="font-semibold text-lg mb-4">More Options</h3>
                      <div className="space-y-2">
                        {moreOptions.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              onTabChange(option.id);
                              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                            }}
                            className={`
                              flex items-center w-full p-3 rounded-lg text-left
                              ${activeTab === option.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                              }
                            `}
                          >
                            <span className="mr-3">{option.icon}</span>
                            <span>{option.label}</span>
                          </button>
                        ))}
                        <div className="pt-4 mt-4 border-t">
                          <button
                            onClick={() => {
                              // Add your sign out logic here
                            }}
                            className="flex items-center w-full p-3 rounded-lg text-left text-destructive hover:bg-destructive/10"
                          >
                            <LogOut className="h-5 w-5 mr-3" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>

          {/* Right scroll button */}
          {tabsContainerRef.current && 
           scrollPosition < tabsContainerRef.current.scrollWidth - tabsContainerRef.current.clientWidth && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 z-10 bg-background p-1 shadow-sm rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default MobileNavigation;

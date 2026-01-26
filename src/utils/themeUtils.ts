// utils/themeUtils.ts
export const cleanInlineStyles = (element: HTMLElement) => {
  if (!element) return;
  
  // Check if dark mode is enabled
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  if (isDarkMode) {
    // Remove problematic inline styles
    if (element.style.backgroundColor === 'rgb(240, 248, 255)' || 
        element.style.backgroundColor === 'aliceblue') {
      element.style.backgroundColor = '';
      element.classList.add('bg-card', 'dark:bg-card');
    }
    
    if (element.style.borderColor === 'rgb(240, 248, 255)' || 
        element.style.borderColor === 'aliceblue') {
      element.style.borderColor = '';
      element.classList.add('border-border', 'dark:border-border');
    }
    
    if (element.style.color === 'rgb(255, 255, 255)' || 
        element.style.color === 'white') {
      element.style.color = '';
      element.classList.add('text-foreground', 'dark:text-foreground');
    }
  }
};

export const cleanAllInlineStyles = () => {
  if (typeof document === 'undefined') return;
  
  const isDarkMode = document.documentElement.classList.contains('dark');
  if (!isDarkMode) return;
  
  // Find all elements with inline styles
  const elements = document.querySelectorAll('[style*="background-color"]');
  elements.forEach(el => {
    const element = el as HTMLElement;
    cleanInlineStyles(element);
  });
};

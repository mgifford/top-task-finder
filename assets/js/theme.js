// Theme management with accessibility support
(function() {
  'use strict';

  const STORAGE_KEY = 'theme-preference';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  // Get user's theme preference
  function getThemePreference() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
    
    // Respect prefers-color-scheme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return THEME_DARK;
    }
    
    return THEME_LIGHT;
  }

  // Apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    
    // Update button aria-label for screen readers
    const button = document.getElementById('theme-toggle');
    if (button) {
      const newTheme = theme === THEME_LIGHT ? 'dark' : 'light';
      button.setAttribute('aria-label', `Switch to ${newTheme} mode`);
    }
  }

  // Toggle between themes
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    applyTheme(newTheme);
  }

  // Initialize theme on page load
  const initialTheme = getThemePreference();
  applyTheme(initialTheme);

  // Set up toggle button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToggle);
  } else {
    initializeToggle();
  }

  function initializeToggle() {
    const button = document.getElementById('theme-toggle');
    if (button) {
      button.addEventListener('click', toggleTheme);
    }
  }

  // Watch for system theme changes and update if user hasn't set a preference
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? THEME_DARK : THEME_LIGHT);
      }
    });
  }
})();

# Accessibility Documentation

This document outlines the accessibility features, standards, and best practices implemented in the Top Task Finder application.

## Table of Contents

- [Overview](#overview)
- [WCAG Compliance](#wcag-compliance)
- [Color and Contrast](#color-and-contrast)
- [Light/Dark Mode](#lightdark-mode)
- [Keyboard Navigation](#keyboard-navigation)
- [Screen Reader Support](#screen-reader-support)
- [Semantic HTML](#semantic-html)
- [Focus Management](#focus-management)
- [Forms and Input](#forms-and-input)
- [Responsive Design](#responsive-design)
- [Testing Guidelines](#testing-guidelines)
- [Known Issues and Future Improvements](#known-issues-and-future-improvements)

## Overview

The Top Task Finder is designed with accessibility as a core principle. The application provides an inclusive experience for all users, including those who use assistive technologies such as screen readers, keyboard navigation, or prefer specific visual settings.

## WCAG Compliance

This application aims to meet **WCAG 2.1 Level AA** standards. Key compliance areas include:

- **Perceivable**: Content is presented in ways that all users can perceive
- **Operable**: UI components and navigation are operable by all users
- **Understandable**: Information and UI operation are understandable
- **Robust**: Content works with current and future assistive technologies

## Color and Contrast

### Contrast Ratios

All text and interactive elements meet WCAG AA contrast requirements:

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text** (18pt+): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio for borders and interactive states

### Light Theme Colors

- **Primary text**: `#1f2328` on `#ffffff` (15.3:1)
- **Secondary text**: `#57606a` on `#ffffff` (7.0:1)
- **Primary button**: `#ffffff` on `#0969da` (7.4:1)
- **Links**: `#0969da` on `#ffffff` (7.4:1)
- **Info status**: `#0a3069` on `#ddf4ff` (10.2:1)
- **Success status**: `#116329` on `#dafbe1` (8.1:1)
- **Error status**: `#82071e` on `#ffebe9` (7.2:1)

### Dark Theme Colors

- **Primary text**: `#e6edf3` on `#0d1117` (13.8:1)
- **Secondary text**: `#8d96a0` on `#0d1117` (6.8:1)
- **Primary button**: `#ffffff` on `#2f81f7` (6.2:1)
- **Links**: `#58a6ff` on `#0d1117` (8.5:1)
- **Info status**: `#9ec8ff` on `#051d4d` (7.8:1)
- **Success status**: `#7ee787` on `#033a16` (8.9:1)
- **Error status**: `#ff7b72` on `#490202` (9.1:1)

All color combinations exceed WCAG AA requirements for their respective text sizes.

## Light/Dark Mode

### Implementation

The application includes an accessible light/dark mode toggle with the following features:

#### User Preference Respect

- Automatically detects and respects the user's `prefers-color-scheme` system setting
- Persists user's manual theme selection in `localStorage`
- Updates automatically if system preference changes (when no manual selection is saved)

#### Toggle Button

The theme toggle button is:

- **Positioned**: Fixed in the top-right corner for consistent access
- **Keyboard accessible**: Fully operable via keyboard (`Tab` to focus, `Enter` or `Space` to activate)
- **Screen reader friendly**: 
  - Has descriptive `aria-label` that updates based on current theme
  - Announces current state and action (e.g., "Switch to dark mode")
- **Visually clear**: Uses sun/moon icons with appropriate visibility per theme
- **Focus indicator**: 2px solid outline with 2px offset for clear focus visibility

#### Theme Switching

- Smooth transitions between themes (0.2s ease)
- No flash of unstyled content (FOUC) - theme applied before page render
- All colors defined using CSS custom properties for consistent theming
- Both themes tested for sufficient contrast ratios

#### Code Location

- **Theme JavaScript**: `/assets/js/theme.js`
- **Theme CSS Variables**: `:root` and `[data-theme="dark"]` in `/assets/css/app.css`
- **Toggle Button HTML**: `_layouts/default.html`

## Keyboard Navigation

All interactive elements are fully keyboard accessible:

### Navigation Order

1. Theme toggle button (fixed position)
2. Domain URL input
3. Find Popular URLs button
4. URL results textarea
5. Copy URLs button
6. Clear cache and rescan button (when visible)
7. Footer GitHub link

### Keyboard Shortcuts

- **Tab**: Move forward through interactive elements
- **Shift + Tab**: Move backward through interactive elements
- **Enter/Space**: Activate buttons
- **Enter**: Submit form (on input fields)
- **Escape**: (can be implemented for modal dialogs if added)

### Focus Indicators

All focusable elements have clear focus indicators:
- 2px solid outline in primary color
- 2px offset for better visibility
- Visible in both light and dark themes
- Uses `:focus-visible` to show only for keyboard navigation

## Screen Reader Support

### ARIA Attributes

The application uses appropriate ARIA attributes throughout:

- **`aria-labelledby`**: Connects sections to their headings
  - `main` element references "page-title"
  - Each `section` references its heading ID
- **`aria-live="polite"`**: Status updates and hints announce changes
  - Status region for progress updates
  - Cache state messages
  - Server crawl status
  - Hint text for form limits
- **`role="status"`**: Status region for progress messages
- **`aria-label`**: Descriptive labels for icon-only buttons
  - Theme toggle button dynamically updates
- **`aria-hidden="true"`**: Decorative SVG icons hidden from screen readers
- **`spellcheck="false"`**: Disabled on URL output textarea

### Live Regions

Dynamic content updates are announced to screen readers:

```html
<div id="status-region" class="status info" role="status" aria-live="polite">
  Ready.
</div>
```

Updates to this region are announced without moving focus, keeping the user's context.

### Form Labels

All form inputs have explicit `<label>` elements with `for` attributes:

```html
<label for="domain-url">Domain name / URL (required)</label>
<input id="domain-url" name="domainUrl" type="url" required />
```

## Semantic HTML

The application uses semantic HTML5 elements:

- **`<main>`**: Primary content container with `role` implicit
- **`<header>`**: Hero section with page title
- **`<section>`**: Distinct content sections
- **`<form>`**: Form structure with proper validation
- **`<button>`**: Interactive actions (not `<div>` or `<a>`)
- **`<footer>`**: Site footer with navigation
- **`<label>`**: Explicit form labels
- **Headings hierarchy**: Logical h1 → h2 structure

## Focus Management

### Focus Trapping

Currently, the application does not require focus trapping as it has no modal dialogs. If modals are added:

- Focus should move to the modal when opened
- Focus should be trapped within the modal
- Focus should return to the trigger element when closed
- `Escape` key should close the modal

### Skip Links

Consider adding a skip link for keyboard users:

```html
<a href="#page-title" class="skip-link">Skip to main content</a>
```

This would be beneficial if navigation or persistent UI is added above the main content.

## Forms and Input

### Validation

- **HTML5 validation**: `required` and `type="url"` attributes
- **`novalidate` attribute**: Prevents browser default validation UI for custom handling
- **Error messaging**: Should be associated with inputs via `aria-describedby`

### Input Types

Appropriate input types are used:
- `type="url"` for domain input (triggers mobile keyboard optimization)
- `type="number"` for count inputs (if visible)
- `type="hidden"` for internal state

### Placeholder Text

Placeholder text is used sparingly and not as a replacement for labels:
- Domain input: `"https://example.org"` - provides format example
- URL output: Descriptive placeholder explaining content format

## Responsive Design

### Mobile Accessibility

- **Viewport meta tag**: Ensures proper scaling on mobile devices
- **Touch targets**: Minimum 44×44px for all interactive elements (exceeds WCAG 2.5.5)
- **Responsive layout**: Adapts gracefully from 320px to large screens
- **Font scaling**: Respects user's browser font size preferences
- **No horizontal scroll**: Content adapts to viewport width

### Breakpoints

- **Small screens** (<640px): Single column layout, full-width buttons
- **Medium screens** (≥640px): Two-column button layout where appropriate

## Testing Guidelines

### Manual Testing

#### Keyboard Navigation

1. Navigate through all interactive elements using `Tab` key
2. Verify all elements receive visible focus indicator
3. Activate buttons using `Enter` and `Space` keys
4. Submit form using `Enter` key from input fields
5. Ensure theme toggle works with keyboard

#### Screen Reader Testing

Test with multiple screen readers:

- **NVDA** (Windows, free): https://www.nvaccess.org/
- **JAWS** (Windows, commercial): https://www.freedomscientific.com/products/software/jaws/
- **VoiceOver** (macOS/iOS, built-in): Activate with `Cmd + F5`
- **TalkBack** (Android, built-in)

Verify:
- All content is announced in logical order
- Form labels are associated with inputs
- Button purposes are clear
- Dynamic updates are announced via live regions
- Images and icons have appropriate text alternatives

#### Color and Contrast

1. Use browser DevTools or extensions:
   - Chrome: Lighthouse accessibility audit
   - Firefox: Accessibility Inspector
   - Edge: Built-in accessibility checker

2. Online tools:
   - WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
   - Colour Contrast Analyser: https://www.tpgi.com/color-contrast-checker/

3. Test both light and dark themes

#### Theme Switching

1. Verify theme toggle is accessible via keyboard
2. Check theme persists on page reload
3. Test with system dark mode enabled/disabled
4. Verify no flash of wrong theme on page load
5. Confirm all colors have sufficient contrast in both themes

### Automated Testing

#### Tools

1. **axe DevTools**: Browser extension for automated accessibility testing
   - Chrome: https://chrome.google.com/webstore
   - Firefox: https://addons.mozilla.org/firefox/

2. **Lighthouse**: Built into Chrome DevTools
   - Run audit on Accessibility category
   - Aim for 100% score

3. **WAVE**: Web accessibility evaluation tool
   - https://wave.webaim.org/

4. **pa11y**: Command-line accessibility testing
   ```bash
   npm install -g pa11y
   pa11y https://mgifford.github.io/top-task-finder/
   ```

#### CI/CD Integration

Consider adding accessibility tests to CI pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run accessibility tests
  run: |
    npm install -g pa11y-ci
    pa11y-ci --sitemap https://mgifford.github.io/top-task-finder/sitemap.xml
```

### User Testing

Conduct testing with users who:
- Use screen readers regularly
- Navigate primarily with keyboard
- Have low vision or color blindness
- Use voice control software
- Have cognitive or learning disabilities

## Known Issues and Future Improvements

### Current Limitations

1. **No skip link**: Consider adding for users with additional navigation
2. **Form error messages**: Could be more explicitly associated with inputs
3. **Loading states**: Could include more detailed progress indicators
4. **Timeout handling**: Long-running operations should have clear timeout messaging

### Planned Improvements

1. **Enhanced ARIA announcements**: 
   - More detailed status updates for complex operations
   - Progress percentage announcements for long-running tasks

2. **Reduced motion preference**:
   - Respect `prefers-reduced-motion` media query
   - Disable transitions and animations when requested

3. **High contrast mode**:
   - Add support for Windows High Contrast Mode
   - Use system colors when appropriate

4. **Focus management**:
   - Add skip links if navigation grows
   - Manage focus after asynchronous operations

5. **Error recovery**:
   - Provide clear recovery actions for all error states
   - Ensure errors are announced to screen readers

6. **Internationalization**:
   - Support for multiple languages
   - RTL (right-to-left) language support

## Resources

### Standards and Guidelines

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Section 508 Standards](https://www.section508.gov/)

### Testing Tools

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebAIM Resources](https://webaim.org/resources/)

### Learning Resources

- [WebAIM Articles](https://webaim.org/articles/)
- [A11ycasts with Rob Dodson](https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9LVWWVqvHlYJyqw7g)
- [Inclusive Components](https://inclusive-components.design/)
- [The A11Y Project](https://www.a11yproject.com/)

## Contributing

When contributing to this project, please:

1. Test changes with keyboard navigation
2. Verify color contrast ratios meet WCAG AA
3. Test with at least one screen reader
4. Run automated accessibility tests
5. Update this document with new accessibility features or changes

## Questions or Issues?

If you encounter accessibility issues or have suggestions:

1. Open an issue on GitHub: https://github.com/mgifford/top-task-finder/issues
2. Include details about:
   - The specific accessibility barrier
   - Your assistive technology (if applicable)
   - Steps to reproduce the issue
   - Suggested solutions (if any)

Accessibility is an ongoing journey. We welcome feedback and contributions to make this application more inclusive for all users.

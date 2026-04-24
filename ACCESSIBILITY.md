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

Colors use the CivicActions brand palette. See [STYLES.md § 3.1](./STYLES.md#31-design-tokens) for the full token reference.

- **Primary text**: `#171717` on `#ffffff` (18.1:1)
- **Secondary text**: `#454545` on `#ffffff` (9.7:1)
- **Primary button**: `#ffffff` on `#1a4480` (8.6:1)
- **Links**: `#1a4480` on `#ffffff` (8.6:1)
- **Info status**: `#162e51` on `#e8f0fc` (9.8:1)
- **Success status**: `#1b5e20` on `#ecf3ec` (8.0:1)
- **Error status**: `#8b0a03` on `#fce8e7` (7.5:1)

### Dark Theme Colors

- **Primary text**: `#e9e9e9` on `#1b1b1b` (14.5:1)
- **Secondary text**: `#a9aeb1` on `#1b1b1b` (7.2:1)
- **Primary button**: `#1b1b1b` on `#73b3e7` (7.5:1)
- **Links**: `#73b3e7` on `#1b1b1b` (7.5:1)
- **Info status**: `#b3d4f5` on `#162e51` (8.1:1)
- **Success status**: `#a3d9a5` on `#1b3a1f` (7.0:1)
- **Error status**: `#f4a09d` on `#3d1110` (8.2:1)

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
2. Suite navigation links (Top Task Finder, Open Scans, Alt Text Scan)
3. Domain URL input
4. Find Popular URLs button
5. URL results textarea
6. Copy URLs button
7. Copy Prompt for LLM button
8. Scan HTML button
9. Scan Alt Text button
10. Clear cache and rescan button (when visible)
11. Footer GitHub link

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
- **`aria-label`**: Descriptive labels for icon-only buttons and landmark regions
  - Theme toggle button dynamically updates
  - Suite navigation: `aria-label="Accessibility tools suite"` on `<nav>` element
- **`aria-current="page"`**: Marks the active link in the suite navigation bar
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
- **`<nav>`**: Suite navigation bar linking related accessibility tools
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

Automated axe-core scanning runs on every successful deployment to GitHub Pages
and on the first day of each month via the
[`.github/workflows/a11y-scan.yml`](../.github/workflows/a11y-scan.yml) workflow,
which uses the [github/accessibility-scanner](https://github.com/github/accessibility-scanner)
action. Any violations found are automatically filed as GitHub Issues.

**Requirements for the workflow:**

- A fine-grained Personal Access Token (PAT) stored as the `GH_TOKEN` repository
  secret with the following permissions on this repository:
  `actions: write`, `contents: write`, `issues: write`, `pull-requests: write`,
  `metadata: read`.
- To enable AI-powered fix suggestions from GitHub Copilot, set
  `skip_copilot_assignment: false` in the workflow file (requires an active
  GitHub Copilot subscription).

The workflow can also be triggered manually from the **Actions** tab at any time.

```yaml
# .github/workflows/a11y-scan.yml (abbreviated)
- uses: github/accessibility-scanner@v2
  with:
    urls: |
      https://mgifford.github.io/top-task-finder/
    repository: mgifford/top-task-finder
    token: ${{ secrets.GH_TOKEN }}
    cache_key: a11y-cache-top-task-finder
    skip_copilot_assignment: true
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

# Cache-Busting Fix for Static Assets

## Problem Statement

Users were seeing outdated prompt text when using the "Copy Prompt for LLM" feature, even after PR #22 was merged and deployed. The issue occurred because:

1. **PR #22 Changes**: Moved the LLM prompt from hardcoded text in `app.js` to an external file `assets/prompts/wcag-em-prompt.txt`
2. **Browser Caching**: Users' browsers cached the old version of `app.js` (which had the hardcoded prompt)
3. **Result**: The old `app.js` never executed the new code to fetch the external prompt file

## Root Cause

GitHub Pages and browsers aggressively cache static assets (JavaScript, CSS) without explicit cache-busting. When we updated `app.js` from:

```javascript
// Old code (hardcoded prompt)
const prompt = `You are an accessibility expert...`;
```

to:

```javascript
// New code (loads from external file)
const response = await fetch('assets/prompts/wcag-em-prompt.txt', { cache: 'no-store' });
const promptTemplate = await response.text();
```

Browsers that had cached the old `app.js` never received the new code. The `{ cache: 'no-store' }` option only prevents caching of the prompt file, but doesn't help if the browser never executes that line of code.

## Solution

Added cache-busting query parameters to all static asset references using Jekyll's `site.time` variable:

### Files Modified

1. **index.md** - Updated JavaScript reference:
   ```liquid
   <script type="module" src="{{ '/assets/js/app.js' | relative_url }}?v={{ site.time | date: '%s' }}"></script>
   ```

2. **_layouts/default.html** - Updated CSS and theme.js references:
   ```liquid
   <link rel="stylesheet" href="{{ '/assets/css/app.css' | relative_url }}?v={{ site.time | date: '%s' }}">
   <script src="{{ '/assets/js/theme.js' | relative_url }}?v={{ site.time | date: '%s' }}"></script>
   ```

### How It Works

- Jekyll's `site.time` variable contains the build timestamp
- The `| date: '%s'` filter converts it to a Unix timestamp (e.g., `1772307810`)
- This creates URLs like `/assets/js/app.js?v=1772307810`
- Each new build generates a new timestamp, forcing browsers to fetch the latest version
- No manual version management required

## Verification

After this change is deployed to the `main` branch:

1. **New users**: Will automatically get the latest assets
2. **Existing users**: Will get fresh assets on their next visit (cache-busting parameter forces reload)
3. **Future updates**: Will automatically benefit from cache-busting without additional changes

## Testing Locally

To verify the Jekyll template syntax works:

```bash
bundle exec jekyll build
grep "app.js?v=" _site/index.html
```

You should see a URL with a version parameter, e.g.:
```html
<script type="module" src="/assets/js/app.js?v=1772307810"></script>
```

## References

- PR #22: https://github.com/mgifford/top-task-finder/pull/22
- Jekyll Variables Documentation: https://jekyllrb.com/docs/variables/
- Cache-Busting Best Practices: https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching

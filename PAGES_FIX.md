# GitHub Pages Artifact Upload Timeout - Resolution

## Problem
The GitHub-managed Pages workflow (`dynamic/pages/pages-build-deployment`) was failing with artifact upload timeouts:
```
Error: Failed to CreateArtifact: Failed to make request after 5 attempts: Request timeout: /twirp/github.actions.results.api.v1.ArtifactService/CreateArtifact
```

## Root Cause
The artifact upload timeout is a transient issue with GitHub Actions infrastructure. The built-in GitHub Pages workflow uses `actions/upload-pages-artifact@v3` which can sometimes experience API timeouts.

## Solution
Created a custom Jekyll deployment workflow (`.github/workflows/jekyll-pages.yml`) that:

1. **Replaces the GitHub-managed workflow** with a custom one that provides more control
2. **Uses the latest actions** with proper configuration:
   - `actions/checkout@v4`
   - `ruby/setup-ruby@v1` with bundler caching
   - `actions/configure-pages@v5`
   - `actions/upload-pages-artifact@v3` with explicit configuration
   - `actions/deploy-pages@v4`

3. **Includes best practices**:
   - Proper permissions (`contents: read`, `pages: write`, `id-token: write`)
   - Concurrency control to prevent multiple deployments
   - Bundler caching for faster builds
   - Retention period of 1 day for artifacts
   - Proper base path configuration from `configure-pages`

## What to Do Next

### Option 1: Use the Custom Workflow (Recommended)
1. The workflow file `.github/workflows/jekyll-pages.yml` has been created
2. Go to repository Settings → Pages
3. Under "Build and deployment", change Source to "GitHub Actions" (if not already set)
4. The custom workflow will run on the next push to `main` or can be triggered manually
5. This workflow will have the same functionality as the built-in one but with more reliability

### Option 2: Retry the Failed Workflow
If this was a one-time transient issue:
1. Go to https://github.com/mgifford/top-task-finder/actions/runs/22446039858
2. Click "Re-run failed jobs"
3. The timeout might not occur on retry

### Option 3: Wait for Automatic Retry
GitHub Pages automatically retries failed deployments, so it may resolve itself.

## Benefits of Custom Workflow
- **More control**: Can adjust timeout settings, artifact retention, and other parameters
- **Better debugging**: Can see exact steps and modify them if needed
- **Consistency**: Locks in specific action versions for reproducibility
- **Caching**: Ruby bundler caching speeds up builds
- **Resilience**: Custom workflows can be more resilient to transient issues

## Testing
To test the new workflow:
1. Push a change to the `main` branch, or
2. Go to Actions → Deploy Jekyll site to Pages → Run workflow

The workflow will build the Jekyll site and deploy it to GitHub Pages.

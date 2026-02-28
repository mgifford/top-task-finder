# Branch Cleanup Documentation

This document describes the process of cleaning up all feature branches that have been merged into the `main` branch.

## Status

All feature branches have been successfully merged into the `main` branch as of commit `49f35a0` (PR #18).

## Branches to be Deleted

The following 18 branches have been merged into `main` and should be deleted:

1. `copilot/add-cache-clearing-action`
2. `copilot/add-footer-light-dark-mode`
3. `copilot/add-html-focus-modal-dialog`
4. `copilot/add-modal-dialog-for-results`
5. `copilot/check-accessibility-languages`
6. `copilot/crawl-duckduckgo-results`
7. `copilot/debug-url-retrieval-issues`
8. `copilot/fix-console-log-errors`
9. `copilot/fix-error-in-top-task-finder`
10. `copilot/fix-github-action-caching-issue`
11. `copilot/fix-github-dispatch-error`
12. `copilot/fix-github-pages-gem-warning`
13. `copilot/fix-server-crawl-404-errors`
14. `copilot/improve-url-testing-list`
15. `copilot/investigate-artifact-errors`
16. `copilot/merge-branches-and-resolve-issues`
17. `copilot/optimize-result-representation`
18. `copilot/update-va-url-patterns`

## Deletion Methods

### Method 1: Using the Provided Script (Recommended)

Run the `delete-branches.sh` script from the repository root:

```bash
./delete-branches.sh
```

The script will:
- Prompt for confirmation before proceeding
- Delete each branch one at a time
- Provide status updates for each deletion
- Show a summary at the end with any failed deletions

### Method 2: Manual Deletion via Git CLI

Delete branches manually using git commands:

```bash
# Delete a single branch
git push origin --delete copilot/add-cache-clearing-action

# Or delete multiple branches at once
git push origin --delete \
  copilot/add-cache-clearing-action \
  copilot/add-footer-light-dark-mode \
  copilot/add-html-focus-modal-dialog \
  copilot/add-modal-dialog-for-results \
  copilot/check-accessibility-languages \
  copilot/crawl-duckduckgo-results \
  copilot/debug-url-retrieval-issues \
  copilot/fix-console-log-errors \
  copilot/fix-error-in-top-task-finder \
  copilot/fix-github-action-caching-issue \
  copilot/fix-github-dispatch-error \
  copilot/fix-github-pages-gem-warning \
  copilot/fix-server-crawl-404-errors \
  copilot/improve-url-testing-list \
  copilot/investigate-artifact-errors \
  copilot/merge-branches-and-resolve-issues \
  copilot/optimize-result-representation \
  copilot/update-va-url-patterns
```

### Method 3: Using GitHub Web Interface

1. Go to the repository on GitHub: https://github.com/mgifford/top-task-finder
2. Click on the "Branches" tab (showing the count of branches)
3. For each branch listed above:
   - Find the branch in the list
   - Click the trash icon to delete it
   - Confirm the deletion

### Method 4: Using GitHub CLI (gh)

If you have the GitHub CLI installed:

```bash
# Delete branches using gh
gh api repos/mgifford/top-task-finder/git/refs/heads/copilot/add-cache-clearing-action -X DELETE
gh api repos/mgifford/top-task-finder/git/refs/heads/copilot/add-footer-light-dark-mode -X DELETE
# ... continue for each branch
```

Or use a loop:

```bash
for branch in \
  copilot/add-cache-clearing-action \
  copilot/add-footer-light-dark-mode \
  copilot/add-html-focus-modal-dialog \
  copilot/add-modal-dialog-for-results \
  copilot/check-accessibility-languages \
  copilot/crawl-duckduckgo-results \
  copilot/debug-url-retrieval-issues \
  copilot/fix-console-log-errors \
  copilot/fix-error-in-top-task-finder \
  copilot/fix-github-action-caching-issue \
  copilot/fix-github-dispatch-error \
  copilot/fix-github-pages-gem-warning \
  copilot/fix-server-crawl-404-errors \
  copilot/improve-url-testing-list \
  copilot/investigate-artifact-errors \
  copilot/merge-branches-and-resolve-issues \
  copilot/optimize-result-representation \
  copilot/update-va-url-patterns
do
  echo "Deleting $branch..."
  gh api "repos/mgifford/top-task-finder/git/refs/heads/$branch" -X DELETE
done
```

## Final Steps

After deleting all the above branches:

1. **Merge this PR** (`copilot/delete-other-branches`)
2. **Delete the PR branch** (`copilot/delete-other-branches`) after the merge
3. **Verify cleanup** by running:
   ```bash
   git ls-remote --heads origin
   ```
   
   You should only see the `main` branch:
   ```
   49f35a08d57a092b3a1155f6ec78f1992efb4843	refs/heads/main
   ```

## Verification

To verify all branches have been deleted, run:

```bash
# Check remote branches
git ls-remote --heads origin

# Should only show:
# <commit-sha>  refs/heads/main
```

To verify locally that all branches were merged:

```bash
# Show branches merged into main
git branch -r --merged origin/main

# Should show all the branches listed above
```

## Troubleshooting

### Permission Denied Error

If you get a permission denied error:
```
remote: Permission to mgifford/top-task-finder.git denied to <user>.
fatal: unable to access 'https://github.com/mgifford/top-task-finder/': The requested URL returned error: 403
```

This means you don't have push/delete permissions. You need to:
1. Be a repository admin or have appropriate permissions
2. Use a GitHub token with `repo` scope
3. Ask the repository owner to delete the branches

### Branch Not Found Error

If a branch doesn't exist, you'll see:
```
error: unable to delete 'branch-name': remote ref does not exist
```

This is fine - the branch was already deleted. Continue with the others.

### Branch Protection Rules

If branch protection rules prevent deletion, you may need to:
1. Temporarily disable branch protection for the branches
2. Delete the branches
3. Re-enable protection for `main` if needed

## Notes

- The `main` branch should have branch protection rules enabled to prevent accidental deletion
- All code from the feature branches is preserved in the `main` branch
- The commit history is preserved in `main` showing all the merged PRs
- After cleanup, the repository will only have one branch: `main`

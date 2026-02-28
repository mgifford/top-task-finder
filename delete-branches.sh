#!/bin/bash
# Script to delete all branches except main
# This script should be run by someone with appropriate GitHub repository permissions

echo "This script will delete all branches except 'main' from the remote repository."
echo "Make sure all branches have been merged into main before running this script."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# List of branches to delete (excluding main and the current PR branch)
branches_to_delete=(
    "copilot/add-cache-clearing-action"
    "copilot/add-footer-light-dark-mode"
    "copilot/add-html-focus-modal-dialog"
    "copilot/add-modal-dialog-for-results"
    "copilot/check-accessibility-languages"
    "copilot/crawl-duckduckgo-results"
    "copilot/debug-url-retrieval-issues"
    "copilot/fix-console-log-errors"
    "copilot/fix-error-in-top-task-finder"
    "copilot/fix-github-action-caching-issue"
    "copilot/fix-github-dispatch-error"
    "copilot/fix-github-pages-gem-warning"
    "copilot/fix-server-crawl-404-errors"
    "copilot/improve-url-testing-list"
    "copilot/investigate-artifact-errors"
    "copilot/merge-branches-and-resolve-issues"
    "copilot/optimize-result-representation"
    "copilot/update-va-url-patterns"
)

echo "Deleting ${#branches_to_delete[@]} branches..."
echo ""

failed_branches=()

for branch in "${branches_to_delete[@]}"; do
    echo "Deleting branch: $branch"
    if git push origin --delete "$branch"; then
        echo "✓ Successfully deleted: $branch"
    else
        echo "✗ Failed to delete: $branch"
        failed_branches+=("$branch")
    fi
    echo ""
done

echo "================================"
echo "Deletion Summary"
echo "================================"
echo "Total branches to delete: ${#branches_to_delete[@]}"
echo "Failed deletions: ${#failed_branches[@]}"

if [ ${#failed_branches[@]} -eq 0 ]; then
    echo ""
    echo "✓ All branches were successfully deleted!"
    echo ""
    echo "Next steps:"
    echo "1. Delete the copilot/delete-other-branches branch after merging this PR"
    echo "2. Verify only the 'main' branch remains: git ls-remote --heads origin"
else
    echo ""
    echo "✗ The following branches failed to delete:"
    for branch in "${failed_branches[@]}"; do
        echo "  - $branch"
    done
    echo ""
    echo "You may need to:"
    echo "1. Check if you have the necessary permissions"
    echo "2. Verify the branches exist in the remote repository"
    echo "3. Check if there are any branch protection rules preventing deletion"
fi

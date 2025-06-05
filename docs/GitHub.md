# 1. Make sure you're on main and up to date
git checkout main
git pull origin main

# 2. Create and switch to a new feature branch
git checkout -b michael/fix router

# 3. Add the updated files
git add pages/api/analytics/dashboard-ui.ts
git add pages/api/analytics/installs/[locationId]/ui.ts

# 4. Commit with a descriptive message
git commit -m "fix: Analytics charts infinite expansion and add navigation

-fixed router"

# 5. Push the branch to GitHub
git push origin michael/fix router

# 6. GitHub will show a message to create a PR
# Go to: https://github.com/dronequote/LPai-App
# Click the green "Compare & pull request" button
# Create the PR and merge it

# 7. After merging, switch back to main and clean up
git checkout main
git pull origin main
git branch -d michael/fix router
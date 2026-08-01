# Patel Rudra's Developer Portfolio - Practical 3 API Integration

This React + Vite developer portfolio features dynamic styling and API integration.

## Practical 3: API Integration & Data Rendering

The **Projects** page is designed to consume data dynamically from the GitHub REST API and manage asynchronous loading/error states.

### Features
1. **GitHub API Integration**: Fetches public repositories for `PatelRudra9` via `https://api.github.com/users/PatelRudra9/repos`.
2. **Conditional Rendering**:
   - **Loading State**: Displays a refined, animated spinner while fetching is active.
   - **Error State**: Displays a custom Error Message warning box if network issues occur or the API endpoint is unavailable.
3. **Interactive Testing Utility**: Included buttons to toggle the API URL between a **Happy Path** (valid endpoint) and a **Break URL** (invalid endpoint) to easily demonstrate error handling and testing.
4. **Retry Functionality**: A "Retry Connection" button on the error panel permits triggering the request again.
5. **Search Filter**: A responsive input bar that filters repositories by name instantly.
6. **Detailed Repository Cards**: Renders repository name, description, primary coding language, fork count, star count (`stargazers_count` with a ⭐ icon), and a link to view the repo directly on GitHub.

### Setup & Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
   Or build for production:
   ```bash
   npm run build
   ```


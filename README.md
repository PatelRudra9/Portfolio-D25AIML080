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
6. **Detailed Repository Cards**: Renders repository name, description, primary coding language, fork count, star count (`stargazers_count` with a â­ icon), and a link to view the repo directly on GitHub.

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

## Practical 13: AI-Powered Feature (Task Description Assistant)

The **Task Management** app (`/tasks` route) includes an AI-assisted description generator powered by the **Google Gemini API**, with **OpenAI as an automatic fallback**.

### How it works
1. Type a task title (e.g. *"Prepare DBMS viva notes"*) and click the **✨ AI Suggest** button under the description field.
2. The frontend sends the title to `POST /ai/suggest-description` (authenticated).
3. The backend calls Gemini (`gemini-3.8-flash` by default) with a constrained prompt + JSON response schema and returns a 2–4 sentence draft description. If Gemini is unavailable (e.g. free tier not enabled for the Google project), it automatically retries with OpenAI (`gpt-4o-mini`) when an `OPENAI_API_KEY` is configured.
4. The suggestion appears **inside the editable description textarea** so the user can review, tweak, or discard it before saving.

### Responsible AI practices
- **Key stays on the backend**: `GEMINI_API_KEY` is read only in `task-manager-api/.env` (never a `VITE_` var, never sent to the browser).
- **Human in the loop**: a visible banner — *"AI-generated suggestion. Please review before saving."* — accompanies every suggestion, with a **Discard suggestion** button that restores the previous draft. Nothing is saved without the user pressing *Add Task*.
- **Meaningful purpose**: auto-drafts task descriptions from the title, saving typing while keeping the user in control.

### Graceful error handling (core app always keeps working)
| Situation | Response |
|---|---|
| `GEMINI_API_KEY` not configured | `503` + friendly toast; form works normally |
| Gemini times out (15 s server / 25 s client) | `504` + toast: *"The AI took too long to respond."* |
| Gemini rate-limits (`429`) | `429` + toast: *"The AI service is busy right now."* |
| Network / upstream failure | `502` + toast; user can type the description manually |
| Empty AI response | `502` + toast: *"The AI returned an empty suggestion."* |

Task creation, editing, status changes and logs are completely independent of the AI call.

### Setup
1. **Gemini (primary):** get a free key at [Google AI Studio](https://aistudio.google.com/apikey).
   - If Google returns *"The Gemini API free tier is not available for this project"*, enable billing at [aistudio.google.com/billing](https://aistudio.google.com/billing) or use a different Google account's project.
2. **OpenAI (optional fallback):** get a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
3. Add the key(s) to `task-manager-api/.env` (never to the frontend `.env`):
   ```env
   GEMINI_API_KEY=your-gemini-key
   OPENAI_API_KEY=your-openai-key        # optional automatic fallback
   # Optional overrides:
   # GEMINI_MODEL=gemini-3.8-flash
   # OPENAI_MODEL=gpt-4o-mini
   # AI_TIMEOUT_MS=15000
   ```
4. Restart the backend (`npm start` in `task-manager-api/`) and open `http://localhost:5173/tasks`.


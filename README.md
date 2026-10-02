# Game Matchup Web App

This repository contains the full stack for a "Would You Rather" style game matchup application. It allows users to vote between two games, updating a global Elo rating for each game in real-time.

## Architecture

*   **Database (`/database`):** A MySQL database storing game metadata and global Elo ratings.
*   **Backend (`/backend`):** A serverless API built on Cloudflare Workers. It uses Cloudflare Hyperdrive to pool TCP connections to the MySQL database, ensuring the database isn't overwhelmed by serverless cold starts.
*   **Frontend (`/frontend`):** A React Single Page Application built with Vite. It features optimistic UI updates, an automated matchmaking algorithm (pairing games with similar Elo ratings), and background syncing to prevent local drift during long sessions.

---

## 1. Database Setup (`/database`)

This folder contains the schema and migration scripts to seed the database with initial game data.

### Prerequisites
*   Node.js installed
*   A MySQL server (publicly accessible or exposed via Cloudflare Tunnels)
*   A `data.json` file containing your game array.

### Setup Instructions
1.  Navigate into the database folder: `cd database`
2.  Install dependencies: `npm install`
3.  Place your `data.json` file inside the `database` folder.
4.  Execute the `schema.sql` file on your MySQL server to create the `games` table.
5.  Edit `migrate.js` to include your MySQL credentials (`host`, `user`, `password`, `database`).
6.  Run the migration script to populate the database:
    ```bash
    npm start
    ```

---

## 2. Backend / API (`/backend`)

The backend is a Cloudflare Worker that handles fetching games, calculating new Elo ratings, and updating the database atomically.

### Setup Instructions
1.  Navigate into the backend folder: `cd backend`
2.  Install dependencies: `npm install`
3.  Update the `wrangler.toml` file:
    *   Uncomment the `[[hyperdrive]]` section and insert your **Hyperdrive ID**.
    *   *Note: Cloudflare Hyperdrive requires `disableEval: true` in the `mysql2` configuration, which is already handled in `src/index.js`.*
4.  **Local Development:**
    To run the worker locally for testing:
    ```bash
    npm run dev
    ```
5.  **Deployment:**
    To deploy the worker globally to Cloudflare's edge:
    ```bash
    npm run deploy
    ```
    This will output a live URL (e.g., `https://game-matchup-backend.<your-username>.workers.dev`).

---

## 3. Frontend (`/frontend`)

The frontend is a lightweight React application utilizing React Router and Canvas Confetti.

### Setup Instructions
1.  Navigate into the frontend folder: `cd frontend`
2.  Install dependencies: `npm install`
3.  **Link to Backend:**
    Open `src/App.jsx` and modify the `API_URL` constant at the top of the file to point to your live Cloudflare Worker URL from the previous step.
    ```javascript
    export const API_URL = 'https://game-matchup-backend.<your-username>.workers.dev';
    ```
4.  **Local Development:**
    To start the Vite development server with hot-reloading:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

5.  **Build & Deploy:**
    To create an optimized production build:
    ```bash
    npm run build
    ```
    This will generate a `dist/` folder containing static HTML, CSS, and JS files. These files can be hosted for free on **GitHub Pages**, **Cloudflare Pages**, or **Vercel**.

## Contributing
*   When editing the `mysql2` worker code, ensure you do not use native prepared statements, as Cloudflare Hyperdrive for MySQL relies on the text protocol (`connection.query` rather than `connection.execute`).

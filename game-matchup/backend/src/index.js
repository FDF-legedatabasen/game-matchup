import mysql from 'mysql2/promise';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Update this to your GitHub Pages URL later for better security
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper to handle CORS preflight requests
function handleOptions() {
  return new Response(null, {
    headers: CORS_HEADERS,
  });
}

// Function to establish a database connection
async function connectToDb(env) {
  // If Hyperdrive is configured, extract credentials and disable eval
  if (env.HYPERDRIVE && env.HYPERDRIVE.connectionString) {
    const url = new URL(env.HYPERDRIVE.connectionString);
    return await mysql.createConnection({
      host: url.hostname,
      port: url.port || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      disableEval: true
    });
  }

  // Fallback if connecting directly via a Cloudflare Tunnel without Hyperdrive
  return await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASS || '',
    database: env.DB_NAME || 'games_db',
    disableEval: true
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      // 1. GET /api/games
      if (request.method === 'GET' && url.pathname === '/api/games') {
        const connection = await connectToDb(env);
        const [rows] = await connection.query(
          'SELECT id, name, teaser, image_path, elo_rating, matches_played FROM games WHERE state = 1'
        );
        await connection.end();

        return new Response(JSON.stringify(rows), {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300', // Cache for 5 mins
          },
        });
      }

      // 2. GET /api/leaderboard
      if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
        const connection = await connectToDb(env);
        const [rows] = await connection.query(
          'SELECT id, name, elo_rating, matches_played, image_path FROM games ORDER BY elo_rating DESC LIMIT 50'
        );
        await connection.end();

        return new Response(JSON.stringify(rows), {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60', // Cache for 1 min
          },
        });
      }

      // 3. POST /api/vote
      if (request.method === 'POST' && url.pathname === '/api/vote') {
        const body = await request.json();
        const { winner_id, loser_id } = body;

        if (!winner_id || !loser_id) {
          return new Response('Missing IDs', { status: 400, headers: CORS_HEADERS });
        }

        const connection = await connectToDb(env);

        // Start transaction
        await connection.beginTransaction();

        try {
          // Fetch current ratings
          const [rows] = await connection.query(
            'SELECT id, elo_rating FROM games WHERE id IN (?, ?) FOR UPDATE',
            [winner_id, loser_id]
          );

          if (rows.length !== 2) {
            throw new Error('One or both games not found');
          }

          const winner = rows.find(r => r.id === winner_id);
          const loser = rows.find(r => r.id === loser_id);

          // Calculate new Elo (K = 32)
          const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo_rating - winner.elo_rating) / 400));
          const expectedLoser = 1 / (1 + Math.pow(10, (winner.elo_rating - loser.elo_rating) / 400));

          const newWinnerElo = Math.round(winner.elo_rating + 32 * (1 - expectedWinner));
          const newLoserElo = Math.round(loser.elo_rating + 32 * (0 - expectedLoser));

          // Update ratings
          await connection.query(
            'UPDATE games SET elo_rating = ?, matches_played = matches_played + 1 WHERE id = ?',
            [newWinnerElo, winner_id]
          );
          await connection.query(
            'UPDATE games SET elo_rating = ?, matches_played = matches_played + 1 WHERE id = ?',
            [newLoserElo, loser_id]
          );

          await connection.commit();
          await connection.end();

          return new Response(JSON.stringify({ success: true, newWinnerElo, newLoserElo }), {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          await connection.rollback();
          await connection.end();
          throw error;
        }
      }

      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};

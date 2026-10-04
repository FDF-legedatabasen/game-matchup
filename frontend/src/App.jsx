import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Voting from './components/Voting';
import Leaderboard from './components/Leaderboard';

// Replace this with your deployed Cloudflare Worker URL
export const API_URL = 'https://game-matchup-backend.jonasholmhansen.workers.dev'; 

function App() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch games on initial load
  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      if (!response.ok) throw new Error('Failed to fetch games');
      const data = await response.json();
      setGames(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching games:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading games...</div>;
  }

  return (
    <HashRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={
            <>
              <header className="app-header">
                <h1>Hvilken leg vil du helst lege?</h1>
              </header>
              <Voting games={games} setGames={setGames} />
            </>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;

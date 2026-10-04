import React, { useState, useEffect } from 'react';
import { API_URL } from '../App';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard`)
      .then(res => res.json())
      .then(data => {
        setLeaders(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading leaderboard...</div>;

  return (
    <div className="leaderboard-wrapper">
      <div className="leaderboard-container">
        <h2>Top Games</h2>
        <div className="leaderboard-list">
          {leaders.map((game, index) => (
            <div key={game.id} className="leaderboard-item">
              <div className="rank">#{index + 1}</div>
              <img src={game.image_path} alt={game.name} className="leaderboard-img" />
              <div className="details">
                <h3>{game.name}</h3>
                <div className="stats">
                  <span>Elo: {game.elo_rating}</span>
                  <span>Matches: {game.matches_played}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { API_URL } from '../App';

export default function Voting({ games, setGames }) {
  const [currentMatchup, setCurrentMatchup] = useState([]);
  const [seenMatchups, setSeenMatchups] = useState(new Set());
  const [votesCast, setVotesCast] = useState(0);

  // Initialize first matchup when games load
  useEffect(() => {
    if (games.length >= 2 && currentMatchup.length === 0) {
      pickNextMatchup(games, seenMatchups);
    }
  }, [games]);

  // Background sync every 10 votes
  useEffect(() => {
    if (votesCast > 0 && votesCast % 10 === 0) {
      syncGamesFromBackend();
    }
  }, [votesCast]);

  const syncGamesFromBackend = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games`);
      if (response.ok) {
        const freshGames = await response.json();
        // We do a naive replace here. For a truly seamless experience,
        // you'd merge so that the *current* matchup's Elo isn't jarringly changed.
        setGames(freshGames);
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  };

  const pickNextMatchup = (currentGames, currentSeen) => {
    if (currentGames.length < 2) return;

    let game1, game2;
    let attempts = 0;
    const maxAttempts = 50; // Prevent infinite loop

    while (attempts < maxAttempts) {
      game1 = currentGames[Math.floor(Math.random() * currentGames.length)];
      
      // Define bracket (+/- 150 Elo)
      let bracket = currentGames.filter(g => 
        g.id !== game1.id && 
        Math.abs(g.elo_rating - game1.elo_rating) <= 150
      );

      // If bracket is empty, expand it by taking any other game
      if (bracket.length === 0) {
        bracket = currentGames.filter(g => g.id !== game1.id);
      }

      game2 = bracket[Math.floor(Math.random() * bracket.length)];

      const matchupKey = `${Math.min(game1.id, game2.id)}-${Math.max(game1.id, game2.id)}`;

      if (!currentSeen.has(matchupKey)) {
        setCurrentMatchup([game1, game2]);
        return;
      }
      attempts++;
    }

    // Fallback if we couldn't find a new matchup (extremely rare or small dataset)
    const randomG1 = currentGames[Math.floor(Math.random() * currentGames.length)];
    const others = currentGames.filter(g => g.id !== randomG1.id);
    const randomG2 = others[Math.floor(Math.random() * others.length)];
    setCurrentMatchup([randomG1, randomG2]);
  };

  const handleVote = async (winnerId, loserId, event) => {
    // 1. Visual Polish
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({ origin: { x, y }, particleCount: 50, spread: 60 });

    // 2. History Update
    const matchupKey = `${Math.min(winnerId, loserId)}-${Math.max(winnerId, loserId)}`;
    const newSeen = new Set(seenMatchups).add(matchupKey);
    setSeenMatchups(newSeen);
    setVotesCast(prev => prev + 1);

    // 3. Local Elo Update (Optimistic)
    const updatedGames = games.map(g => {
      if (g.id === winnerId) return { ...g, elo_rating: g.elo_rating + 15 };
      if (g.id === loserId) return { ...g, elo_rating: g.elo_rating - 15 };
      return g;
    });
    setGames(updatedGames);

    // 4. Next Match
    pickNextMatchup(updatedGames, newSeen);

    // 5. Network Request (Non-blocking)
    fetch(`${API_URL}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winner_id: winnerId, loser_id: loserId }),
    }).catch(err => console.error('Vote submission failed:', err));
  };

  if (currentMatchup.length !== 2) return <div>Loading matchup...</div>;

  return (
    <div className="matchup-container">
      <h2>Which game do you prefer?</h2>
      <div className="cards-wrapper">
        {currentMatchup.map(game => {
          const otherGame = currentMatchup.find(g => g.id !== game.id);
          return (
            <div 
              key={game.id} 
              className="game-card" 
              onClick={(e) => handleVote(game.id, otherGame.id, e)}
            >
              <img src={game.image_path} alt={game.name} />
              <h3>{game.name}</h3>
              <p>{game.teaser}</p>
            </div>
          );
        })}
      </div>
      <div className="vote-counter">
        Votes cast this session: {votesCast}
      </div>
    </div>
  );
}

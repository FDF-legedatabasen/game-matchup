import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'react-qr-code';
import { API_URL } from '../App';

export default function Voting({ games, setGames }) {
  const [currentMatchup, setCurrentMatchup] = useState([]);
  const [seenMatchups, setSeenMatchups] = useState(() => {
    try {
      const savedSeen = localStorage.getItem('seenMatchups');
      return savedSeen ? new Set(JSON.parse(savedSeen)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Sync seenMatchups to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('seenMatchups', JSON.stringify(Array.from(seenMatchups)));
  }, [seenMatchups]);

  // Sync currentMatchup to localStorage whenever it changes
  useEffect(() => {
    if (currentMatchup.length === 2) {
      localStorage.setItem('currentMatchupIds', JSON.stringify([currentMatchup[0].id, currentMatchup[1].id]));
    }
  }, [currentMatchup]);
  const [votesCast, setVotesCast] = useState(0);
  const [activeQR, setActiveQR] = useState({});
  const [showSkip, setShowSkip] = useState(false);
  const sessionVoteCount = useRef(0);

  useEffect(() => {
    setShowSkip(false);
    const timer = setTimeout(() => {
      setShowSkip(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [currentMatchup]);

  const toggleQR = (e, gameId, type, url) => {
    e.stopPropagation();

    if (window.innerWidth <= 768) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    setActiveQR(prev => ({
      ...prev,
      [gameId]: prev[gameId] === type ? null : type
    }));
  };

  // Initialize first matchup when games load
  useEffect(() => {
    if (games.length >= 2 && currentMatchup.length === 0) {
      try {
        const savedMatchupIds = JSON.parse(localStorage.getItem('currentMatchupIds'));
        if (savedMatchupIds && savedMatchupIds.length === 2) {
          const game1 = games.find(g => g.id === savedMatchupIds[0]);
          const game2 = games.find(g => g.id === savedMatchupIds[1]);
          if (game1 && game2) {
            setCurrentMatchup([game1, game2]);
            return;
          }
        }
      } catch (e) {
        console.error('Error loading matchup from localStorage', e);
      }
      
      // Fallback if no saved matchup or if the saved games don't exist
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
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      game1 = currentGames[Math.floor(Math.random() * currentGames.length)];

      // Define bracket (+/- 150 Elo)
      let bracket = currentGames.filter(g =>
        g.id !== game1.id &&
        Math.abs(g.elo_rating - game1.elo_rating) <= 150
      );

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

    // Fallback
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
    confetti({ origin: { x, y }, particleCount: 60, spread: 70 });

    // 2. History Update
    const matchupKey = `${Math.min(winnerId, loserId)}-${Math.max(winnerId, loserId)}`;
    const newSeen = new Set(seenMatchups).add(matchupKey);
    setSeenMatchups(newSeen);
    sessionVoteCount.current += 1;
    console.log(`Votes this session: ${sessionVoteCount.current}`);
    setVotesCast(sessionVoteCount.current);

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

  if (currentMatchup.length !== 2) {
    return <div className="loading">Loading matchup...</div>;
  }

  return (
    <>
      <div className="matchup-container">
        {currentMatchup.map(game => {
          const otherGame = currentMatchup.find(g => g.id !== game.id);
          return (
            <div
              key={game.id}
              className="game-panel"
              style={{ backgroundImage: `url(${game.image_path})` }}
              onClick={(e) => handleVote(game.id, otherGame.id, e)}
            >
              <div className="panel-content">
                <div className="action-buttons">
                  <button 
                    className="action-button"
                    onClick={(e) => toggleQR(e, game.id, 'slug', `https://legedatabasen.dk/leg/${game.slug}`)}
                  >
                    Se hele legen
                  </button>
                  {game.video && game.video !== 'null' && game.video !== '-' && game.video !== '' && (
                    <button 
                      className="action-button"
                      onClick={(e) => toggleQR(e, game.id, 'video', `https://www.youtube.com/watch?v=${game.video}`)}
                    >
                      Se video
                    </button>
                  )}
                </div>
                {activeQR[game.id] === 'slug' && (
                  <div className="qr-container" onClick={e => e.stopPropagation()}>
                    <QRCode value={`https://legedatabasen.dk/leg/${game.slug}`} size={160} />
                  </div>
                )}
                {activeQR[game.id] === 'video' && (
                  <div className="qr-container" onClick={e => e.stopPropagation()}>
                    <QRCode value={`https://www.youtube.com/watch?v=${game.video}`} size={160} />
                  </div>
                )}
                <h2 className="panel-name">{game.name}</h2>
                <p className="panel-teaser">{game.teaser}</p>
              </div>
            </div>
          );
        })}

        {/* OR badge sits inside the relative container so it tracks the divider */}
        {/*<div className="or-badge">OR</div>*/}
      </div>
      <header className="app-header">
        <h1>Hvilken leg vil du helst lege?</h1>
        <button 
          className={`skip-button ${showSkip ? 'show' : ''}`}
          onClick={() => {
            if (showSkip) {
              pickNextMatchup(games, seenMatchups);
              setShowSkip(false);
            }
          }}
          aria-hidden={!showSkip}
          tabIndex={showSkip ? 0 : -1}
        >
          🤔 Det ved jeg ikke, giv' mig 2 nye lege 
        </button>
      </header>
    </>
  );
}

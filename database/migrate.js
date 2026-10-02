import fs from 'fs';
import mysql from 'mysql2/promise';
import 'dotenv/config';

// Credentials are now securely loaded from the .env file
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'games_db',
  port: parseInt(process.env.DB_PORT) || 3306 
};

// IMPORTANT: Move your data.json into this phase1-db folder
const JSON_FILE_PATH = './data.json'; 

async function migrate() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(DB_CONFIG);

    console.log(`Reading data from ${JSON_FILE_PATH}...`);
    const rawData = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    const { games } = JSON.parse(rawData);

    console.log(`Found ${games.length} games. Starting migration...`);

    for (const game of games) {
      const query = `
        INSERT IGNORE INTO games (
          id, name, teaser, description1Html, description2Html, description3Html,
          type, popularity, slug, favorite, ageGroup, durationGroup,
          participantsGroup, image_path, thumbnail_path, video, area,
          extra_description2, tips, materials, categories, tags, state
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `;

      const values = [
        game.id,
        game.name,
        game.teaser || null,
        game.description1Html || null,
        game.description2Html || null,
        game.description3Html || null,
        game.type || null,
        game.popularity || null,
        game.slug || null,
        game.favorite || false,
        game.ageGroup || null,
        game.durationGroup || null,
        game.participantsGroup || null,
        game.image_path || null,
        game.thumbnail_path || null,
        game.video || null,
        game.area || null,
        game.extra_description2 || null,
        game.tips || null,
        game.materials || null,
        JSON.stringify(game.categories || []),
        JSON.stringify(game.tags || []),
        game.state || 0
      ];

      await connection.execute(query, values);
      console.log(`Inserted game: ${game.id} - ${game.name}`);
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();

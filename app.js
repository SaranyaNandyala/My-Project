const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');


const API_KEY = 'XXXXXXXXXXXXXXXXXXXXXX';

const app = express();
const port = 3000;

const db = new sqlite3.Database('./weather.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the weather database.');
});


db.run(`CREATE TABLE IF NOT EXISTS weather_cache (
  location TEXT PRIMARY KEY,
  data TEXT,
  timestamp INTEGER
)`);

app.use(express.static('public'));
app.use(express.json());

app.get('/weather/:location', async (req, res) => {
  const location = req.params.location;
  console.log(`Received request for location: ${location}`);

  try {
    
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM weather_cache WHERE location = ?', [location], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const now = Math.floor(Date.now() / 1000);
    if (row && now - row.timestamp < 3600) { // Cache for 1 hour
      console.log('Returning cached data');
      return res.json(JSON.parse(row.data));
    }

    
    console.log('Fetching from API');
    const response = await axios.get(`http://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${API_KEY}&units=metric`);
    const weatherData = response.data;
    console.log('API response:', weatherData);

    
    await new Promise((resolve, reject) => {
      db.run('INSERT OR REPLACE INTO weather_cache (location, data, timestamp) VALUES (?, ?, ?)',
        [location, JSON.stringify(weatherData), now], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });

    res.json(weatherData);
  } catch (error) {
    console.error('Error details:', error);
    if (error.response) {
      console.error('API error response:', error.response.data);
    }
    res.status(500).json({ error: 'Error fetching weather data', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


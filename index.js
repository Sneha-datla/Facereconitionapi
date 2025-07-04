// server.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const { loadModels, getDescriptor, euclideanDistance } = require('./faceUtils');

const app = express();
const PORT = 5000;

// Multer setup
const upload = multer({ dest: 'uploads/' });

(async () => {
  await loadModels();
  console.log('Models loaded');
})();

// Register API
app.post('/register', upload.single('image'), async (req, res) => {
  const { username } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imagePath = req.file.path;

  try {
    const descriptor = await getDescriptor(imagePath);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO fusers (id, username, descriptor) VALUES ($1, $2, $3)',
      [userId, username, Array.from(descriptor)]  // Ensure it's an array
    );

    fs.unlinkSync(imagePath);
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    fs.unlinkSync(imagePath);
    res.status(500).json({ error: err.message });
  }
});

// Login API
app.post('/login', upload.single('image'), async (req, res) => {
  const imagePath = req.file.path;

  try {
    const inputDescriptor = await getDescriptor(imagePath);

    const result = await pool.query('SELECT id, username, descriptor FROM fusers');
    let matchedUser = null;

    for (let row of result.rows) {
      const dist = euclideanDistance(inputDescriptor, row.descriptor);
      if (dist < 0.6) {
        matchedUser = row;
        break;
      }
    }

    fs.unlinkSync(imagePath); // cleanup

    if (matchedUser) {
      res.json({ message: 'Login successful', user: matchedUser.username });
    } else {
      res.status(401).json({ message: 'Face not recognized' });
    }
  } catch (err) {
    fs.unlinkSync(imagePath);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

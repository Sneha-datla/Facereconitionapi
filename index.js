const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const { loadModels, getDescriptor, euclideanDistance } = require('./faceUtils');

const app = express();
const PORT = 5000;

// Ensure temporary upload directory exists (Render supports only /tmp)
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer setup using diskStorage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// Load face recognition models
(async () => {
  await loadModels();
  console.log('Models loaded');
})();

// Register API
app.post('/register', upload.single('image'), async (req, res) => {
  const { username } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imagePath = file.path;
  console.log('Register image uploaded at:', imagePath);

  try {
    const descriptor = await getDescriptor(imagePath);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO fusers (id, username, descriptor) VALUES ($1, $2, $3)',
      [userId, username, Array.from(descriptor)]
    );

    fs.unlinkSync(imagePath); // Clean up the uploaded image
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    fs.unlinkSync(imagePath);
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login API (unchanged, but you can update it similarly)
app.post('/login', upload.single('image'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const imagePath = file.path;

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

    fs.unlinkSync(imagePath);

    if (matchedUser) {
      res.json({ message: 'Login successful', user: matchedUser.username });
    } else {
      res.status(401).json({ message: 'Face not recognized' });
    }
  } catch (err) {
    fs.unlinkSync(imagePath);
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

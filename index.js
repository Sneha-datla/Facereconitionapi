// server.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const { loadModels, getDescriptor, euclideanDistance } = require('./faceUtils');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Create uploads/ directory if it doesn't exist
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ✅ Custom multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

(async () => {
  await loadModels();
  console.log('✅ Models loaded');
})();

// ✅ Register route
app.post('/register', upload.single('descriptor'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image file missing. Use key name "image".' });
  }

  const { username } = req.body;
  const imagePath = req.files;

  try {
    const descriptor = await getDescriptor(imagePath);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO fusers (id, username, descriptor) VALUES ($1, $2, $3)',
      [userId, username, JSON.stringify(Array.from(descriptor))]
    );

    fs.unlinkSync(imagePath); // delete after use
    res.json({ message: 'User registered successfully' });
  } catch (err) {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    console.error('Register Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
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

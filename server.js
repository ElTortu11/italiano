require('dotenv').config();
const express = require('express');
const path = require('path');
const { createSchema } = require('./database/schema');

createSchema();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/api'));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Italiano App → http://localhost:${PORT}`));

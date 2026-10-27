const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.ADMIN_PORT || 3600;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[CryptoHub AI Admin Web Dashboard] Running on http://localhost:${PORT}`);
});

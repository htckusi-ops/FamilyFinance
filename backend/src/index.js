require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // run migrations on startup

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/allowance', require('./routes/allowance'));
app.use('/api/points',    require('./routes/points'));
app.use('/api/rewards',   require('./routes/rewards'));
app.use('/api/flea',      require('./routes/flea'));
app.use('/api/badges',    require('./routes/badges'));
app.use('/api/backup',    require('./routes/backup'));
app.use('/api/notify',    require('./routes/notify'));
app.use('/api/tokens',    require('./routes/tokens'));
app.use('/api/ha',        require('./routes/ha'));
app.use('/api/settings',  require('./routes/settings'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

require('./jobs/cron');

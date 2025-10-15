'use strict';
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const apiRoutes = require('./routes/api');

const app = express();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Seguridad para FCC tests
app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));

// Rutas API
app.use('/api', apiRoutes);

// Página raíz
app.get('/', (req, res) => {
  res.send('Anonymous Message Board API');
});

// Conexión a DB
const DB = process.env.DB || 'mongodb://127.0.0.1:27017/messageboard';
const PORT = process.env.PORT || 3000;

mongoose.set('strictQuery', false);

mongoose.connect(DB)
  .then(() => {
    // Solo muestra mensaje si no es modo test
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
    }
  })
  .catch(err => console.error('❌ DB connection error:', err));

module.exports = app; // export para tests

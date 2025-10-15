'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');

const app = express();

// =================== Middlewares ===================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Configuraciones de seguridad requeridas por los tests FCC
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');          // Test 2
  res.setHeader('X-DNS-Prefetch-Control', 'off');           // Test 3
  res.setHeader('Referrer-Policy', 'same-origin');          // Test 4
  next();
});

// También aplicamos Helmet (sin CSP para evitar conflictos)
app.use(helmet({ contentSecurityPolicy: false }));

// =================== Rutas ===================
app.use('/api', apiRoutes);

// Página raíz
app.get('/', (req, res) => {
  res.send('Anonymous Message Board API is running');
});

// =================== Conexión a MongoDB ===================
const PORT = process.env.PORT || 3000;
  const DB = process.env.DB || 'mongodb://127.0.0.1:27017/messageboard';

mongoose.set('strictQuery', false);

mongoose.connect(DB)
  .then(() => {
    // Solo muestra mensaje si no es modo test
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
    }
  })
  .catch(err => console.error('❌ DB connection error:', err));

module.exports = app;

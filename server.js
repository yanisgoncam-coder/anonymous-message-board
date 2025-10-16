'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const apiRoutes = require('./routes/api');

const app = express();

// =================== Seguridad (Tests 2, 3, 4) ===================
// Test 2: Solo permitir iFrame del mismo sitio
// Test 3: Bloquear DNS prefetching
// Test 4: Referrer solo del mismo origen
app.use(
  helmet({
    frameguard: { action: 'sameorigin' },
    dnsPrefetchControl: { allow: false },
    referrerPolicy: { policy: 'same-origin' },
    contentSecurityPolicy: false, // evitar conflictos FCC
  })
);

// =================== Middlewares ===================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =================== Rutas ===================
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('Anonymous Message Board API running');
});

// =================== Conexión MongoDB ===================
const PORT = process.env.PORT || 3000;
const DB = process.env.DB || 'mongodb://127.0.0.1:27017/messageboard';

mongoose.set('strictQuery', false);

// Conexión a MongoDB
mongoose
  .connect(DB)
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error al conectar con MongoDB:", err));

// Escuchar el puerto (se ejecutará aunque falle la DB)
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
});

module.exports = app;

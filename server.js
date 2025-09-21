'use strict';
require('dotenv').config();
const express     = require('express');
const bodyParser  = require('body-parser');
const cors        = require('cors');
const helmet      = require('helmet');
const { MongoClient } = require('mongodb');

const apiRoutes         = require('./routes/api.js');
const fccTestingRoutes  = require('./routes/fcctesting.js');
const runner            = require('./test-runner');

const app = express();

// Configuraciones de seguridad con helmet
app.use(helmet({
  // Solo permitir que el sitio se cargue en un iFrame en sus propias páginas
  frameguard: { action: 'sameorigin' },
  
  // No permitir la precarga de DNS
  dnsPrefetchControl: { allow: false },
  
  // Permitir que el sitio envíe el referente únicamente a sus propias páginas
  referrerPolicy: { policy: 'same-origin' },
  
  // Otras configuraciones de seguridad
  contentSecurityPolicy: false // Deshabilitado para FCC testing
}));

app.use('/public', express.static(process.cwd() + '/public'));

// CORS configurado para FCC testing - permite todos los orígenes
app.use(cors({ origin: '*' }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware para agregar headers de no-cache para evitar problemas de cache
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// Sample front-end routes
app.route('/b/:board/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/board.html');
  });

app.route('/b/:board/:threadid')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/thread.html');
  });

// Index page (static HTML)
app.route('/')
  .get(function (req, res) {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// For FCC testing purposes
fccTestingRoutes(app);

// Configuración de conexión a base de datos
const MONGO_URI = process.env.DB || process.env.MONGO_URI || 'mongodb://localhost:27017/anonymous_messageboard';
const PORT = 5000;

// Función para crear una colección en memoria si no hay MongoDB disponible
function createMemoryStorage() {
  const memoryDB = {
    threads: [],
    collection: function(name) {
      return {
        insertOne: async (doc) => {
          doc._id = new Date().getTime().toString();
          this.threads.push(doc);
          return { insertedId: doc._id };
        },
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () => this.threads.slice(0, 10)
            })
          })
        }),
        findOne: async (query) => {
          return this.threads.find(t => t._id === query._id || t._id.toString() === query._id.toString());
        },
        updateOne: async (query, update) => {
          const thread = this.threads.find(t => t._id === query._id || t._id.toString() === query._id.toString());
          if (thread) {
            if (update.$set) Object.assign(thread, update.$set);
            if (update.$push) {
              Object.keys(update.$push).forEach(key => {
                if (!thread[key]) thread[key] = [];
                thread[key].push(update.$push[key]);
              });
            }
            return { matchedCount: 1 };
          }
          return { matchedCount: 0 };
        },
        deleteOne: async (query) => {
          const index = this.threads.findIndex(t => t._id === query._id || t._id.toString() === query._id.toString());
          if (index > -1) {
            this.threads.splice(index, 1);
            return { deletedCount: 1 };
          }
          return { deletedCount: 0 };
        }
      };
    }
  };
  return memoryDB;
}

// Intentar conectar a MongoDB, si falla usar almacenamiento en memoria
async function startServer() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const client = await MongoClient.connect(MONGO_URI);
    const db = client.db();
    app.locals.db = db;
    console.log('Connected to MongoDB successfully');
    
    // Routing for API (se monta después de conectar a la DB)
    apiRoutes(app);
    
    startExpressServer();
    
  } catch (err) {
    console.log('MongoDB connection failed, using memory storage for development:', err.message);
    
    // Usar almacenamiento en memoria
    app.locals.db = createMemoryStorage();
    
    // Routing for API 
    apiRoutes(app);
    
    startExpressServer();
  }
}

function startExpressServer() {
  // 404 Not Found Middleware
  app.use(function(req, res, next) {
    res.status(404)
      .type('text')
      .send('Not Found');
  });

  // Start our server and tests!
  const listener = app.listen(PORT, '0.0.0.0', function () {
    console.log('Your app is listening on port ' + listener.address().port);
    
    if (process.env.NODE_ENV === 'test') {
      console.log('Running Tests...');
      setTimeout(function () {
        try {
          runner.run();
        } catch(e) {
          console.log('Tests are not valid:');
          console.error(e);
        }
      }, 1500);
    }
  });
}

// Iniciar el servidor
startServer();

module.exports = app; // for testing
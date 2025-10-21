'use strict';
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient } = require('mongodb');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner');

const app = express();

// ===============================
// 🛡️ Configuración de seguridad con Helmet
// ===============================
app.use(
  helmet({
    contentSecurityPolicy: false, // desactivado para FreeCodeCamp tests
  })
);
app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));

// ===============================
// 🌍 Configuración general
// ===============================
app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Evitar cache en las respuestas (importante para tests)
app.use((req, res, next) => {
  res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  next();
});

// ===============================
// 🧩 Rutas Front-End
// ===============================
app.route('/b/:board/').get((req, res) => {
  res.sendFile(process.cwd() + '/views/board.html');
});

app.route('/b/:board/:threadid').get((req, res) => {
  res.sendFile(process.cwd() + '/views/thread.html');
});

app.route('/').get((req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

// ===============================
// 🧪 Rutas para FreeCodeCamp Testing
// ===============================
fccTestingRoutes(app);

// ===============================
// ⚙️ Configuración de Base de Datos
// ===============================
const MONGO_URI =
  process.env.DB ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/anonymous_messageboard';
const PORT = process.env.PORT || 3000;

// ===============================
// 🧠 Almacenamiento en memoria (fallback si falla MongoDB)
// ===============================
function createMemoryStorage() {
  const threads = [];

  const memoryDB = {
    collection: (name) => ({
      insertOne: async (doc) => {
        if (!doc._id) {
          const timestamp = Math.floor(Date.now() / 1000).toString(16);
          const randomHex = Math.random().toString(16).substring(2, 18);
          const objectIdString = (timestamp + randomHex).padEnd(24, '0').substring(0, 24);
          doc._id = { toString: () => objectIdString };
        }
        threads.push({ ...doc });
        return { insertedId: doc._id };
      },

      find: (query = {}, options = {}) => ({
        sort: (sortOptions) => ({
          limit: (limitNum) => ({
            toArray: async () => {
              let filtered = threads.filter((t) => {
                if (query.board && t.board !== query.board) return false;
                return true;
              });

              if (sortOptions && sortOptions.bumped_on === -1) {
                filtered.sort((a, b) => new Date(b.bumped_on) - new Date(a.bumped_on));
              }

              if (limitNum) filtered = filtered.slice(0, limitNum);

              if (options.projection) {
                filtered = filtered.map((item) => {
                  const projected = { ...item };
                  Object.keys(options.projection).forEach((key) => {
                    if (options.projection[key] === 0) delete projected[key];
                  });
                  return projected;
                });
              }

              return filtered;
            },
          }),
        }),
      }),

      findOne: async (query, options = {}) => {
        let thread = threads.find((t) => {
          if (query._id && t._id.toString() !== query._id.toString()) return false;
          if (query.board && t.board !== query.board) return false;
          return true;
        });

        if (thread && options.projection) {
          thread = { ...thread };
          Object.keys(options.projection).forEach((key) => {
            if (options.projection[key] === 0) delete thread[key];
          });
        }

        return thread;
      },

      updateOne: async (query, update) => {
        const index = threads.findIndex((t) => {
          if (query._id && t._id.toString() !== query._id.toString()) return false;
          if (query.board && t.board !== query.board) return false;
          if (query['replies._id']) {
            const replyExists =
              t.replies && t.replies.some((r) => r._id.toString() === query['replies._id'].toString());
            if (!replyExists) return false;
          }
          return true;
        });

        if (index === -1) return { matchedCount: 0 };

        const thread = threads[index];

        if (update.$set) {
          if (update.$set['replies.$.reported']) {
            const rIndex = thread.replies.findIndex(
              (r) => r._id.toString() === query['replies._id'].toString()
            );
            if (rIndex !== -1) thread.replies[rIndex].reported = true;
          } else if (update.$set['replies.$.text']) {
            const rIndex = thread.replies.findIndex(
              (r) => r._id.toString() === query['replies._id'].toString()
            );
            if (rIndex !== -1) thread.replies[rIndex].text = update.$set['replies.$.text'];
          } else {
            Object.assign(thread, update.$set);
          }
        }

        if (update.$push) {
          for (const key of Object.keys(update.$push)) {
            if (!thread[key]) thread[key] = [];
            thread[key].push(update.$push[key]);
          }
        }

        return { matchedCount: 1 };
      },

      deleteOne: async (query) => {
        const index = threads.findIndex((t) => {
          if (query._id && t._id.toString() !== query._id.toString()) return false;
          if (query.board && t.board !== query.board) return false;
          return true;
        });
        if (index > -1) {
          threads.splice(index, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
    }),
  };
  return memoryDB;
}

// ===============================
// 🚀 Inicio del Servidor
// ===============================
async function startServer() {
  try {
    console.log('Attempting to connect to MongoDB...');
    const client = await MongoClient.connect(MONGO_URI, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    const db = client.db();
    app.locals.db = db;
    console.log('✅ Connected to MongoDB successfully');
    startExpressServer();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('⚠️ MongoDB connection failed, using in-memory storage:', err.message);
    }
    app.locals.db = createMemoryStorage();
    startExpressServer();
  }
}

function startExpressServer() {
  // Rutas API (montadas después de tener db)
  apiRoutes(app);

  // Middleware 404
  app.use((req, res) => {
    res.status(404).type('text').send('Not Found');
  });

  const listener = app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Your app is listening on port ' + listener.address().port);

    if (process.env.NODE_ENV === 'test') {
      console.log('Running Tests...');
      setTimeout(() => {
        try {
          runner.run();
        } catch (e) {
          console.log('Tests are not valid:');
          console.error(e);
        }
      }, 1500);
    }
  });
}

// Iniciar el servidor
startServer();

module.exports = app;

'use strict';

const ThreadController = require('../controllers/threadController');
const ReplyController = require('../controllers/replyController');
const { ObjectId } = require('mongodb');

// Función para validar ObjectId
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  // Validar solo ObjectId de MongoDB (24 caracteres hexadecimales)
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Función para crear ObjectId de forma segura
function createObjectId(id) {
  try {
    return new ObjectId(id);
  } catch (error) {
    throw new Error('Invalid ID format');
  }
}

module.exports = function (app) {
  
  // Middleware para obtener controladores con la conexión de base de datos
  app.use((req, res, next) => {
    if (app.locals.db) {
      req.threadController = new ThreadController(app.locals.db);
      req.replyController = new ReplyController(app.locals.db);
    }
    next();
  });

  // THREADS ROUTES
  app.route('/api/threads/:board')
    
    // GET - Obtener los 10 hilos más recientes con 3 respuestas cada uno
    .get(async (req, res) => {
      try {
        if (!req.threadController) {
          return res.status(500).json({ error: 'Database not available' });
        }
        
        const board = req.params.board;
        const threads = await req.threadController.getRecentThreads(board);
        res.json(threads);
      } catch (error) {
        console.error('Error getting threads:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // POST - Crear un nuevo hilo
    .post(async (req, res) => {
      try {
        if (!req.threadController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { text, delete_password } = req.body;
        const board = req.params.board;

        // Validación de entrada
        if (!text || !delete_password) {
          return res.status(400).json({ error: 'Missing required fields: text and delete_password' });
        }

        if (text.trim().length === 0) {
          return res.status(400).json({ error: 'Text cannot be empty' });
        }

        const thread = await req.threadController.createThread(board, text.trim(), delete_password);
        
        // Redirigir según los requisitos de FreeCodeCamp
        res.redirect(303, `/b/${board}/`);
      } catch (error) {
        console.error('Error creating thread:', error.message);
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // PUT - Reportar un hilo
    .put(async (req, res) => {
      try {
        if (!req.threadController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id } = req.body;
        const board = req.params.board;

        if (!thread_id) {
          return res.status(400).json({ error: 'Missing thread_id' });
        }

        if (!isValidObjectId(thread_id)) {
          return res.status(400).json({ error: 'Invalid thread_id format' });
        }

        const result = await req.threadController.reportThread(board, thread_id);
        res.send(result);
      } catch (error) {
        console.error('Error reporting thread:', error.message);
        if (error.message.includes('Thread not found')) {
          return res.status(404).json({ error: 'Thread not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // DELETE - Eliminar un hilo
    .delete(async (req, res) => {
      try {
        if (!req.threadController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id, delete_password } = req.body;
        const board = req.params.board;

        if (!thread_id || !delete_password) {
          return res.status(400).json({ error: 'Missing thread_id or delete_password' });
        }

        if (!isValidObjectId(thread_id)) {
          return res.status(400).json({ error: 'Invalid thread_id format' });
        }

        const result = await req.threadController.deleteThread(board, thread_id, delete_password);
        
        // Manejar respuestas específicas de string
        if (result === 'Thread not found') {
          return res.status(404).send('Thread not found');
        }
        
        res.send(result);
      } catch (error) {
        console.error('Error deleting thread:', error.message);
        if (error.message.includes('Thread not found')) {
          return res.status(404).send('Thread not found');
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    });

  // REPLIES ROUTES
  app.route('/api/replies/:board')
    
    // GET - Obtener un hilo específico con todas sus respuestas
    .get(async (req, res) => {
      try {
        if (!req.threadController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id } = req.query;
        const board = req.params.board;

        if (!thread_id) {
          return res.status(400).json({ error: 'Missing thread_id query parameter' });
        }

        if (!isValidObjectId(thread_id)) {
          return res.status(400).json({ error: 'Invalid thread_id format' });
        }

        const thread = await req.threadController.getThreadWithReplies(board, thread_id);
        res.json(thread);
      } catch (error) {
        console.error('Error getting thread with replies:', error.message);
        if (error.message.includes('Thread not found')) {
          return res.status(404).json({ error: 'Thread not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // POST - Crear una nueva respuesta
    .post(async (req, res) => {
      try {
        if (!req.replyController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id, text, delete_password } = req.body;
        const board = req.params.board;

        // Validación de entrada
        if (!thread_id || !text || !delete_password) {
          return res.status(400).json({ error: 'Missing required fields: thread_id, text, and delete_password' });
        }

        if (!isValidObjectId(thread_id)) {
          return res.status(400).json({ error: 'Invalid thread_id format' });
        }

        if (text.trim().length === 0) {
          return res.status(400).json({ error: 'Text cannot be empty' });
        }

        const reply = await req.replyController.createReply(board, thread_id, text.trim(), delete_password);
        
        // Redirigir según los requisitos de FreeCodeCamp
        res.redirect(303, `/b/${board}/${thread_id}`);
      } catch (error) {
        console.error('Error creating reply:', error.message);
        if (error.message.includes('Thread not found')) {
          return res.status(404).json({ error: 'Thread not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // PUT - Reportar una respuesta
    .put(async (req, res) => {
      try {
        if (!req.replyController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id, reply_id } = req.body;
        const board = req.params.board;

        if (!thread_id || !reply_id) {
          return res.status(400).json({ error: 'Missing thread_id or reply_id' });
        }

        if (!isValidObjectId(thread_id) || !isValidObjectId(reply_id)) {
          return res.status(400).json({ error: 'Invalid thread_id or reply_id format' });
        }

        const result = await req.replyController.reportReply(board, thread_id, reply_id);
        res.send(result);
      } catch (error) {
        console.error('Error reporting reply:', error.message);
        if (error.message.includes('Reply not found')) {
          return res.status(404).json({ error: 'Reply not found' });
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    })
    
    // DELETE - Eliminar una respuesta
    .delete(async (req, res) => {
      try {
        if (!req.replyController) {
          return res.status(500).json({ error: 'Database not available' });
        }

        const { thread_id, reply_id, delete_password } = req.body;
        const board = req.params.board;

        if (!thread_id || !reply_id || !delete_password) {
          return res.status(400).json({ error: 'Missing thread_id, reply_id, or delete_password' });
        }

        if (!isValidObjectId(thread_id) || !isValidObjectId(reply_id)) {
          return res.status(400).json({ error: 'Invalid thread_id or reply_id format' });
        }

        const result = await req.replyController.deleteReply(board, thread_id, reply_id, delete_password);
        
        // Manejar respuestas específicas de string
        if (result === 'Reply not found' || result === 'Thread not found') {
          return res.status(404).send(result);
        }
        
        res.send(result);
      } catch (error) {
        console.error('Error deleting reply:', error.message);
        if (error.message.includes('Reply not found') || error.message.includes('Thread not found')) {
          return res.status(404).send(error.message.includes('Thread') ? 'Thread not found' : 'Reply not found');
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    });

};
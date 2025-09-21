'use strict';

const { ObjectId } = require('mongodb');

class ThreadController {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('threads');
  }

  // Crear un nuevo hilo
  async createThread(board, text, deletePassword) {
    try {
      const newThread = {
        _id: new ObjectId(),
        text: text,
        created_on: new Date(),
        bumped_on: new Date(),
        reported: false,
        delete_password: deletePassword,
        replies: [],
        board: board
      };

      const result = await this.collection.insertOne(newThread);
      return { 
        _id: result.insertedId.toString(),
        text: newThread.text,
        created_on: newThread.created_on,
        bumped_on: newThread.bumped_on,
        replies: []
      };
    } catch (error) {
      throw new Error('Error creating thread: ' + error.message);
    }
  }

  // Obtener los 10 hilos más recientes con sus 3 respuestas más recientes
  async getRecentThreads(board) {
    try {
      const threads = await this.collection
        .find({ board: board }, {
          projection: {
            delete_password: 0,
            reported: 0,
            board: 0
          }
        })
        .sort({ bumped_on: -1 })
        .limit(10)
        .toArray();

      // Limitar replies a las 3 más recientes y ocultar campos sensibles
      const sanitizedThreads = threads.map(thread => ({
        _id: thread._id.toString(),
        text: thread.text,
        created_on: thread.created_on,
        bumped_on: thread.bumped_on,
        replies: thread.replies
          .sort((a, b) => b.created_on - a.created_on)
          .slice(0, 3)
          .map(reply => ({
            _id: reply._id.toString(),
            text: reply.text,
            created_on: reply.created_on
          }))
      }));

      return sanitizedThreads;
    } catch (error) {
      throw new Error('Error getting threads: ' + error.message);
    }
  }

  // Reportar un hilo
  async reportThread(board, threadId) {
    try {
      const result = await this.collection.updateOne(
        { _id: new ObjectId(threadId), board: board },
        { $set: { reported: true } }
      );

      if (result.matchedCount === 0) {
        throw new Error('Thread not found');
      }

      return 'reported';
    } catch (error) {
      throw new Error('Error reporting thread: ' + error.message);
    }
  }

  // Eliminar un hilo
  async deleteThread(board, threadId, deletePassword) {
    try {
      const thread = await this.collection.findOne({
        _id: new ObjectId(threadId),
        board: board
      });

      if (!thread) {
        throw new Error('Thread not found');
      }

      if (thread.delete_password !== deletePassword) {
        return 'incorrect password';
      }

      const result = await this.collection.deleteOne({
        _id: new ObjectId(threadId),
        board: board
      });

      if (result.deletedCount === 1) {
        return 'success';
      } else {
        throw new Error('Thread not found');
      }
    } catch (error) {
      if (error.message.includes('incorrect password')) {
        return 'incorrect password';
      }
      throw error; // Propagar el error para que routes lo maneje apropiadamente
    }
  }

  // Obtener un hilo específico con todas sus respuestas
  async getThreadWithReplies(board, threadId) {
    try {
      const thread = await this.collection.findOne(
        { _id: new ObjectId(threadId), board: board },
        {
          projection: {
            delete_password: 0,
            reported: 0,
            board: 0
          }
        }
      );

      if (!thread) {
        throw new Error('Thread not found');
      }

      // Ocultar campos sensibles de las respuestas
      const sanitizedReplies = thread.replies.map(reply => ({
        _id: reply._id.toString(),
        text: reply.text,
        created_on: reply.created_on
      }));

      return {
        _id: thread._id.toString(),
        text: thread.text,
        created_on: thread.created_on,
        bumped_on: thread.bumped_on,
        replies: sanitizedReplies
      };
    } catch (error) {
      throw new Error('Error getting thread: ' + error.message);
    }
  }
}

module.exports = ThreadController;
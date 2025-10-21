'use strict';

const { ObjectId } = require('mongodb');

class ReplyController {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('threads');
  }

  // Crear una nueva respuesta
  async createReply(board, threadId, text, deletePassword) {
    try {
      const newReply = {
        _id: new ObjectId(),
        text: text,
        created_on: new Date(),
        delete_password: deletePassword,
        reported: false
      };

      const result = await this.collection.updateOne(
        { _id: new ObjectId(threadId), board: board },
        {
          $push: { replies: newReply },
          $set: { bumped_on: new Date() }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Thread not found');
      }

      return {
        _id: newReply._id.toString(),
        text: newReply.text,
        created_on: newReply.created_on
      };
    } catch (error) {
      throw new Error('Error creating reply: ' + error.message);
    }
  }

  // Reportar una respuesta
  async reportReply(board, threadId, replyId) {
    try {
      const result = await this.collection.updateOne(
        { 
          _id: new ObjectId(threadId), 
          board: board,
          'replies._id': new ObjectId(replyId)
        },
        { 
          $set: { 'replies.$.reported': true } 
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Reply not found');
      }

      return 'reported';
    } catch (error) {
      throw new Error('Error reporting reply: ' + error.message);
    }
  }

  // Eliminar una respuesta
  async deleteReply(board, threadId, replyId, deletePassword) {
    try {
      // Primero encontrar el hilo y la respuesta
      const thread = await this.collection.findOne({
        _id: new ObjectId(threadId),
        board: board
      });

      if (!thread) {
        throw new Error('Thread not found');
      }

      const reply = thread.replies.find(r => r._id.toString() === replyId);
      if (!reply) {
        throw new Error('Reply not found');
      }

      if (reply.delete_password !== deletePassword) {
        return 'incorrect password';
      }

      // En lugar de eliminar la respuesta, cambiar el texto a "[deleted]"
      const result = await this.collection.updateOne(
        { 
          _id: new ObjectId(threadId), 
          board: board,
          'replies._id': new ObjectId(replyId)
        },
        { 
          $set: { 'replies.$.text': '[deleted]' } 
        }
      );

      if (result.matchedCount === 1) {
        return 'success';
      } else {
        throw new Error('Reply not found');
      }
    } catch (error) {
      if (error.message.includes('incorrect password')) {
        return 'incorrect password';
      }
      throw error; // Propagar el error para que routes lo maneje apropiadamente
    }
  }
}

module.exports = ReplyController;
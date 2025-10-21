'use strict';
const { ObjectId } = require('mongodb');

class ReplyController {
  constructor(db) {
    this.db = db;
    this.collection = db.collection('threads');
  }

  // 📝 Crear una nueva respuesta
  async createReply(board, threadId, text, deletePassword) {
    try {
      const newReply = {
        _id: new ObjectId(),
        text,
        created_on: new Date(),
        delete_password: deletePassword,
        reported: false
      };

      // Actualiza el hilo con el nuevo reply y el bumped_on actualizado
      const result = await this.collection.updateOne(
        { _id: new ObjectId(threadId), board },
        {
          $push: { replies: newReply },
          $set: { bumped_on: newReply.created_on }
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Thread not found');
      }

      // Devuelve el objeto completo (para pruebas)
      return newReply;
    } catch (error) {
      throw new Error('Error creating reply: ' + error.message);
    }
  }

  // 🚩 Reportar una respuesta
  async reportReply(board, threadId, replyId) {
    try {
      const result = await this.collection.updateOne(
        { _id: new ObjectId(threadId), board, 'replies._id': new ObjectId(replyId) },
        { $set: { 'replies.$.reported': true } }
      );

      if (result.matchedCount === 0) {
        throw new Error('Reply not found');
      }

      return 'reported';
    } catch (error) {
      throw new Error('Error reporting reply: ' + error.message);
    }
  }

  // ❌ Eliminar (marcar como eliminado) una respuesta
  async deleteReply(board, threadId, replyId, deletePassword) {
    try {
      const thread = await this.collection.findOne({
        _id: new ObjectId(threadId),
        board
      });

      if (!thread) throw new Error('Thread not found');

      const reply = thread.replies.find(r => r._id.toString() === replyId);
      if (!reply) throw new Error('Reply not found');

      if (reply.delete_password !== deletePassword) {
        return 'incorrect password';
      }

      const result = await this.collection.updateOne(
        { _id: new ObjectId(threadId), board, 'replies._id': new ObjectId(replyId) },
        { $set: { 'replies.$.text': '[deleted]' } }
      );

      if (result.matchedCount === 1) return 'success';
      else throw new Error('Reply not found');
    } catch (error) {
      if (error.message.includes('incorrect password')) {
        return 'incorrect password';
      }
      throw error;
    }
  }
}

module.exports = ReplyController;

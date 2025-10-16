'use strict';
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// ===== Esquemas =====
const replySchema = new mongoose.Schema({
  text: String,
  created_on: Date,
  delete_password: String,
  reported: { type: Boolean, default: false },
});

const threadSchema = new mongoose.Schema({
  board: String,
  text: String,
  created_on: Date,
  bumped_on: Date,
  reported: { type: Boolean, default: false },
  delete_password: String,
  replies: [replySchema],
});

const Thread = mongoose.model('Thread', threadSchema);

// ==================== THREADS ====================

// Crear thread
router.post('/threads/:board', async (req, res) => {
  try {
    const board = req.params.board;
    const { text, delete_password } = req.body;
    if (!text || !delete_password) return res.status(400).send('missing fields');

    const thread = new Thread({
      board,
      text,
      delete_password,
      created_on: new Date(),
      bumped_on: new Date(),
      reported: false,
      replies: [],
    });

    await thread.save();
    // FCC espera redirección a la vista del board
    res.redirect(`/b/${board}/`);
  } catch (err) {
    console.error(err);
    res.status(500).send('server error');
  }
});

// Obtener los 10 threads más recientes con 3 replies cada uno
router.get('/threads/:board', async (req, res) => {
  const board = req.params.board;
  const threads = await Thread.find({ board })
    .sort({ bumped_on: -1 })
    .limit(10)
    .lean();

  const cleaned = threads.map((t) => {
    // ordenar replies por fecha descendente
    t.replies = (t.replies || [])
      .sort((a, b) => b.created_on - a.created_on)
      .slice(0, 3)
      .map((r) => ({
        _id: r._id,
        text: r.text,
        created_on: r.created_on,
      }));

    // remover campos no permitidos
    return {
      _id: t._id,
      text: t.text,
      created_on: t.created_on,
      bumped_on: t.bumped_on,
      replies: t.replies,
    };
  });

  res.json(cleaned);
});

// Eliminar thread
router.delete('/threads/:board', async (req, res) => {
  const { thread_id, delete_password } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.send('incorrect password');
  if (thread.delete_password !== delete_password)
    return res.send('incorrect password');

  await Thread.findByIdAndDelete(thread_id);
  res.send('success');
});

// Reportar thread
router.put('/threads/:board', async (req, res) => {
  const { thread_id } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.send('thread not found');
  thread.reported = true;
  await thread.save();
  res.send('reported');
});

// ==================== REPLIES ====================

// Crear nueva reply
router.post('/replies/:board', async (req, res) => {
  const board = req.params.board;
  const { thread_id, text, delete_password } = req.body;
  if (!text || !delete_password || !thread_id)
    return res.status(400).send('missing fields');

  const thread = await Thread.findById(thread_id);
  if (!thread) return res.status(404).send('thread not found');

  const reply = {
    text,
    delete_password,
    created_on: new Date(),
    reported: false,
  };

  thread.replies.push(reply);
  thread.bumped_on = new Date();
  await thread.save();

  res.redirect(`/b/${board}/${thread_id}`);
});

// Obtener todas las replies de un thread
router.get('/replies/:board', async (req, res) => {
  const thread_id = req.query.thread_id;
  const thread = await Thread.findById(thread_id).lean();
  if (!thread) return res.status(404).send('thread not found');

  const cleaned = {
    _id: thread._id,
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    replies: thread.replies.map((r) => ({
      _id: r._id,
      text: r.text,
      created_on: r.created_on,
    })),
  };

  res.json(cleaned);
});

// Borrar reply
router.delete('/replies/:board', async (req, res) => {
  const { thread_id, reply_id, delete_password } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.send('incorrect password');

  const reply = thread.replies.id(reply_id);
  if (!reply) return res.send('incorrect password');
  if (reply.delete_password !== delete_password)
    return res.send('incorrect password');

  reply.text = '[deleted]';
  await thread.save();
  res.send('success');
});

// Reportar reply
router.put('/replies/:board', async (req, res) => {
  const { thread_id, reply_id } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.send('thread not found');

  const reply = thread.replies.id(reply_id);
  if (!reply) return res.send('reply not found');

  reply.reported = true;
  await thread.save();
  res.send('reported');
});

module.exports = router;

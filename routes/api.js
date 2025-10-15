'use strict';
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Schemas
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

// POST thread
router.post('/threads/:board', async (req, res) => {
  const { board } = req.params;
  const { text, delete_password } = req.body;
  if (!text || !delete_password) return res.status(400).send('missing required fields');

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
  res.redirect(`/b/${board}/`);
});

// GET threads
router.get('/threads/:board', async (req, res) => {
  const threads = await Thread.find({ board: req.params.board })
    .sort({ bumped_on: -1 })
    .limit(10)
    .lean();

  const sanitized = threads.map(t => ({
    _id: t._id,
    text: t.text,
    created_on: t.created_on,
    bumped_on: t.bumped_on,
    replies: t.replies
      .sort((a, b) => b.created_on - a.created_on)
      .slice(0, 3)
      .map(r => ({ _id: r._id, text: r.text, created_on: r.created_on }))
  }));

  res.json(sanitized);
});

// DELETE thread
router.delete('/threads/:board', async (req, res) => {
  const { thread_id, delete_password } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread || thread.delete_password !== delete_password) return res.send('incorrect password');

  await Thread.findByIdAndDelete(thread_id);
  res.send('success');
});

// PUT report thread
router.put('/threads/:board', async (req, res) => {
  const { thread_id } = req.body;
  await Thread.findByIdAndUpdate(thread_id, { reported: true });
  res.send('reported');
});

// POST reply
router.post('/replies/:board', async (req, res) => {
  const { board } = req.params;
  const { thread_id, text, delete_password } = req.body;

  const thread = await Thread.findById(thread_id);
  if (!thread) return res.status(404).send('Thread not found');

  const reply = { text, delete_password, created_on: new Date(), reported: false };
  thread.replies.push(reply);
  thread.bumped_on = new Date();
  await thread.save();

  res.redirect(`/b/${board}/${thread_id}`);
});

// GET replies
router.get('/replies/:board', async (req, res) => {
  const { thread_id } = req.query;
  const thread = await Thread.findById(thread_id).lean();
  if (!thread) return res.status(404).send('Thread not found');

  const sanitized = {
    _id: thread._id,
    text: thread.text,
    created_on: thread.created_on,
    bumped_on: thread.bumped_on,
    replies: thread.replies.map(r => ({ _id: r._id, text: r.text, created_on: r.created_on }))
  };

  res.json(sanitized);
});

// DELETE reply
router.delete('/replies/:board', async (req, res) => {
  const { thread_id, reply_id, delete_password } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.send('incorrect password');

  const reply = thread.replies.id(reply_id);
  if (!reply || reply.delete_password !== delete_password) return res.send('incorrect password');

  reply.text = '[deleted]';
  await thread.save();
  res.send('success');
});

// PUT report reply
router.put('/replies/:board', async (req, res) => {
  const { thread_id, reply_id } = req.body;
  const thread = await Thread.findById(thread_id);
  if (!thread) return res.status(404).send('Thread not found');

  const reply = thread.replies.id(reply_id);
  if (!reply) return res.status(404).send('Reply not found');

  reply.reported = true;
  await thread.save();
  res.send('reported');
});

module.exports = router;

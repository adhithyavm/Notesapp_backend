const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const auth = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error('Fetch notes error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    console.error('Fetch note error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, content, color } = req.body;
    const note = new Note({
      title,
      content,
      color,
      user: req.user._id,
    });
    await note.save();
    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, color } = req.body;
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { title, content, color },
      { new: true }
    );
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    // Delete associated images from Cloudinary
    for (const image of note.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }
    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/images', auth, upload.single('image'), async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Upload image to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'notes_app' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    note.images.push({
      public_id: result.public_id,
      url: result.secure_url,
    });
    await note.save();
    res.json(note);
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/images/:publicId', auth, async (req, res) => {
  try {
    console.log(`Deleting image with publicId: ${req.params.publicId} for note: ${req.params.id}`);
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      console.log('Note not found');
      return res.status(404).json({ error: 'Note not found' });
    }

    console.log('Current images:', note.images);
    // Delete image from Cloudinary
    const cloudinaryResult = await cloudinary.uploader.destroy(req.params.publicId);
    console.log('Cloudinary delete result:', cloudinaryResult);

    // Remove image from note
    note.images = note.images.filter(image => image.public_id !== req.params.publicId);
    await note.save();
    console.log('Updated note:', note);

    res.json(note);
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
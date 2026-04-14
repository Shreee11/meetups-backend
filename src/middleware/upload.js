const multer = require('multer');

// All files stored in memory
const storage = multer.memoryStorage();

// General image file filter
const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP and GIF images are allowed.'), false);
  }
};

// Audio file filter for voice messages
const audioFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
    'audio/webm', 'audio/ogg', 'audio/wav', 'audio/aac',
    'audio/x-m4a', 'video/webm',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

// Profile photo upload (images only, up to 10MB)
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 9 },
});

// Chat media upload: images or audio, up to 20MB
const chatUpload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    const isAudio = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/webm', 'audio/ogg', 'audio/wav', 'audio/aac',
      'audio/x-m4a', 'video/webm',
    ].includes(file.mimetype);

    if (isImage || isAudio) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for chat.'), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

upload.chatUpload = chatUpload;
module.exports = upload;

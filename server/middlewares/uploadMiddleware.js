import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file limit
  },
  fileFilter: (req, file, cb) => {
    const isAllowedMime = /application\/pdf|image\/(png|jpeg|jpg|webp|tiff|bmp)|text\/plain/i.test(file.mimetype);
    const isAllowedExt = /\.(pdf|png|jpe?g|webp|tiff|bmp|txt)$/i.test(file.originalname);

    if (isAllowedMime || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype || file.originalname}. Only PDF and Image files (PNG, JPEG, WebP, TIFF) are accepted.`));
    }
  },
});

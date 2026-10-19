const sharp = require('sharp');

const optimizeImage = async (imageBuffer) => {
  const buffer = await sharp(imageBuffer)
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  return { buffer, mimeType: 'image/jpeg' };
};

module.exports = { optimizeImage };

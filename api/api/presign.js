// api/presign.js
// Genera una URL firmada para subir un archivo directo a Cloudflare R2
// desde el navegador, sin pasar por el límite de tamaño de Vercel.

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const { filename, contentType } = req.body || {};

  if (!filename) {
    res.status(400).json({ error: 'Falta filename' });
    return;
  }

  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: filename,
      ContentType: contentType || 'video/mp4',
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.status(200).json({ url });
  } catch (err) {
    console.error('Error generando URL firmada:', err);
    res.status(500).json({ error: 'No se pudo generar la URL de subida' });
  }
};

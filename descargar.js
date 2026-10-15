// api/descargar.js
// Devuelve un link temporal (10 min) que fuerza la DESCARGA del video completo
// desde R2. Hace falta porque el atributo "download" del navegador no funciona
// con archivos de otro dominio: sin esto el video se abriría para reproducir.

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const { videoUrl, filename } = req.body || {};
  const base = process.env.R2_PUBLIC_BASE;

  // Solo se aceptan videos que estén en nuestro bucket
  if (!videoUrl || !base || !videoUrl.startsWith(base + '/')) {
    res.status(400).json({ error: 'Video no válido' });
    return;
  }

  try {
    const key = decodeURIComponent(videoUrl.slice(base.length + 1).split('?')[0]);
    const safeName = String(filename || 'partido.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
        ResponseContentType: 'video/mp4',
      }),
      { expiresIn: 600 }
    );

    res.status(200).json({ url });
  } catch (err) {
    console.error('Error generando link de descarga:', err);
    res.status(500).json({ error: 'No se pudo generar el link de descarga' });
  }
};

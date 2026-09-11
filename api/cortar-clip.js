// api/cortar-clip.js
// Corre en el servidor de Vercel, no en el navegador del celular.
// Recibe la URL del video, el segundo de inicio y el de fin,
// y devuelve el clip ya cortado. Funciona igual en cualquier
// celular o navegador, porque el corte no depende del dispositivo
// de la persona que lo pide.

const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_DURATION_SECONDS = 90; // tope de seguridad: clips de hasta 90s

module.exports = async (req, res) => {
  // Permitir que la página llame a esta función desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const { videoUrl, start, end } = req.body || {};

  if (!videoUrl || typeof start !== 'number' || typeof end !== 'number') {
    res.status(400).json({ error: 'Faltan datos: videoUrl, start y end son obligatorios' });
    return;
  }

  const duration = end - start;
  if (duration <= 0 || duration > MAX_DURATION_SECONDS) {
    res.status(400).json({ error: `La duración del clip debe ser mayor a 0 y menor a ${MAX_DURATION_SECONDS} segundos` });
    return;
  }

  const outputPath = path.join(os.tmpdir(), `clip-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  // -ss antes de -i: busca directo al segundo indicado sin descargar
  // todo el video de antes. -c copy: no vuelve a comprimir, es rápido.
  const args = [
    '-ss', String(start),
    '-i', videoUrl,
    '-t', String(duration),
    '-c', 'copy',
    '-movflags', 'faststart',
    '-avoid_negative_ts', 'make_zero',
    '-y',
    outputPath
  ];

  const ffmpeg = spawn(ffmpegPath, args);

  let stderrLog = '';
  ffmpeg.stderr.on('data', (d) => { stderrLog += d.toString(); });

  const timeoutId = setTimeout(() => {
    ffmpeg.kill('SIGKILL');
  }, 9000);

  ffmpeg.on('close', (code) => {
    clearTimeout(timeoutId);
    if (code !== 0 || !fs.existsSync(outputPath)) {
      console.error('ffmpeg falló:', stderrLog);
      res.status(500).json({ error: 'No se pudo cortar el clip. Probá con un rango más corto.' });
      return;
    }
    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on('close', () => { fs.unlink(outputPath, () => {}); });
    stream.on('error', () => { fs.unlink(outputPath, () => {}); });
  });

  ffmpeg.on('error', (err) => {
    clearTimeout(timeoutId);
    console.error('No se pudo iniciar ffmpeg:', err);
    res.status(500).json({ error: 'No se pudo iniciar el proceso de corte' });
  });
};

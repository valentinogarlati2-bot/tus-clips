// api/confirm.js
// Una vez que el video ya se subió directo a R2, esta función
// actualiza en Supabase la fila del partido con la URL del video.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const { codigoAcceso, filename } = req.body || {};

  if (!codigoAcceso || !filename) {
    res.status(400).json({ error: 'Faltan datos: codigoAcceso y filename son obligatorios' });
    return;
  }

  const videoUrl = `${process.env.R2_PUBLIC_BASE}/${encodeURIComponent(filename)}`;

  try {
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/partidos?codigo_acceso=eq.${encodeURIComponent(codigoAcceso)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ video_url: videoUrl }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      console.error('Error actualizando Supabase:', err);
      res.status(500).json({ error: 'No se pudo actualizar el partido en Supabase' });
      return;
    }

    const data = await resp.json();
    if (!data || data.length === 0) {
      res.status(404).json({ error: 'No se encontró ningún partido con ese código de acceso' });
      return;
    }

    res.status(200).json({ videoUrl });
  } catch (err) {
    console.error('Error de red hacia Supabase:', err);
    res.status(500).json({ error: 'No se pudo conectar con Supabase' });
  }
};

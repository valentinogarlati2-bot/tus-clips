// api/confirm.js
// Una vez que el video ya se subió directo a R2, esta función
// actualiza en Supabase la fila del partido con la URL del video.
// Acepta "partidoId" (preferido, viene del buscador/upsert-partido)
// o "codigoAcceso" (compatibilidad con la versión anterior).

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'camaras2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const { adminPassword, partidoId, codigoAcceso, filename } = req.body || {};

  if (adminPassword !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Contraseña de admin incorrecta' });
    return;
  }
  if ((!partidoId && !codigoAcceso) || !filename) {
    res.status(400).json({ error: 'Faltan datos: partidoId (o codigoAcceso) y filename son obligatorios' });
    return;
  }

  const videoUrl = `${process.env.R2_PUBLIC_BASE}/${encodeURIComponent(filename)}`;
  const filtro = partidoId
    ? `id=eq.${encodeURIComponent(partidoId)}`
    : `codigo_acceso=eq.${encodeURIComponent(codigoAcceso)}`;

  try {
    const resp = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/partidos?${filtro}`,
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
      res.status(404).json({ error: 'No se encontró ningún partido con esos datos' });
      return;
    }

    res.status(200).json({ videoUrl, codigoAcceso: data[0].codigo_acceso });
  } catch (err) {
    console.error('Error de red hacia Supabase:', err);
    res.status(500).json({ error: 'No se pudo conectar con Supabase' });
  }
};

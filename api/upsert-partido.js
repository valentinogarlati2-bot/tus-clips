// api/upsert-partido.js
// Dado Complejo + Cancha + Fecha + Hora (los datos que ya tenés a mano
// cuando exportás el video de la cámara), busca o crea automáticamente
// las filas de "complejos", "canchas" y "partidos" en Supabase.
// Así el admin ya no necesita entrar a Supabase a mano para cada partido.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'camaras2026';

function sb(path, opts = {}) {
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método no permitido' }); return; }

  const {
    adminPassword, complejo, cancha, fecha, horaInicio,
    duracionMinutos, equipoA, equipoB,
  } = req.body || {};

  if (adminPassword !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Contraseña de admin incorrecta' });
    return;
  }
  if (!complejo || !cancha || !fecha || !horaInicio) {
    res.status(400).json({ error: 'Faltan datos: complejo, cancha, fecha y hora son obligatorios' });
    return;
  }

  try {
    // 1) Complejo: buscar o crear
    let r = await sb(`complejos?nombre=ilike.${encodeURIComponent(complejo.trim())}`);
    let rows = await r.json();
    let complejoRow = rows[0];
    if (!complejoRow) {
      r = await sb('complejos', { method: 'POST', body: JSON.stringify({ nombre: complejo.trim() }) });
      rows = await r.json();
      if (!r.ok) throw new Error(rows.message || 'No se pudo crear el complejo');
      complejoRow = rows[0];
    }

    // 2) Cancha: buscar o crear (dentro de ese complejo)
    r = await sb(`canchas?complejo_id=eq.${complejoRow.id}&nombre=ilike.${encodeURIComponent(cancha.trim())}`);
    rows = await r.json();
    let canchaRow = rows[0];
    if (!canchaRow) {
      r = await sb('canchas', {
        method: 'POST',
        body: JSON.stringify({ complejo_id: complejoRow.id, nombre: cancha.trim(), tipo: 'futbol5' }),
      });
      rows = await r.json();
      if (!r.ok) throw new Error(rows.message || 'No se pudo crear la cancha');
      canchaRow = rows[0];
    }

    // 3) Partido: buscar por cancha + fecha + hora exacta, o crear
    r = await sb(
      `partidos?cancha_id=eq.${canchaRow.id}&fecha=eq.${fecha}&hora_inicio=eq.${horaInicio}`
    );
    rows = await r.json();
    let partidoRow = rows[0];

    if (!partidoRow) {
      const nuevoPartido = {
        cancha_id: canchaRow.id,
        fecha,
        hora_inicio: horaInicio,
        duracion_minutos: duracionMinutos || 60,
        equipo_a: equipoA || null,
        equipo_b: equipoB || null,
        publico: true,
      };
      r = await sb('partidos', { method: 'POST', body: JSON.stringify(nuevoPartido) });
      rows = await r.json();
      if (!r.ok) throw new Error(rows.message || 'No se pudo crear el partido');
      partidoRow = rows[0];
    } else if (duracionMinutos || equipoA || equipoB) {
      // Ya existía: actualizamos los datos opcionales si vinieron cargados
      const cambios = {};
      if (duracionMinutos) cambios.duracion_minutos = duracionMinutos;
      if (equipoA) cambios.equipo_a = equipoA;
      if (equipoB) cambios.equipo_b = equipoB;
      r = await sb(`partidos?id=eq.${partidoRow.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
      rows = await r.json();
      if (r.ok && rows[0]) partidoRow = rows[0];
    }

    res.status(200).json({
      partidoId: partidoRow.id,
      codigoAcceso: partidoRow.codigo_acceso,
      complejo: complejoRow.nombre,
      cancha: canchaRow.nombre,
    });
  } catch (err) {
    console.error('Error en upsert-partido:', err);
    res.status(500).json({ error: err.message || 'Error creando/buscando el partido' });
  }
};

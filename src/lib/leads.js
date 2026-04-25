export function normalizeLeadScalar(value) {
  return String(value || '').trim();
}

export function buildLeadContactId(lead) {
  const nombre = normalizeLeadScalar(lead?.nombre).toLowerCase();
  const direccion = normalizeLeadScalar(lead?.direccion).toLowerCase();
  const telefono = normalizeLeadScalar(lead?.telefono).toLowerCase();
  return [nombre || 'negocio', direccion || 'sin-direccion', telefono || 'sin-telefono'].join('|');
}

export function ensureLeadId(lead) {
  return {
    ...lead,
    id: lead?.id || buildLeadContactId(lead),
  };
}

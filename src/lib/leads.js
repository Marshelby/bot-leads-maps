export function normalizeLeadScalar(value) {
  return String(value || '').trim();
}

export function buildLegacyLeadContactId(lead) {
  const nombre = normalizeLeadScalar(lead?.nombre).toLowerCase();
  const direccion = normalizeLeadScalar(lead?.direccion).toLowerCase();
  const telefono = normalizeLeadScalar(lead?.telefono).toLowerCase();
  return [nombre || 'negocio', direccion || 'sin-direccion', telefono || 'sin-telefono'].join('|');
}

export function buildRobustLeadContactId(lead) {
  const googleMapsUrl = normalizeLeadScalar(lead?.googleMapsUrl || lead?.google_maps_url || lead?.url_maps);
  return googleMapsUrl || '';
}

export function buildLeadContactId(lead) {
  return buildRobustLeadContactId(lead) || buildLegacyLeadContactId(lead);
}

export function getLeadContactIdentityAliases(lead) {
  const identities = [buildLeadContactId(lead), buildLegacyLeadContactId(lead)]
    .map((value) => normalizeLeadScalar(value))
    .filter(Boolean);

  return [...new Set(identities)];
}

export function isLeadPersistedAsContacted(contactedLeadIds, lead) {
  if (!contactedLeadIds || typeof contactedLeadIds.has !== 'function') {
    return false;
  }

  return getLeadContactIdentityAliases(lead).some((identity) => contactedLeadIds.has(identity));
}

export function ensureLeadId(lead) {
  return {
    ...lead,
    id: lead?.id || buildLeadContactId(lead),
  };
}

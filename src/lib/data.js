export function flattenBusinesses(groupedData) {
  if (!groupedData || typeof groupedData !== 'object') {
    return [];
  }

  const businesses = [];

  Object.entries(groupedData).forEach(([regionName, cities]) => {
    if (!cities || typeof cities !== 'object') {
      return;
    }

    Object.entries(cities).forEach(([cityName, items]) => {
      if (!Array.isArray(items)) {
        return;
      }

      items.forEach((item, index) => {
        const instagram = getInstagramValue(item);

        businesses.push({
          id: item.google_maps_url || item.url_maps || `${regionName}-${cityName}-${item.nombre || 'negocio'}-${index}`,
          nombre: item.nombre || 'Sin nombre',
          direccion: item.direccion || 'Dirección no disponible',
          ciudad: item.ciudad || cityName || 'Desconocido',
          region: item.region || regionName || 'Desconocido',
          telefono: item.telefono || '',
          email: item.email || '',
          instagram,
          categoria: item.categoria || item.categoría || item.keyword || '',
          keyword: item.keyword || '',
          web: item.web || '',
          rating: parseRating(item.rating),
          ratingLabel: item.rating || 'Sin rating',
          googleMapsUrl: item.google_maps_url || item.url_maps || '',
        });
      });
    });
  });

  return businesses;
}

export function filterBusinesses(businesses, filters) {
  const { query, city, region, niche, minRating, sortOrder } = filters;

  return businesses
    .filter((business) => {
      const matchesQuery = business.nombre.toLowerCase().includes(query.toLowerCase().trim());
      const matchesCity = !city || business.ciudad === city;
      const matchesRegion = !region || business.region === region;
      const nicheSources = [business.categoria, business.keyword].filter(Boolean);
      const matchesNiche =
        !niche ||
        nicheSources.length === 0 ||
        nicheSources.some((value) => String(value).toLowerCase().includes(niche.toLowerCase()));
      const matchesRating = minRating === 0 || business.rating >= minRating;

      return matchesQuery && matchesCity && matchesRegion && matchesNiche && matchesRating;
    })
    .sort((a, b) => {
      if (sortOrder === 'rating-asc') {
        return a.rating - b.rating;
      }

      return b.rating - a.rating;
    });
}

export function getBusinessQualityLevel(business) {
  const hasPhone = Boolean(String(business.telefono || '').trim());
  const hasInstagram = Boolean(String(business.instagram || '').trim());

  if (hasPhone && hasInstagram) {
    return 'high';
  }

  if (hasPhone || hasInstagram) {
    return 'medium';
  }

  return 'low';
}

export function groupBusinessesByQuality(businesses) {
  const groups = {
    high: [],
    medium: [],
    low: [],
  };

  businesses.forEach((business) => {
    groups[getBusinessQualityLevel(business)].push(business);
  });

  return [
    { key: 'high', title: 'Leads prioritarios', items: groups.high },
    { key: 'medium', title: 'Leads intermedios', items: groups.medium },
    { key: 'low', title: 'Leads de baja calidad', items: groups.low },
  ].filter((group) => group.items.length > 0);
}

function parseRating(value) {
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInstagramValue(item) {
  if (item.instagram) {
    return item.instagram;
  }

  if (typeof item.web === 'string' && item.web.includes('instagram.com')) {
    return item.web;
  }

  return '';
}

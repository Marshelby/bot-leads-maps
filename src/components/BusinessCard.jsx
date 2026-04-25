function formatRating(rating, ratingLabel) {
  return rating > 0 ? rating.toFixed(1) : ratingLabel;
}

export default function BusinessCard({ business, selected, onToggleSelect, isContacted }) {
  return (
    <article
      className={`panel business-card ${selected ? 'business-card--selected' : ''} ${isContacted ? 'business-card--contacted' : ''}`}
      onClick={() => onToggleSelect(business)}
    >
      <div className="business-card__top">
        <div className="business-card__main">
          <label
            className="lead-checkbox"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(business);
            }}
          >
            <input
              type="checkbox"
              checked={selected}
              readOnly
            />
            <span>Seleccionar lead</span>
          </label>
          <div className="business-card__identity">
            <p className="business-city">{business.ciudad}</p>
            <h3>{business.nombre}</h3>
          </div>
        </div>
        <div className="business-card__badges">
          {isContacted ? <span className="business-contacted-badge">CONTACTADO</span> : null}
          <span className="rating-badge">{formatRating(business.rating, business.ratingLabel)}</span>
        </div>
      </div>

      <p className="business-address">{business.direccion}</p>

      <div className="business-meta">
        <span className="business-meta__item">{business.region}</span>
        <span className="business-meta__item">{business.telefono || 'Sin teléfono'}</span>
      </div>

      <div className="business-actions">
        <a
          className="button button-primary"
          href={business.googleMapsUrl || '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Ver en Google Maps
        </a>
      </div>
    </article>
  );
}

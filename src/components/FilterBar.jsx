const ratingOptions = [
  { value: 0, label: 'Cualquier rating' },
  { value: 3, label: 'Desde 3.0' },
  { value: 4, label: 'Desde 4.0' },
  { value: 4.5, label: 'Desde 4.5' },
];

export default function FilterBar({
  query,
  minRating,
  sortOrder,
  onQueryChange,
  onMinRatingChange,
  onSortChange,
}) {
  return (
    <section className="panel filter-bar">
      <div className="field field-search">
        <label htmlFor="search">Buscar por nombre</label>
        <input
          id="search"
          type="text"
          placeholder="Ej. Barbería, Studio, Salon..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="rating">Rating mínimo</label>
        <select
          id="rating"
          value={minRating}
          onChange={(event) => onMinRatingChange(Number(event.target.value))}
        >
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="sort">Ordenar por rating</label>
        <select id="sort" value={sortOrder} onChange={(event) => onSortChange(event.target.value)}>
          <option value="rating-desc">Mayor a menor</option>
          <option value="rating-asc">Menor a mayor</option>
        </select>
      </div>
    </section>
  );
}

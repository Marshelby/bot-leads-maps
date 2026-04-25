export default function CampaignPanel({
  selectedCount,
  onOpen,
  onSelectAll,
  onSelectAllGlobal,
  onClearSelection,
  className = '',
}) {
  return (
    <section className={`panel campaign-panel ${className}`.trim()}>
      <div>
        <p className="eyebrow eyebrow-dark">Activación de leads</p>
        <h2>Campaña lista para personalización</h2>
        <p className="campaign-copy">
          Selecciona negocios desde las tarjetas y prepara un mensaje reutilizable con variables.
        </p>
      </div>

      <div className="campaign-summary">
        <div className="campaign-summary__count">
          <span>Leads seleccionados</span>
          <strong>{selectedCount}</strong>
          <p className="campaign-summary__caption">
            {selectedCount === 1 ? '1 lead listo para activar' : `${selectedCount} leads listos para activar`}
          </p>
        </div>
      </div>

      <div className="campaign-actions">
        <button className="button button-secondary" type="button" onClick={onSelectAll}>
          Seleccionar todos
        </button>
        <button className="button button-secondary" type="button" onClick={onSelectAllGlobal}>
          Seleccionar TODOS (global)
        </button>
        <button className="button button-secondary" type="button" onClick={onClearSelection}>
          Limpiar selección
        </button>
        <button className="button button-primary" type="button" onClick={onOpen} disabled={selectedCount === 0}>
          Crear campaña
        </button>
      </div>
    </section>
  );
}

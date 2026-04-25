import BusinessCard from './BusinessCard';
import { groupBusinessesByQuality } from '../lib/data';

export default function BusinessGrid({
  businesses,
  selectedLeadIds,
  onToggleSelect,
}) {
  if (businesses.length === 0) {
    return (
      <section className="panel empty-state">
        <h2>Sin resultados</h2>
        <p>No hay negocios que coincidan con los filtros actuales.</p>
      </section>
    );
  }

  const groupedBusinesses = groupBusinessesByQuality(businesses);

  return (
    <section className="directory-groups">
      {groupedBusinesses.map((group) => (
        <section key={group.key} className="quality-group">
          <div className="quality-group__header">
            <h2>{group.title}</h2>
            <span>{group.items.length} leads</span>
          </div>

          <div className="business-grid">
            {group.items.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                selected={selectedLeadIds.has(business.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

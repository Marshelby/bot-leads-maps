import { useEffect, useState } from 'react';
import InternalNav from '../components/InternalNav';

export default function ScraperControl() {
  const [nichos, setNichos] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [region, setRegion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [nicho, setNicho] = useState('');
  const [status, setStatus] = useState('idle');
  const [processStatus, setProcessStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [processedResult, setProcessedResult] = useState(null);
  const [files, setFiles] = useState({ raw: [], processed: [] });

  useEffect(() => {
    let cancelled = false;

    async function loadFiles() {
      try {
        const response = await fetch('/api/files');
        if (!response.ok) {
          throw new Error('No se pudieron cargar los archivos');
        }

        const data = await response.json();
        if (!cancelled) {
          setFiles({
            raw: Array.isArray(data.raw) ? data.raw : [],
            processed: Array.isArray(data.processed) ? data.processed : [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setFiles({ raw: [], processed: [] });
        }
      }
    }

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNichos() {
      try {
        const response = await fetch('/api/config/nichos');
        if (!response.ok) {
          throw new Error('No se pudieron cargar los nichos');
        }

        const data = await response.json();
        if (!cancelled) {
          const nextNichos = Array.isArray(data.nichos) ? data.nichos : [];
          setNichos(nextNichos);
          setNicho((currentNiche) => (nextNichos.includes(currentNiche) ? currentNiche : nextNichos[0] || ''));
        }
      } catch (error) {
        if (!cancelled) {
          setNichos([]);
          setNicho('');
        }
      }
    }

    async function loadRegiones() {
      try {
        const response = await fetch('/api/config/regiones');
        if (!response.ok) {
          throw new Error('No se pudieron cargar las regiones');
        }

        const data = await response.json();
        if (!cancelled) {
          setRegiones(Array.isArray(data.regiones) ? data.regiones : []);
        }
      } catch (error) {
        if (!cancelled) {
          setRegiones([]);
        }
      }
    }

    loadNichos();
    loadRegiones();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCiudades() {
      if (!region) {
        setCiudades([]);
        setCiudad('');
        return;
      }

      try {
        const response = await fetch(`/api/config/ciudades?region=${encodeURIComponent(region)}`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar las ciudades');
        }

        const data = await response.json();
        if (!cancelled) {
          const nextCities = Array.isArray(data.ciudades) ? data.ciudades : [];
          setCiudades(nextCities);
          setCiudad((currentCity) => (nextCities.includes(currentCity) ? currentCity : ''));
        }
      } catch (error) {
        if (!cancelled) {
          setCiudades([]);
          setCiudad('');
        }
      }
    }

    loadCiudades();

    return () => {
      cancelled = true;
    };
  }, [region]);

  async function runScraper() {
    if (!ciudad || !nicho) {
      return;
    }

    setStatus('ejecutando');
    setResult(null);

    try {
      const response = await fetch('/api/scraper/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          city: ciudad,
          niche: nicho,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo ejecutar el scraper');
      }

      const data = await response.json();
      setResult(data);
      setStatus('terminado');
      await refreshFiles();
    } catch (error) {
      setStatus('error');
    }
  }

  async function refreshFiles() {
    const response = await fetch('/api/files');
    if (!response.ok) {
      throw new Error('No se pudieron cargar los archivos');
    }

    const data = await response.json();
    setFiles({
      raw: Array.isArray(data.raw) ? data.raw : [],
      processed: Array.isArray(data.processed) ? data.processed : [],
    });
  }

  async function runProcessor() {
    if (!region) {
      return;
    }

    setProcessStatus('ejecutando');
    setProcessedResult(null);

    try {
      const response = await fetch('/api/processor/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          region,
        }),
      });

      if (!response.ok) {
        throw new Error('No se pudo procesar la región');
      }

      const data = await response.json();
      setProcessedResult(data);
      setProcessStatus('terminado');
      await refreshFiles();
    } catch (error) {
      setProcessStatus('error');
    }
  }

  return (
    <main className="app-shell">
      <InternalNav />

      <section className="hero scraper-hero">
        <div className="scraper-hero__copy">
          <p className="eyebrow">Herramienta interna</p>
          <h1 className="scraper-hero__title">TusPaneles.cl</h1>
          <p className="scraper-hero__subtitle">Control de Scraper</p>
          <p className="hero-copy scraper-hero__description">
            Ejecuta scraping dinámico por región y nicho. El frontend solo envía parámetros al backend.
          </p>
        </div>
      </section>

      <section className="panel scraper-control">
        <div className="scraper-control__heading">
          <h2>Configuración de ejecución</h2>
          <p>Selecciona la zona de trabajo y lanza el flujo en un solo paso.</p>
        </div>

        <div className="controls">
          <div className="filter-group">
            <label htmlFor="region">Región</label>
            <select id="region" value={region} onChange={(event) => setRegion(event.target.value)}>
              <option value="">Seleccionar región</option>
              {regiones.map((regionOption) => (
                <option key={regionOption} value={regionOption}>
                  {regionOption}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="ciudad">Ciudad</label>
            <select id="ciudad" value={ciudad} onChange={(event) => setCiudad(event.target.value)} disabled={!region}>
              <option value="">{region ? 'Seleccionar ciudad' : 'Primero selecciona región'}</option>
              {ciudades.map((cityOption) => (
                <option key={cityOption} value={cityOption}>
                  {cityOption}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="nicho">Nicho</label>
            <select id="nicho" value={nicho} onChange={(event) => setNicho(event.target.value)} disabled={!nichos.length}>
              {nichos.length ? (
                nichos.map((nicheOption) => (
                  <option key={nicheOption} value={nicheOption}>
                    {nicheOption}
                  </option>
                ))
              ) : (
                <option value="">Sin nichos disponibles</option>
              )}
            </select>
          </div>

          <div className="scraper-control__action">
            <button
              className="button button-primary"
              type="button"
              onClick={runScraper}
              disabled={status === 'ejecutando' || !ciudad || !nicho}
            >
              Ejecutar scraping
            </button>
          </div>

          <div className="scraper-control__action">
            <button
              className="button button-secondary"
              type="button"
              onClick={runProcessor}
              disabled={processStatus === 'ejecutando' || !region}
            >
              Procesar región
            </button>
          </div>
        </div>

        {status !== 'idle' ? (
          <div className={`status status--${status}`}>
            {status === 'ejecutando'
              ? 'Scraping en progreso...'
              : status === 'terminado'
                ? 'Scraping completado'
                : 'Error al ejecutar scraping'}
          </div>
        ) : null}

        {result ? (
          <div className="status status--terminado">
            Resultado: {result.city} listo en <strong>{result.file}</strong>
          </div>
        ) : null}

        {processStatus !== 'idle' ? (
          <div className={`status status--${processStatus}`}>
            {processStatus === 'ejecutando'
              ? 'Procesando región...'
              : processStatus === 'terminado'
                ? 'Procesamiento completado'
                : 'Error al procesar región'}
          </div>
        ) : null}

        {processedResult ? (
          <div className="status status--terminado">
            Región procesada: {processedResult.region} con <strong>{processedResult.total}</strong> registros en{' '}
            <strong>{processedResult.file}</strong>
          </div>
        ) : null}
      </section>
    </main>
  );
}

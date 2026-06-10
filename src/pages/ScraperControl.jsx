import { useEffect, useState } from 'react';
import InternalNav from '../components/InternalNav';

export default function ScraperControl() {
  const [countries, setCountries] = useState([]);
  const [nichos, setNichos] = useState([]);
  const [regiones, setRegiones] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [country, setCountry] = useState('chile');
  const [mode, setMode] = useState('city');
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

    async function loadInitialConfig() {
      try {
        const [countriesResponse, nichosResponse] = await Promise.all([
          fetch('/api/config/countries'),
          fetch('/api/config/nichos'),
        ]);

        if (!countriesResponse.ok || !nichosResponse.ok) {
          throw new Error('No se pudo cargar la configuración inicial');
        }

        const [{ countries: countriesData }, { nichos: nichosData }] = await Promise.all([
          countriesResponse.json(),
          nichosResponse.json(),
        ]);

        if (!cancelled) {
          const nextCountries = Array.isArray(countriesData) ? countriesData : [];
          const nextNichos = Array.isArray(nichosData) ? nichosData : [];

          setCountries(nextCountries);
          setCountry((currentCountry) =>
            nextCountries.some((countryOption) => countryOption.id === currentCountry)
              ? currentCountry
              : nextCountries[0]?.id || '',
          );
          setNichos(nextNichos);
          setNicho((currentNiche) => (nextNichos.includes(currentNiche) ? currentNiche : nextNichos[0] || ''));
        }
      } catch (error) {
        if (!cancelled) {
          setCountries([]);
          setCountry('');
          setNichos([]);
          setNicho('');
        }
      }
    }

    loadInitialConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRegiones() {
      if (!country) {
        setRegiones([]);
        setRegion('');
        return;
      }

      try {
        const response = await fetch(`/api/config/regiones?country=${encodeURIComponent(country)}`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar las regiones');
        }

        const data = await response.json();
        if (!cancelled) {
          const nextRegions = Array.isArray(data?.regiones) ? data.regiones : [];
          setRegiones(nextRegions);
          setRegion((currentRegion) => (nextRegions.includes(currentRegion) ? currentRegion : ''));
        }
      } catch (error) {
        if (!cancelled) {
          setRegiones([]);
          setRegion('');
        }
      }
    }

    loadRegiones();

    return () => {
      cancelled = true;
    };
  }, [country]);

  useEffect(() => {
    let cancelled = false;

    async function loadCiudades() {
      if (!country || !region) {
        setCiudades([]);
        setCiudad('');
        return;
      }

      try {
        const searchParams = new URLSearchParams({
          country,
          region,
        });
        const response = await fetch(`/api/config/ciudades?${searchParams.toString()}`);
        if (!response.ok) {
          throw new Error('No se pudieron cargar las ciudades');
        }

        const data = await response.json();
        if (!cancelled) {
          const nextCities = Array.isArray(data?.ciudades) ? data.ciudades : [];
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
  }, [country, region]);

  useEffect(() => {
    if (mode === 'region') {
      setCiudad('');
    }
  }, [mode]);

  async function runScraper() {
    if (!country || !region || !nicho) {
      return;
    }

    if (mode === 'city' && !ciudad) {
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
          country,
          mode,
          region,
          city: mode === 'city' ? ciudad : '',
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

  const selectedCountry = countries.find((countryOption) => countryOption.id === country);
  const canRunScraper = mode === 'city' ? Boolean(country && region && ciudad && nicho) : Boolean(country && region && nicho);

  return (
    <main className="app-shell">
      <InternalNav />

      <section className="hero scraper-hero">
        <div className="scraper-hero__copy">
          <p className="eyebrow">Herramienta interna</p>
          <h1 className="scraper-hero__title">TusPaneles.cl</h1>
          <p className="scraper-hero__subtitle">Control de Scraper</p>
          <p className="hero-copy scraper-hero__description">
            Ejecuta scraping dinámico por país, región, ciudad o región completa sin tocar el motor base.
          </p>
        </div>
      </section>

      <section className="panel scraper-control">
        <div className="scraper-control__heading">
          <h2>Configuración de ejecución</h2>
          <p>Selecciona el país, el modo de orquestación y lanza el scraping con el mismo pipeline de siempre.</p>
        </div>

        <div className="controls">
          <div className="filter-group">
            <label htmlFor="country">País</label>
            <select id="country" value={country} onChange={(event) => setCountry(event.target.value)} disabled={!countries.length}>
              <option value="">{countries.length ? 'Seleccionar país' : 'Sin países disponibles'}</option>
              {countries.map((countryOption) => (
                <option key={countryOption.id} value={countryOption.id}>
                  {countryOption.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="mode">Modo</label>
            <select id="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="city">Modo Ciudad</option>
              <option value="region">Modo Región</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="region">Región</label>
            <select id="region" value={region} onChange={(event) => setRegion(event.target.value)} disabled={!country}>
              <option value="">{country ? 'Seleccionar región' : 'Primero selecciona país'}</option>
              {regiones.map((regionOption) => (
                <option key={regionOption} value={regionOption}>
                  {regionOption}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="ciudad">Ciudad</label>
            <select
              id="ciudad"
              value={ciudad}
              onChange={(event) => setCiudad(event.target.value)}
              disabled={!region || mode === 'region'}
            >
              <option value="">
                {mode === 'region'
                  ? 'No aplica en modo región'
                  : region
                    ? 'Seleccionar ciudad'
                    : 'Primero selecciona región'}
              </option>
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
              disabled={status === 'ejecutando' || !canRunScraper}
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
            {result.mode === 'region' ? (
              <>
                Región procesada: {result.region} ({selectedCountry?.label || result.country_label}) con{' '}
                <strong>{result.cities_successful}</strong> ciudades exitosas, <strong>{result.cities_with_error}</strong>{' '}
                con error y <strong>{result.total}</strong> leads encontrados.
                {result.files?.length ? (
                  <>
                    {' '}Archivos generados: <strong>{result.files.length}</strong>.
                  </>
                ) : null}
              </>
            ) : (
              <>
                Resultado: {result.city} listo en <strong>{result.file}</strong> con <strong>{result.total}</strong>{' '}
                registros.
              </>
            )}
          </div>
        ) : null}

        {result?.mode === 'region' && Array.isArray(result.results) ? (
          <div className="panel">
            <h3>Reporte regional</h3>
            <p>
              Región procesada: <strong>{result.region}</strong> | Ciudades procesadas:{' '}
              <strong>{result.cities_processed}</strong> | Ciudades exitosas: <strong>{result.cities_successful}</strong> |
              Ciudades con error: <strong>{result.cities_with_error}</strong> | Leads encontrados:{' '}
              <strong>{result.total}</strong>
            </p>
            <ul>
              {result.results.map((item) => (
                <li key={item.city}>
                  {item.city}: {item.status === 'completed'
                    ? `${item.total} leads -> ${item.file}`
                    : `ERROR -> ${item.error}`}
                </li>
              ))}
            </ul>
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

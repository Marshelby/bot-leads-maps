import { useEffect, useMemo, useState } from 'react';
import BusinessGrid from '../components/BusinessGrid';
import CampaignModal from '../components/CampaignModal';
import CampaignPanel from '../components/CampaignPanel';
import FilterBar from '../components/FilterBar';
import InternalNav from '../components/InternalNav';
import { filterBusinesses, flattenBusinesses } from '../lib/data';

function buildRegionFileName(region) {
  return region
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export default function DirectoryPage() {
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [status, setStatus] = useState('loading');
  const [configStatus, setConfigStatus] = useState('loading');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortOrder, setSortOrder] = useState('rating-desc');
  const [region, setRegion] = useState('Valparaíso');
  const [niche, setNiche] = useState('');
  const [regiones, setRegiones] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [nichos, setNichos] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [isCampaignOpen, setIsCampaignOpen] = useState(false);
  const [leadInteractions, setLeadInteractions] = useState({});
  const [activeChannel, setActiveChannel] = useState('whatsapp');
  const [messageWhatsApp, setMessageWhatsApp] = useState(
    'Hola [NOMBRE], vi tu negocio en [CIUDAD] y tengo una idea rápida para ayudarte a conseguir más clientes. ¿Te interesa?',
  );
  const [messageInstagram, setMessageInstagram] = useState(
    'Hola! Estuve viendo tu perfil en [CIUDAD] 👀 Tengo una idea que podría ayudarte a atraer más clientes 🙌 ¿Te cuento?',
  );
  const [messageGmail, setMessageGmail] = useState(
    'Asunto: Idea para aumentar clientes en [CIUDAD]\n\nHola [NOMBRE],\n\nEstuve revisando tu negocio y veo una oportunidad interesante para ayudarte a captar más clientes en [CIUDAD].\n\nSi te interesa, puedo explicarte brevemente cómo funcionaría.\n\nQuedo atento,',
  );
  const [previewLeadId, setPreviewLeadId] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const regionFileName = buildRegionFileName(region || 'Valparaíso');
        const response = await fetch(`/regiones/${regionFileName}.json`);
        const data = await response.json();
        setAllBusinesses(flattenBusinesses(data));
        setStatus('ready');
      } catch (error) {
        console.error('Error cargando datos procesados:', error);
        setStatus('error');
      }
    }

    loadData();
  }, [region]);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const [regionesResponse, nichosResponse] = await Promise.all([
          fetch('/regiones_config.json'),
          fetch('/nichos_config.json'),
        ]);

        if (!regionesResponse.ok || !nichosResponse.ok) {
          throw new Error('No se pudo cargar la configuración del directorio');
        }

        const [regionesData, nichosData] = await Promise.all([
          regionesResponse.json(),
          nichosResponse.json(),
        ]);

        if (!cancelled) {
          const nextRegiones = Array.isArray(regionesData) ? regionesData : [];
          const nextNichos = Array.isArray(nichosData) ? nichosData : [];

          setRegiones(nextRegiones);
          setNichos(nextNichos);
          setNiche((currentNiche) => (nextNichos.includes(currentNiche) ? currentNiche : ''));
          setConfigStatus('ready');
        }
      } catch (error) {
        console.error('Error cargando configuración del directorio:', error);
        if (!cancelled) {
          setRegiones([]);
          setNichos([]);
          setConfigStatus('error');
        }
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCiudades() {
      if (!region) {
        setCiudades([]);
        setCity('');
        return;
      }

      try {
        const response = await fetch('/ciudades_config.json');
        if (!response.ok) {
          throw new Error('No se pudieron cargar las ciudades');
        }

        const data = await response.json();
        if (!cancelled) {
          const nextCities = Array.isArray(data?.[region]) ? data[region] : [];
          setCiudades(nextCities);
          setCity((currentCity) => (nextCities.includes(currentCity) ? currentCity : ''));
        }
      } catch (error) {
        console.error('Error cargando ciudades del directorio:', error);
        if (!cancelled) {
          setCiudades([]);
          setCity('');
        }
      }
    }

    loadCiudades();

    return () => {
      cancelled = true;
    };
  }, [region]);

  const filteredBusinesses = useMemo(
    () =>
      filterBusinesses(allBusinesses, {
        query,
        city,
        region,
        niche,
        minRating,
        sortOrder,
      }),
    [allBusinesses, city, minRating, niche, query, region, sortOrder],
  );

  const selectedLeadIds = useMemo(() => new Set(selectedLeads.map((lead) => lead.id)), [selectedLeads]);
  const campaignDraft = useMemo(
    () => ({
      activeChannel,
      messages: {
        whatsapp: messageWhatsApp,
        instagram: messageInstagram,
        gmail: messageGmail,
      },
      variables: ['[NOMBRE]', '[CIUDAD]'],
      totalLeads: selectedLeads.length,
      leads: selectedLeads.map((lead) => ({
        id: lead.id,
        nombre: lead.nombre,
        ciudad: lead.ciudad,
        telefono: lead.telefono,
        email: lead.email,
        instagram: lead.instagram,
        web: lead.web,
        googleMapsUrl: lead.googleMapsUrl,
        interaction: leadInteractions[lead.id] || null,
      })),
    }),
    [activeChannel, leadInteractions, messageGmail, messageInstagram, messageWhatsApp, selectedLeads],
  );

  function updateChannelMessage(channel, value) {
    if (channel === 'whatsapp') {
      setMessageWhatsApp(value);
      return;
    }

    if (channel === 'instagram') {
      setMessageInstagram(value);
      return;
    }

    setMessageGmail(value);
  }

  function toggleLeadSelection(business) {
    setSelectedLeads((currentLeads) => {
      const alreadySelected = currentLeads.some((lead) => lead.id === business.id);

      if (alreadySelected) {
        const nextLeads = currentLeads.filter((lead) => lead.id !== business.id);
        if (previewLeadId === business.id) {
          setPreviewLeadId(nextLeads[0]?.id || '');
        }
        return nextLeads;
      }

      const nextLeads = [...currentLeads, business];
      if (!previewLeadId) {
        setPreviewLeadId(business.id);
      }
      return nextLeads;
    });
  }

  function selectAllVisible() {
    setSelectedLeads((currentLeads) => {
      const currentIds = new Set(currentLeads.map((lead) => lead.id));
      const nextLeads = [...currentLeads];

      filteredBusinesses.forEach((business) => {
        if (!currentIds.has(business.id)) {
          nextLeads.push(business);
        }
      });

      if (!previewLeadId && filteredBusinesses[0]) {
        setPreviewLeadId(filteredBusinesses[0].id);
      }

      return nextLeads;
    });
  }

  function clearVisibleSelection() {
    const visibleIds = new Set(filteredBusinesses.map((business) => business.id));

    setSelectedLeads((currentLeads) => {
      const nextLeads = currentLeads.filter((lead) => !visibleIds.has(lead.id));

      if (previewLeadId && visibleIds.has(previewLeadId)) {
        setPreviewLeadId(nextLeads[0]?.id || '');
      }

      return nextLeads;
    });
  }

  function openCampaign() {
    if (selectedLeads.length === 0) {
      return;
    }

    setPreviewLeadId((currentId) => currentId || selectedLeads[0].id);
    setIsCampaignOpen(true);
  }

  function closeCampaign() {
    setIsCampaignOpen(false);
  }

  function registerLeadInteraction(leadId, channel) {
    setLeadInteractions((currentInteractions) => {
      const timestamp = new Date().toISOString();
      const previous = currentInteractions[leadId];
      const history = Array.isArray(previous?.history) ? previous.history : [];

      return {
        ...currentInteractions,
        [leadId]: {
          last_contacted: timestamp,
          last_channel: channel,
          history: [
            {
              channel,
              date: timestamp,
            },
            ...history,
          ],
        },
      };
    });
  }

  if (status === 'loading') {
    return (
      <main className="app-shell">
        <InternalNav />
        <section className="hero">
          <p className="eyebrow">Panel de Inteligencia</p>
          <h1>Directorio inteligente de TusPaneles</h1>
          <p className="hero-copy">Cargando datos procesados...</p>
        </section>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <InternalNav />
        <section className="panel empty-state">
          <h1>Error de carga</h1>
          <p>No fue posible leer `datos_procesados.json` desde la carpeta `public`.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell directory-page">
      <InternalNav />

      <section className="directory-top-module">
        <section className="hero hero--directory hero--directory-unified">
          <div className="directory-hero__content">
            <div className="directory-hero__copy">
              <p className="eyebrow">Panel de Inteligencia</p>
              <h1>Directorio inteligente de TusPaneles</h1>
              <p className="hero-copy">
                Explora negocios por zona, aplica filtros de calidad y abre cada ficha directo en Google Maps.
              </p>
            </div>

            <div className="directory-hero__controls">
              <div className="filter-group">
                <label htmlFor="top-region">Región</label>
                <select id="top-region" value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="">Seleccionar región</option>
                  {regiones.map((regionOption) => (
                    <option key={regionOption} value={regionOption}>
                      {regionOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="top-city">Ciudad</label>
                <select
                  id="top-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  disabled={!region || !ciudades.length}
                >
                  <option value="">{region ? 'Seleccionar ciudad' : 'Seleccionar región primero'}</option>
                  {ciudades.map((cityOption) => (
                    <option key={cityOption} value={cityOption}>
                      {cityOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="top-niche">Nicho</label>
                <select
                  id="top-niche"
                  value={niche}
                  onChange={(event) => setNiche(event.target.value)}
                  disabled={configStatus !== 'ready' || !nichos.length}
                >
                  <option value="">Seleccionar nicho</option>
                  {nichos.map((nicheOption) => (
                    <option key={nicheOption} value={nicheOption}>
                      {nicheOption}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <CampaignPanel
          className="campaign-panel--directory"
          selectedCount={selectedLeads.length}
          onOpen={openCampaign}
          onSelectAll={selectAllVisible}
          onClearSelection={clearVisibleSelection}
        />
      </section>

      <FilterBar
        query={query}
        minRating={minRating}
        sortOrder={sortOrder}
        onQueryChange={setQuery}
        onMinRatingChange={setMinRating}
        onSortChange={setSortOrder}
      />

      <BusinessGrid
        businesses={filteredBusinesses}
        selectedLeadIds={selectedLeadIds}
        onToggleSelect={toggleLeadSelection}
      />

      <CampaignModal
        isOpen={isCampaignOpen}
        activeChannel={activeChannel}
        channelMessages={campaignDraft.messages}
        selectedLeads={selectedLeads}
        previewLeadId={previewLeadId}
        campaignDraft={campaignDraft}
        onClose={closeCampaign}
        onChannelChange={setActiveChannel}
        onMessageChange={updateChannelMessage}
        onPreviewLeadChange={setPreviewLeadId}
        onToggleLeadSelection={toggleLeadSelection}
        leadInteractions={leadInteractions}
        onRegisterInteraction={registerLeadInteraction}
      />
    </main>
  );
}

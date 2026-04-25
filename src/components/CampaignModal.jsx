import { useEffect, useMemo, useRef, useState } from 'react';
import { openGmailLead } from '../lib/gmail';
import { copyInstagramMessage, getInstagramUrl, openInstagramProfile } from '../lib/instagram';
import { buildLeadContactId } from '../lib/leads';
import { fillWhatsAppTemplate, getWhatsAppReadyLeads, openWhatsAppLead } from '../lib/whatsapp';

const CHANNELS = ['whatsapp', 'instagram', 'gmail'];

export default function CampaignModal({
  isOpen,
  activeChannel,
  channelMessages,
  selectedLeads,
  previewLeadId,
  campaignDraft,
  onClose,
  onChannelChange,
  onMessageChange,
  onPreviewLeadChange,
  onToggleLeadSelection,
  leadInteractions,
  contactedLeadIds,
  onMarkContacted,
  onRegisterInteraction,
}) {
  const [copiedLeadId, setCopiedLeadId] = useState('');
  const [rapidMode, setRapidMode] = useState(true);
  const [viewMode, setViewMode] = useState('compact');
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [filters, setFilters] = useState({
    withPhone: false,
    withInstagram: false,
    completeOnly: false,
  });
  const [leadStatuses, setLeadStatuses] = useState({});
  const leadCardRefs = useRef({});
  const completedDropdownRef = useRef(null);

  const currentMessage = channelMessages[activeChannel] || '';
  const whatsappReadyIds = useMemo(
    () => new Set(getWhatsAppReadyLeads(selectedLeads, channelMessages.whatsapp).map((lead) => lead.id)),
    [channelMessages.whatsapp, selectedLeads],
  );

  const leadsWithMeta = useMemo(
    () =>
      selectedLeads.map((lead) => {
        const hasPhone = whatsappReadyIds.has(lead.id);
        const instagramUrl = getInstagramUrl(lead);
        const hasInstagram = Boolean(instagramUrl);
        const webUrl = getWebUrl(lead, instagramUrl);
        const hasWeb = Boolean(webUrl);
        const hasEmail = Boolean(lead.email && String(lead.email).includes('@'));
        const isComplete = hasPhone && hasInstagram && hasEmail;
        const interaction = leadInteractions?.[lead.id] || null;

        return {
          ...lead,
          hasPhone,
          hasInstagram,
          hasEmail,
          isComplete,
          instagramUrl,
          webUrl,
          hasWeb,
          interaction,
          primaryChannel: resolvePrimaryChannel({ hasPhone, hasInstagram }),
        };
      }),
    [leadInteractions, selectedLeads, whatsappReadyIds],
  );

  const visibleLeads = useMemo(
    () =>
      leadsWithMeta.filter((lead) => {
        if (filters.withPhone && !lead.hasPhone) {
          return false;
        }

        if (filters.withInstagram && !lead.hasInstagram) {
          return false;
        }

        if (filters.completeOnly && !lead.isComplete) {
          return false;
        }

        return true;
      }),
    [filters, leadsWithMeta],
  );

  const previewLead =
    visibleLeads.find((lead) => lead.id === previewLeadId) ||
    selectedLeads.find((lead) => lead.id === previewLeadId) ||
    visibleLeads[0] ||
    selectedLeads[0] ||
    null;

  const previewLeadMeta = previewLead
    ? leadsWithMeta.find((lead) => lead.id === previewLead.id) || null
    : null;
  const previewLeadIndex = previewLeadMeta
    ? visibleLeads.findIndex((lead) => lead.id === previewLeadMeta.id)
    : -1;

  const contactedCount = useMemo(
    () =>
      leadsWithMeta.filter((lead) => isLeadContacted(lead, leadStatuses)).length,
    [leadStatuses, leadsWithMeta],
  );
  const completedLeads = useMemo(
    () => leadsWithMeta.filter((lead) => isLeadContacted(lead, leadStatuses)),
    [leadStatuses, leadsWithMeta],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setLeadStatuses((currentStatuses) => {
      const nextStatuses = {};

      leadsWithMeta.forEach((lead) => {
        if (
          currentStatuses[lead.id] === 'contactado' ||
          contactedLeadIds.has(buildLeadContactId(lead)) ||
          lead.interaction?.last_contacted
        ) {
          nextStatuses[lead.id] = 'contactado';
          return;
        }

        nextStatuses[lead.id] = lead.primaryChannel === 'copy' ? 'sin canal' : 'listo';
      });

      return nextStatuses;
    });
  }, [contactedLeadIds, isOpen, leadsWithMeta]);

  useEffect(() => {
    if (!isOpen || !previewLead) {
      return;
    }

    onPreviewLeadChange(previewLead.id);
  }, [isOpen, onPreviewLeadChange, previewLead]);

  useEffect(() => {
    if (!isOpen || !previewLeadId) {
      return;
    }

    leadCardRefs.current[previewLeadId]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [isOpen, previewLeadId]);

  useEffect(() => {
    if (!isOpen || !isCompletedOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!completedDropdownRef.current?.contains(event.target)) {
        setIsCompletedOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isCompletedOpen, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      const target = event.target;
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'SELECT');

      if (event.key === 'Tab') {
        event.preventDefault();
        cycleChannel(activeChannel, onChannelChange);
        return;
      }

      if (!previewLeadMeta) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        movePreview(1, visibleLeads, previewLeadMeta.id, onPreviewLeadChange);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        movePreview(-1, visibleLeads, previewLeadMeta.id, onPreviewLeadChange);
        return;
      }

      if (isEditable) {
        return;
      }

      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        void handleCopyOnly(previewLeadMeta);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        void handlePrimaryAction(previewLeadMeta);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeChannel, isOpen, onChannelChange, onPreviewLeadChange, previewLeadMeta, visibleLeads]);

  if (!isOpen) {
    return null;
  }

  const progressPercent = selectedLeads.length === 0 ? 0 : Math.round((contactedCount / selectedLeads.length) * 100);
  const previewText = previewLead ? fillWhatsAppTemplate(currentMessage, previewLead) : '';

  function updateFilter(key) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: !currentFilters[key],
    }));
  }

  async function markLeadAsContacted(lead, channel) {
    if (!lead) {
      return;
    }

    await onMarkContacted(lead, channel);
    const leadId = lead.id;
    onRegisterInteraction(leadId, channel);
    setLeadStatuses((currentStatuses) => ({
      ...currentStatuses,
      [leadId]: 'contactado',
    }));
    advanceToNextLead(leadId);
  }

  function advanceToNextLead(currentLeadId) {
    if (visibleLeads.length === 0) {
      return;
    }

    const currentIndex = visibleLeads.findIndex((lead) => lead.id === currentLeadId);
    const nextLead =
      visibleLeads
        .slice(currentIndex + 1)
        .find((lead) => !isLeadContacted(lead, leadStatuses) && lead.primaryChannel !== 'copy') ||
      visibleLeads[currentIndex + 1] ||
      visibleLeads[currentIndex] ||
      visibleLeads[0];

    if (nextLead) {
      onPreviewLeadChange(nextLead.id);
    }
  }

  async function handleCopyOnly(lead) {
    const copied = await copyResolvedMessage(lead, currentMessage);
    if (!copied) {
      return false;
    }

    setCopiedLeadId(lead.id);
    window.setTimeout(() => {
      setCopiedLeadId((currentId) => (currentId === lead.id ? '' : currentId));
    }, 1600);

    return true;
  }

  async function handlePrimaryAction(lead) {
    if (!lead) {
      return;
    }

    const actionConfig = getOptimalChannelConfig(lead);

    await handleChannelAction(lead, actionConfig.channel);
  }

  async function handleChannelAction(lead, channel) {
    if (channel === 'whatsapp') {
      openWhatsAppLead(lead, channelMessages.whatsapp);
      return;
    }

    if (channel === 'instagram') {
      await copyInstagramMessage(lead, channelMessages.instagram);
      openInstagramProfile(lead);
      setCopiedLeadId(lead.id);
      window.setTimeout(() => {
        setCopiedLeadId((currentId) => (currentId === lead.id ? '' : currentId));
      }, 1600);
      return;
    }

    if (channel === 'web') {
      await handleWebAction(lead);
      return;
    }

    if (channel === 'gmail') {
      openGmailLead(lead, channelMessages.gmail);
      return;
    }

    await handleCopyOnly(lead);
  }

  function handleSecondaryChannel(lead, channel) {
    void handleChannelAction(lead, channel);
  }

  function keepOnlyReadyLeads() {
    leadsWithMeta.forEach((lead) => {
      if (lead.primaryChannel === 'copy' || isLeadContacted(lead, leadStatuses)) {
        onToggleLeadSelection(lead);
      }
    });
  }

  return (
    <div className="campaign-workspace-backdrop">
      <section
        className="campaign-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-title"
      >
        <header className="campaign-workspace__header">
          <div className="campaign-workspace__headline">
            <div>
              <p className="eyebrow eyebrow-dark">Campaña</p>
              <h2 id="campaign-title">Activación de leads</h2>
              <p className="campaign-workspace__copy">
                Workspace de ejecución continua para contactar leads sin fricción.
              </p>
            </div>

            <div className="campaign-progress">
              <div className="campaign-progress__meta" ref={completedDropdownRef}>
                <button
                  className={`campaign-progress__trigger ${isCompletedOpen ? 'campaign-progress__trigger--open' : ''}`}
                  type="button"
                  onClick={() => setIsCompletedOpen((currentValue) => !currentValue)}
                >
                  <strong>{contactedCount} / {selectedLeads.length} leads contactados</strong>
                  <span>{progressPercent}% completado</span>
                  <i aria-hidden="true">{isCompletedOpen ? '▴' : '▾'}</i>
                </button>

                {isCompletedOpen ? (
                  <div className="campaign-progress__dropdown">
                    {completedLeads.length > 0 ? (
                      completedLeads.map((lead) => (
                        <button
                          key={lead.id}
                          className="campaign-progress__lead"
                          type="button"
                          onClick={() => {
                            onPreviewLeadChange(lead.id);
                            setIsCompletedOpen(false);
                          }}
                        >
                          <div>
                            <strong>{lead.nombre}</strong>
                            <span>{lead.ciudad}</span>
                          </div>
                          <div className="campaign-progress__lead-meta">
                            <span>{formatChannelLabel(lead.interaction?.last_channel)}</span>
                            <b>Listo</b>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="campaign-progress__empty">Aun no hay leads listos.</div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="campaign-progress__bar">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="campaign-workspace__top-actions">
            <label className="workspace-toggle">
              <input
                type="checkbox"
                checked={rapidMode}
                onChange={() => setRapidMode((currentValue) => !currentValue)}
              />
              <span>Modo envío rápido</span>
            </label>

            <div className="workspace-view-switcher" role="tablist" aria-label="Vista de leads">
              <button
                className={`workspace-view-switcher__button ${viewMode === 'compact' ? 'workspace-view-switcher__button--active' : ''}`}
                type="button"
                onClick={() => setViewMode('compact')}
              >
                Compacto
              </button>
              <button
                className={`workspace-view-switcher__button ${viewMode === 'visual' ? 'workspace-view-switcher__button--active' : ''}`}
                type="button"
                onClick={() => setViewMode('visual')}
              >
                Visual
              </button>
            </div>

            <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
        </header>

        <div className="campaign-workspace__body">
          <section className="campaign-editor-column">
            <div className="panel campaign-editor-panel">
              <div className="campaign-editor-panel__top">
                <div className="campaign-channel-switcher">
                  {CHANNELS.map((channel) => (
                    <button
                      key={channel}
                      className={`channel-tab ${activeChannel === channel ? 'channel-tab--active' : ''}`}
                      type="button"
                      onClick={() => onChannelChange(channel)}
                    >
                      {formatChannelLabel(channel)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="campaign-message">Editor de mensaje</label>
                <textarea
                  id="campaign-message"
                  className="campaign-textarea"
                  value={currentMessage}
                  onChange={(event) => onMessageChange(activeChannel, event.target.value)}
                  placeholder="Escribe un mensaje para este canal."
                />
                <p className="field-hint">Variables disponibles: [NOMBRE], [CIUDAD]</p>
              </div>
            </div>

            <div className="panel campaign-preview-panel">
              <div className="campaign-preview-panel__header">
                <div>
                  <label className="campaign-preview-panel__label">Preview operativo</label>
                  <strong>
                    {previewLead ? `${previewLead.nombre} · ${previewLead.ciudad}` : 'Selecciona un lead'}
                  </strong>
                </div>
                <div className="campaign-preview-panel__meta">
                  {previewLeadMeta ? (
                    <span className={`lead-status-badge lead-status-badge--${getLeadStatusTone(leadStatuses[previewLeadMeta.id])}`}>
                      {formatLeadStatus(leadStatuses[previewLeadMeta.id])}
                    </span>
                  ) : null}
                  <div className="campaign-preview-nav" aria-label="Navegación entre leads">
                    <button
                      className="campaign-preview-nav__button"
                      type="button"
                      disabled={previewLeadIndex <= 0}
                      onClick={() => movePreview(-1, visibleLeads, previewLeadMeta?.id || '', onPreviewLeadChange)}
                    >
                      ←
                    </button>
                    <button
                      className="campaign-preview-nav__button"
                      type="button"
                      disabled={previewLeadIndex === -1 || previewLeadIndex >= visibleLeads.length - 1}
                      onClick={() => movePreview(1, visibleLeads, previewLeadMeta?.id || '', onPreviewLeadChange)}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              <div className="campaign-preview">
                <div className="campaign-preview__bubble">
                  <p>{previewLead ? previewText : 'Selecciona un lead para ver el mensaje completo.'}</p>
                </div>
              </div>

              {previewLeadMeta ? (
                <div className="campaign-preview-panel__actions">
                  <button
                    className="button button-secondary campaign-preview-panel__done"
                    type="button"
                    onClick={() => {
                      void markLeadAsContacted(previewLeadMeta, 'manual');
                    }}
                  >
                    Contactado
                  </button>
                  {getContactActions(previewLeadMeta, copiedLeadId === previewLeadMeta.id).map((action) => (
                    <button
                      key={action.key}
                      className={action.buttonClassName}
                      type="button"
                      disabled={
                        isLeadContacted(previewLeadMeta, leadStatuses) &&
                        (action.channel === 'whatsapp' || action.channel === 'instagram')
                      }
                      onClick={() => {
                        if (action.channel === 'copy') {
                          void handleCopyOnly(previewLeadMeta);
                          return;
                        }
                        void handleChannelAction(previewLeadMeta, action.channel);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                  {!rapidMode ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => onToggleLeadSelection(previewLeadMeta)}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="campaign-right-panel">
            <div className="panel campaign-right-panel__filters">
              <div className="campaign-right-panel__topline">
                <label className="campaign-right-panel__title">Cola de activación</label>
                <span>{visibleLeads.length} visibles</span>
              </div>

              <div className="lead-filters">
                <label className="lead-filter-pill">
                  <input
                    type="checkbox"
                    checked={filters.withPhone}
                    onChange={() => updateFilter('withPhone')}
                  />
                  <span>Solo teléfono</span>
                </label>
                <label className="lead-filter-pill">
                  <input
                    type="checkbox"
                    checked={filters.withInstagram}
                    onChange={() => updateFilter('withInstagram')}
                  />
                  <span>Solo Instagram</span>
                </label>
                <label className="lead-filter-pill">
                  <input
                    type="checkbox"
                    checked={filters.completeOnly}
                    onChange={() => updateFilter('completeOnly')}
                  />
                  <span>Completos</span>
                </label>
              </div>

              <div className="campaign-right-panel__actions">
                <button className="button button-secondary" type="button" onClick={keepOnlyReadyLeads}>
                  Seleccionar leads listos
                </button>
                <div className="campaign-shortcuts">
                  <span>↓ siguiente</span>
                  <span>↑ anterior</span>
                  <span>Enter enviar</span>
                  <span>Shift+Enter copiar</span>
                  <span>Tab canal</span>
                </div>
              </div>
            </div>

            <div className="campaign-lead-list">
              {visibleLeads.map((lead, index) => {
                const status = leadStatuses[lead.id];
                const interactionMeta = getInteractionMeta(leadInteractions, lead.id);
                const isActive = previewLead?.id === lead.id;

                return (
                  <article
                    key={lead.id}
                    ref={(node) => {
                      leadCardRefs.current[lead.id] = node;
                    }}
                    className={`panel campaign-lead-card campaign-lead-card--${viewMode} ${isActive ? 'campaign-lead-card--active' : ''} ${isLeadContacted(lead, leadStatuses) ? 'campaign-lead-card--done' : ''}`}
                    onClick={() => onPreviewLeadChange(lead.id)}
                  >
                    <div className="campaign-lead-card__content">
                      <div className="campaign-lead-card__header">
                        <div className="campaign-lead-card__identity">
                          <strong>{lead.nombre}</strong>
                          <span>{lead.ciudad}</span>
                        </div>
                        <div className="campaign-lead-card__badges">
                          <span className={`lead-status-badge lead-status-badge--${getLeadStatusTone(status)}`}>
                            {formatLeadStatus(status)}
                          </span>
                          <span className={`quality-score ${getLeadQualityClassName(lead)}`}>
                            {getPrimaryChannelShortLabel(lead.primaryChannel)}
                          </span>
                        </div>
                      </div>

                      {!rapidMode ? (
                        <>
                          <div className="lead-interaction">
                            <span>{interactionMeta.label}</span>
                            <span>{interactionMeta.channel}</span>
                          </div>
                          <div className="lead-contact-lines">
                            <span>Teléfono: {lead.hasPhone ? lead.telefono : 'No disponible'}</span>
                            <span>Instagram: {lead.hasInstagram ? 'Disponible' : 'No disponible'}</span>
                            <span>Email: {lead.hasEmail ? lead.email : 'No disponible'}</span>
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="lead-actions">
                      {getContactActions(lead, copiedLeadId === lead.id).map((action) => (
                        <button
                          key={action.key}
                          className={action.buttonClassName}
                          type="button"
                          disabled={
                            isLeadContacted(lead, leadStatuses) &&
                            (action.channel === 'whatsapp' || action.channel === 'instagram')
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            if (action.channel === 'copy') {
                              void handleCopyOnly(lead);
                              return;
                            }
                            handleSecondaryChannel(lead, action.channel);
                          }}
                        >
                          {action.shortLabel}
                        </button>
                      ))}

                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void markLeadAsContacted(lead, 'manual');
                        }}
                      >
                        Contactado
                      </button>

                      {!rapidMode ? (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleLeadSelection(lead);
                          }}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>

                    <span className="campaign-lead-card__index">{index + 1}</span>
                  </article>
                );
              })}

              {visibleLeads.length === 0 ? (
                <div className="panel campaign-empty-filter">
                  Ningún lead coincide con los filtros actuales.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function resolvePrimaryChannel(lead) {
  if (lead.hasPhone) {
    return 'whatsapp';
  }

  if (lead.hasInstagram) {
    return 'instagram';
  }

  if (lead.hasWeb) {
    return 'web';
  }

  return 'copy';
}

function cycleChannel(currentChannel, onChannelChange) {
  const currentIndex = CHANNELS.indexOf(currentChannel);
  const nextChannel = CHANNELS[(currentIndex + 1) % CHANNELS.length];
  onChannelChange(nextChannel);
}

function movePreview(direction, visibleLeads, currentLeadId, onPreviewLeadChange) {
  if (visibleLeads.length === 0) {
    return;
  }

  const currentIndex = visibleLeads.findIndex((lead) => lead.id === currentLeadId);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = Math.min(Math.max(baseIndex + direction, 0), visibleLeads.length - 1);
  onPreviewLeadChange(visibleLeads[nextIndex].id);
}

function getLeadQualityClassName(lead) {
  if (lead.primaryChannel === 'whatsapp') {
    return 'quality-score--high';
  }

  if (lead.primaryChannel === 'instagram') {
    return 'quality-score--medium';
  }

  return 'quality-score--low';
}

function getPrimaryChannelShortLabel(channel) {
  if (channel === 'whatsapp') {
    return 'WA';
  }

  if (channel === 'instagram') {
    return 'IG';
  }

  if (channel === 'web') {
    return 'WEB';
  }

  return 'CP';
}

function getOptimalChannelConfig(lead, wasCopied = false) {
  const channel = resolvePrimaryChannel(lead);

  if (channel === 'whatsapp') {
    return {
      channel,
      icon: 'WA',
      label: 'WA Enviar por WhatsApp',
      buttonClassName: 'button-primary--whatsapp',
    };
  }

  if (channel === 'instagram') {
    return {
      channel,
      icon: 'IG',
      label: 'IG Enviar por Instagram',
      buttonClassName: 'button-primary--instagram',
    };
  }

  if (channel === 'web') {
    return {
      channel,
      icon: 'WEB',
      label: 'WEB Abrir enlace',
      buttonClassName: 'button-primary--web',
    };
  }

  return {
    channel,
    icon: 'CP',
    label: wasCopied ? 'CP Mensaje copiado' : 'CP Copiar mensaje',
    buttonClassName: 'button-primary--copy',
  };
}

function getContactActions(lead, wasCopied = false) {
  const actions = [];

  if (lead.hasPhone) {
    actions.push({
      key: `${lead.id}-whatsapp`,
      channel: 'whatsapp',
      label: 'WA WhatsApp',
      shortLabel: 'WA',
      buttonClassName: 'button button-primary button-primary--whatsapp',
    });
  }

  if (lead.hasInstagram) {
    actions.push({
      key: `${lead.id}-instagram`,
      channel: 'instagram',
      label: 'IG Instagram',
      shortLabel: 'IG',
      buttonClassName: 'button button-primary button-primary--instagram',
    });
  }

  if (lead.hasEmail) {
    actions.push({
      key: `${lead.id}-gmail`,
      channel: 'gmail',
      label: 'GM Gmail',
      shortLabel: 'GM',
      buttonClassName: 'button button-primary button-primary--web',
    });
  }

  if (lead.hasWeb) {
    actions.push({
      key: `${lead.id}-web`,
      channel: 'web',
      label: 'WEB Abrir enlace',
      shortLabel: 'WEB',
      buttonClassName: 'button button-primary button-primary--web',
    });
  }

  actions.push({
    key: `${lead.id}-copy`,
    channel: 'copy',
    label: wasCopied ? 'CP Copiado' : 'CP Copiar',
    shortLabel: wasCopied ? 'OK' : 'CP',
    buttonClassName: 'button button-secondary',
  });

  return actions;
}

function formatLeadStatus(status) {
  if (status === 'contactado') {
    return 'Contactado';
  }

  if (status === 'sin canal') {
    return 'Sin canal';
  }

  return 'Listo';
}

function getLeadStatusTone(status) {
  if (status === 'contactado') {
    return 'done';
  }

  if (status === 'sin canal') {
    return 'muted';
  }

  return 'ready';
}

function getInteractionMeta(leadInteractions, leadId) {
  const interaction = leadInteractions?.[leadId];
  if (!interaction?.last_contacted) {
    return {
      label: 'No contactado',
      channel: 'Sin canal',
    };
  }

  const lastDate = new Date(interaction.last_contacted);
  const minutes = Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / 60000));
  let label = `Hace ${minutes} min`;

  if (minutes >= 60 && minutes < 1440) {
    label = `Hace ${Math.floor(minutes / 60)} h`;
  } else if (minutes >= 1440) {
    label = `Hace ${Math.floor(minutes / 1440)} d`;
  }

  return {
    label,
    channel: formatChannelLabel(interaction.last_channel),
  };
}

function formatChannelLabel(channel) {
  if (channel === 'whatsapp') {
    return 'WhatsApp';
  }

  if (channel === 'instagram') {
    return 'Instagram';
  }

  if (channel === 'gmail') {
    return 'Gmail';
  }

  if (channel === 'manual') {
    return 'Listo';
  }

  return 'Sin canal';
}

function isLeadContacted(lead, leadStatuses) {
  return Boolean(leadStatuses[lead.id] === 'contactado' || lead.interaction?.last_contacted);
}

function getWebUrl(lead, instagramUrl = '') {
  const rawValue = String(lead?.web || '').trim();
  if (!rawValue) {
    return '';
  }

  const normalizedInstagramUrl = String(instagramUrl || '').trim();
  if (normalizedInstagramUrl && rawValue === normalizedInstagramUrl) {
    return '';
  }

  if (rawValue.includes('instagram.com')) {
    return '';
  }

  if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
    return rawValue;
  }

  return `https://${rawValue.replace(/^\/+/, '')}`;
}

async function handleWebAction(lead) {
  const url = getWebUrl(lead, lead.instagramUrl);
  if (!url) {
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

async function copyResolvedMessage(lead, message) {
  const resolvedMessage = fillWhatsAppTemplate(message, lead);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(resolvedMessage);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = resolvedMessage;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return true;
}

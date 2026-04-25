function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');

  if (!digits) {
    return '';
  }

  if (digits.startsWith('56')) {
    return digits;
  }

  return `56${digits}`;
}

function decodeNumericHtmlEntities(value) {
  return String(value || '')
    .replaceAll('&amp;#', '&#')
    .replace(/&#(\d+);/g, (_, codePoint) => {
      const parsedCodePoint = Number.parseInt(codePoint, 10);
      return Number.isNaN(parsedCodePoint) ? _ : String.fromCodePoint(parsedCodePoint);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => {
      const parsedCodePoint = Number.parseInt(codePoint, 16);
      return Number.isNaN(parsedCodePoint) ? _ : String.fromCodePoint(parsedCodePoint);
    });
}

function cleanMessageWhitespace(message) {
  return String(message || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function formatBulletList(listContent) {
  const items = String(listContent || '')
    .split(',')
    .map((item) => item.trim().replace(/[.;:]+$/g, ''))
    .filter((item) => item && !/^etc\.?$/i.test(item));

  if (items.length < 2) {
    return null;
  }

  return items.map((item) => `• ${item}`).join('\n');
}

function formatStructuredChatMessage(message) {
  const cleanMessage = cleanMessageWhitespace(message);

  if (!cleanMessage || /^asunto:/i.test(cleanMessage)) {
    return cleanMessage;
  }

  let formattedMessage = cleanMessage
    .replace(
      /\b(en un solo lugar)\s*\(([^)]+)\)/i,
      (match, intro, listContent) => {
        const bulletList = formatBulletList(listContent);
        return bulletList ? `${intro}:\n\n${bulletList}` : match;
      },
    )
    .replace(/\bdatos reales\b/gi, '*datos reales*')
    .replace(/^(Hola(?: [^\n,.!?]+)?[!,.]?)(?:\s+)/i, '$1\n\n')
    .replace(/\s+(?=Estoy implementando\b)/gi, '\n\n')
    .replace(
      /([.!?])\s+(Vi tu negocio|Vi tu barber[ií]a|Vi tu perfil|Estuve viendo tu perfil|Estoy implementando|Adem[aá]s|Tu local|Tu negocio|¿Te puedo mostrar c[oó]mo funciona\?|¿Te interesa\?|Es s[uú]per r[aá]pido)/gi,
      '$1\n\n$2',
    )
    .replace(/(\?)\s+(Es s[uú]per r[aá]pido)/gi, '$1\n$2')
    .replace(/\n{3,}/g, '\n\n');

  return formattedMessage.trim();
}

function normalizeOutboundMessage(message) {
  const normalizedMessage = decodeNumericHtmlEntities(message).normalize('NFC');
  return formatStructuredChatMessage(normalizedMessage);
}

export function getWhatsAppLink(lead, message) {
  const phone = normalizePhone(lead?.telefono);

  if (!phone) {
    return '';
  }

  const resolvedMessage = fillWhatsAppTemplate(message, lead);
  console.debug('[WhatsApp] texto antes de encode:', resolvedMessage);
  const encodedText = encodeURIComponent(resolvedMessage);
  const finalUrl = `https://wa.me/${phone}?text=${encodedText}`;
  console.debug('[WhatsApp] texto despues de encode:', encodedText);
  console.debug('[WhatsApp] URL final generada:', finalUrl);

  return finalUrl;
}

export function fillWhatsAppTemplate(message, lead) {
  const resolvedMessage = String(message || '')
    .replaceAll('[NOMBRE]', lead?.nombre || '')
    .replaceAll('[CIUDAD]', lead?.ciudad || '');

  return normalizeOutboundMessage(resolvedMessage);
}

export function getWhatsAppReadyLeads(leads, message) {
  return leads
    .map((lead) => {
      const phone = normalizePhone(lead.telefono);
      const resolvedMessage = fillWhatsAppTemplate(message, lead);
      const url = getWhatsAppLink(lead, message);

      if (!phone || !url) {
        return null;
      }

      return {
        ...lead,
        phone,
        message: resolvedMessage,
        url,
      };
    })
    .filter(Boolean);
}

export function openWhatsAppLead(lead, message) {
  const url = getWhatsAppLink(lead, message);

  if (!url) {
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

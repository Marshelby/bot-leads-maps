import { fillWhatsAppTemplate } from './whatsapp';

const DEFAULT_SUBJECT = 'Idea para tu negocio';

function normalizeEmail(email) {
  const value = String(email || '').trim();
  return value.includes('@') ? value : '';
}

export function getGmailLink(lead, message, subject = DEFAULT_SUBJECT) {
  const email = normalizeEmail(lead?.email);

  if (!email) {
    return '';
  }

  const resolvedMessage = fillWhatsAppTemplate(message, lead);
  const parsed = parseGmailMessage(resolvedMessage, subject);
  return `mailto:${email}?subject=${encodeURIComponent(parsed.subject)}&body=${encodeURIComponent(parsed.body)}`;
}

export function openGmailLead(lead, message, subject = DEFAULT_SUBJECT) {
  const url = getGmailLink(lead, message, subject);

  if (!url) {
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

function parseGmailMessage(message, fallbackSubject) {
  const lines = String(message || '').split('\n');
  const firstLine = lines[0]?.trim() || '';

  if (firstLine.toLowerCase().startsWith('asunto:')) {
    const subject = firstLine.replace(/^\s*asunto:\s*/i, '').trim() || fallbackSubject;
    const body = lines.slice(1).join('\n').trim();
    return { subject, body };
  }

  return {
    subject: fallbackSubject,
    body: String(message || '').trim(),
  };
}

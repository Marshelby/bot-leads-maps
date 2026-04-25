import { fillWhatsAppTemplate } from './whatsapp';

function normalizeInstagramUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
    return rawValue;
  }

  if (rawValue.startsWith('@')) {
    return `https://www.instagram.com/${rawValue.slice(1)}/`;
  }

  if (rawValue.includes('instagram.com/')) {
    return `https://${rawValue.replace(/^https?:\/\//, '')}`;
  }

  return `https://www.instagram.com/${rawValue.replace(/^\/+|\/+$/g, '')}/`;
}

export function getInstagramUrl(lead) {
  return normalizeInstagramUrl(lead?.instagram || lead?.web);
}

export async function copyInstagramMessage(lead, message) {
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

export function openInstagramProfile(lead) {
  const url = getInstagramUrl(lead);

  if (!url) {
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

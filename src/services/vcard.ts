import { BioSite } from '../types';

export function generateVCard(bioSite: BioSite): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${bioSite.name || bioSite.commercialName}`,
    `ORG:${bioSite.commercialName || bioSite.name}`,
    `TITLE:${bioSite.profession || bioSite.category || 'Contato'}`,
    `NOTE:${bioSite.bio ? bioSite.bio.replace(/\n/g, ' ') : ''}`,
  ];

  if (bioSite.phone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${bioSite.phone}`);
  }
  if (bioSite.whatsapp && bioSite.whatsapp !== bioSite.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:+${bioSite.whatsapp.replace(/\D/g, '')}`);
  }
  if (bioSite.email) {
    lines.push(`EMAIL;TYPE=PREF,INTERNET:${bioSite.email}`);
  }
  if (bioSite.location?.enabled) {
    const loc = bioSite.location;
    const addr = `${loc.street}, ${loc.number}${loc.complement ? ' - ' + loc.complement : ''}, ${loc.neighborhood}, ${loc.city} - ${loc.state}, ${loc.zipCode}`;
    lines.push(`ADR;TYPE=WORK:;;${addr};${loc.city};${loc.state};${loc.zipCode};Brasil`);
  }

  // Add website
  lines.push(`URL:${window.location.origin}/b/${bioSite.slug}`);
  lines.push('END:VCARD');

  return lines.join('\r\n');
}

export function downloadVCard(bioSite: BioSite): void {
  const vcard = generateVCard(bioSite);
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${bioSite.slug || 'contato'}.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

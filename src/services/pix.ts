/**
 * Generates an authentic EMV compliant Pix QR Code payload string (Pix Copia e Cola)
 * with polynomial CRC16-CCITT calculation.
 */

function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(params: {
  pixKey: string;
  receiverName: string;
  city: string;
  amount?: number;
  txId?: string;
  description?: string;
}): string {
  const cleanKey = params.pixKey.trim();
  const cleanName = (params.receiverName || 'RECEBEDOR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .substring(0, 25)
    .toUpperCase();
  const cleanCity = (params.city || 'BRASIL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .substring(0, 15)
    .toUpperCase();
  const txid = (params.txId || 'NABIO').substring(0, 25);

  // 26 Merchant Account Information
  let merchantAccount = formatField('00', 'br.gov.bcb.pix');
  merchantAccount += formatField('01', cleanKey);
  if (params.description) {
    const desc = params.description.substring(0, 40);
    merchantAccount += formatField('02', desc);
  }

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += formatField('01', '12'); // Point of Initiation Method (12 = dynamic/reusable)
  payload += formatField('26', merchantAccount);
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986'); // Transaction Currency (986 = BRL)

  if (params.amount && params.amount > 0) {
    payload += formatField('54', params.amount.toFixed(2));
  }

  payload += formatField('58', 'BR'); // Country Code
  payload += formatField('59', cleanName);
  payload += formatField('60', cleanCity);

  // 62 Additional Data Field Template
  const additionalData = formatField('05', txid);
  payload += formatField('62', additionalData);

  // 63 CRC16 placeholder
  payload += '6304';
  const crc = calculateCRC16(payload);

  return payload + crc;
}

export function generateWifiPayload(params: {
  ssid: string;
  password?: string;
  securityType?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}): string {
  const type = params.securityType || 'WPA';
  const pass = params.password || '';
  const hidden = params.hidden ? 'H:true;' : '';
  return `WIFI:S:${params.ssid};T:${type};P:${pass};${hidden};`;
}

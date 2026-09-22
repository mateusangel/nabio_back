import 'dotenv/config';
import express from 'express';
import { createHash, randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { generatePixPayload, generateWifiPayload } from './services/pix';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.PORT || 3333);
const supabaseUrl = process.env.SUPABASE_URL || process.env.PROJECT;
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === frontendOrigin) return true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return ['localhost', '127.0.0.1'].includes(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  const origin = request.header('origin');
  if (isAllowedOrigin(origin)) response.header('Access-Control-Allow-Origin', origin || frontendOrigin);
  response.header('Vary', 'Origin');
  response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  next();
});

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'nabio-backend', timestamp: new Date().toISOString() });
});

app.get('/api/client-accounts', requireActiveUser, async (_request, response) => {
  try {
    const accounts = await prisma.clientAccount.findMany({
      include: { _count: { select: { bioSites: true } } },
      orderBy: { createdAt: 'desc' },
    });
    response.json(accounts.map(account => ({
      id: account.id,
      name: account.name,
      email: account.email,
      role: 'client',
      status: account.status === 'active' ? 'active' : 'suspended',
      createdAt: account.createdAt.toISOString(),
      bioSiteCount: account._count.bioSites,
    })));
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível carregar as contas dos clientes.', detail: String(error) });
  }
});

app.delete('/api/account', requireActiveUser, async (request: AuthenticatedRequest, response) => {
  if (!serviceRoleKey || !supabaseUrl || !request.userId) {
    response.status(503).json({ error: 'Exclusão de conta não está configurada no servidor.' });
    return;
  }
  try {
    const sites = await prisma.bioSite.findMany({ where: { ownerId: request.userId }, select: { id: true } });
    const media = sites.length
      ? await prisma.bioSiteMedia.findMany({ where: { bioSiteId: { in: sites.map(site => site.id) } }, select: { storageKey: true, type: true } })
      : [];
    await removeBioSiteStorage(media, sites.map(site => site.id));
    await prisma.bioSite.deleteMany({ where: { ownerId: request.userId } });
    const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${request.userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });
    if (!deleteResponse.ok) throw new Error(`Supabase Auth respondeu ${deleteResponse.status}.`);
    response.status(204).send();
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível excluir a conta e seus dados.', detail: String(error) });
  }
});

type BioSitePayload = Record<string, unknown>;

type AuthenticatedRequest = express.Request & { userId?: string; userMetadata?: Record<string, unknown>; clientAccountId?: string };

async function getAuthenticatedUser(request: express.Request): Promise<{ id: string; metadata: Record<string, unknown> } | null> {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl) return null;
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: process.env.PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '' },
  });
  if (!authResponse.ok) return null;
  const user = await authResponse.json() as { id?: string; user_metadata?: Record<string, unknown> };
  return user.id ? { id: user.id, metadata: user.user_metadata || {} } : null;
}

async function requireActiveUser(request: AuthenticatedRequest, response: express.Response, next: express.NextFunction) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) { response.status(401).json({ error: 'Autenticação obrigatória.' }); return; }
    if (user.metadata.accountStatus === 'suspended') { response.status(403).json({ error: 'Esta conta está suspensa.' }); return; }
    request.userId = user.id;
    request.userMetadata = user.metadata;
    next();
  } catch (error) {
    response.status(503).json({ error: 'Não foi possível validar a sessão.', detail: String(error) });
  }
}

function hashClientPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyClientPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function hashClientSession(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createClientSession(accountId: string): Promise<string> {
  const token = `client_${randomBytes(32).toString('hex')}`;
  await prisma.clientSession.create({
    data: {
      tokenHash: hashClientSession(token),
      accountId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
    },
  });
  return token;
}

async function getClientAccount(request: express.Request) {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer client_')) return null;
  const session = await prisma.clientSession.findUnique({
    where: { tokenHash: hashClientSession(authorization.slice('Bearer '.length)) },
    include: { account: true },
  });
  if (!session || session.expiresAt <= new Date() || session.account.status !== 'active') return null;
  return session.account;
}

async function requireClientOrOwner(request: AuthenticatedRequest, response: express.Response, next: express.NextFunction) {
  try {
    if (request.header('authorization')?.startsWith('Bearer client_')) {
      const account = await getClientAccount(request);
      if (!account) { response.status(401).json({ error: 'Sessão do cliente expirada.' }); return; }
      request.clientAccountId = account.id;
      next();
      return;
    }
    await requireActiveUser(request, response, next);
  } catch (error) {
    response.status(503).json({ error: 'Não foi possível validar a sessão.', detail: String(error) });
  }
}

async function findEditableBioSite(request: AuthenticatedRequest, siteId: string) {
  const site = await prisma.bioSite.findFirst({
    where: request.clientAccountId
      ? { id: siteId, clientAccountId: request.clientAccountId }
      : { id: siteId, OR: [{ ownerId: request.userId }, { ownerId: null }] },
  });
  if (site && !request.clientAccountId && !site.ownerId && request.userId) {
    return prisma.bioSite.update({ where: { id: site.id }, data: { ownerId: request.userId } });
  }
  return site;
}

function serializeBioSite(record: {
  id: string;
  slug: string;
  name: string;
  status: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  introVideoUrl: string | null;
  backgroundType: string;
  backgroundColor: string | null;
  backgroundGradient: string | null;
  backgroundImageUrl: string | null;
  backgroundVideoUrl: string | null;
  theme: unknown;
  content: unknown;
  clientAccessEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const content = record.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
  return {
    ...content,
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    avatarUrl: record.avatarUrl ?? content.avatarUrl,
    logoUrl: record.logoUrl ?? content.logoUrl,
    coverImageUrl: record.coverImageUrl ?? content.coverImageUrl,
    introVideoUrl: record.introVideoUrl ?? content.introVideoUrl,
    theme: record.theme ?? content.theme,
    clientAccessEmail: record.clientAccessEmail ?? content.clientAccessEmail,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function toRecordData(payload: BioSitePayload) {
  const theme = payload.theme && typeof payload.theme === 'object' ? payload.theme as BioSitePayload : {};
  const content = { ...payload };
  delete content.clientAccessPassword;
  return {
    slug: String(payload.slug || '').trim(),
    name: String(payload.name || '').trim(),
    status: String(payload.status || 'draft'),
    avatarUrl: typeof payload.avatarUrl === 'string' ? payload.avatarUrl : null,
    logoUrl: typeof payload.logoUrl === 'string' ? payload.logoUrl : null,
    coverImageUrl: typeof payload.coverImageUrl === 'string' ? payload.coverImageUrl : null,
    introVideoUrl: typeof payload.introVideoUrl === 'string' ? payload.introVideoUrl : null,
    backgroundType: String(theme.backgroundType || 'solid'),
    backgroundColor: typeof theme.backgroundColor === 'string' ? theme.backgroundColor : null,
    backgroundGradient: typeof theme.backgroundGradient === 'string' ? theme.backgroundGradient : null,
    backgroundImageUrl: typeof theme.backgroundImageUrl === 'string' ? theme.backgroundImageUrl : null,
    backgroundVideoUrl: typeof theme.backgroundVideoUrl === 'string' ? theme.backgroundVideoUrl : null,
    theme: payload.theme as object | undefined,
    content: content as Prisma.InputJsonValue,
    clientAccessEmail: typeof payload.clientAccessEmail === 'string' ? payload.clientAccessEmail.trim().toLowerCase() : null,
    clientAccessPasswordHash: typeof payload.clientAccessPassword === 'string' && payload.clientAccessPassword ? hashClientPassword(payload.clientAccessPassword) : undefined,
  };
}

function extractStorageKeyFromUrl(url: string | null | undefined, supabaseUrl: string): { bucket: string; key: string } | null {
  if (!url) return null;
  try {
    // Supabase public URL pattern: {supabaseUrl}/storage/v1/object/public/{bucket}/{key}
    const base = `${supabaseUrl}/storage/v1/object/public/`;
    if (!url.startsWith(base)) return null;
    const rest = url.slice(base.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx < 0) return null;
    const bucket = rest.slice(0, slashIdx);
    const key = decodeURIComponent(rest.slice(slashIdx + 1));
    return { bucket, key };
  } catch {
    return null;
  }
}

/** List all file paths in a Supabase Storage bucket under a given prefix (recursive). */
async function listStorageFiles(supabaseUrl: string, serviceRoleKey: string, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit, offset, search: '' }),
    });
    if (!res.ok) break;
    const items = await res.json() as Array<{ name: string; id: string | null }>;
    if (!Array.isArray(items) || items.length === 0) break;
    for (const item of items) {
      if (item.id) {
        // item.id means it's a file
        paths.push(prefix ? `${prefix}/${item.name}` : item.name);
      } else {
        // item.id is null/missing → it's a folder; recurse into it
        const subPaths = await listStorageFiles(supabaseUrl, serviceRoleKey, bucket, prefix ? `${prefix}/${item.name}` : item.name);
        paths.push(...subPaths);
      }
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return paths;
}

/** Delete exact file paths from a Supabase Storage bucket in batches. */
async function deleteStorageFiles(supabaseUrl: string, serviceRoleKey: string, bucket: string, filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) return;
  const unique = [...new Set(filePaths)];
  // Supabase accepts up to 1000 paths per request; /remove takes exact file paths
  for (let i = 0; i < unique.length; i += 1000) {
    const batch = unique.slice(i, i + 1000);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/remove`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Falha ao excluir arquivos do bucket ${bucket}: ${res.status} ${text}`);
    }
  }
}

async function removeBioSiteStorage(
  media: Array<{ storageKey: string | null; type: string }>,
  bioSiteIds: string[] = [],
  directUrls: Array<string | null | undefined> = [],
  ownerUserId?: string | null,
) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Storage do Supabase não está configurado no backend.');

  // Collect exact file paths per bucket
  const grouped = new Map<string, string[]>();

  const addPath = (bucket: string, path: string) => {
    grouped.set(bucket, [...(grouped.get(bucket) || []), path]);
  };

  // 1. Explicit storageKey entries from BioSiteMedia table
  for (const item of media) {
    if (!item.storageKey) continue;
    const bucket = item.type === 'VIDEO' ? 'Video' : 'Foto';
    addPath(bucket, item.storageKey);
  }

  // 2. Direct URL files (avatarUrl, logoUrl, coverImageUrl, introVideoUrl, backgroundImageUrl, backgroundVideoUrl)
  for (const url of directUrls) {
    const parsed = extractStorageKeyFromUrl(url, supabaseUrl);
    if (!parsed) continue;
    addPath(parsed.bucket, parsed.key);
  }

  // 3. Folder-level cleanup: list all files under the owner's folder for each siteId
  //    Upload path format: {safeSegment(userId)}/{safeSegment('biosites/{siteId}/subfolder')}/{uuid-file}
  //    safeSegment replaces non-alphanumeric with '-', so the prefix becomes:
  //    {userId-safe}/biosites-{siteId}-{subfolder}/...
  //    We list the entire owner folder and filter by siteId substring, OR list known subfolders.
  for (const siteId of bioSiteIds) {
    for (const bucket of ['Foto', 'Video'] as const) {
      // Strategy A: if we know the ownerId, list under their root folder and filter by siteId
      if (ownerUserId) {
        const safeUserId = ownerUserId.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 80);
        const rootFiles = await listStorageFiles(supabaseUrl, serviceRoleKey, bucket, safeUserId).catch(() => []);
        const safeSiteId = siteId.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
        for (const path of rootFiles) {
          if (path.includes(safeSiteId)) addPath(bucket, path);
        }
      } else {
        // Strategy B: no ownerId known — try common subfolder patterns used by the frontend
        const safeSiteId = siteId.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
        for (const sub of ['perfil', 'aparencia', 'servicos', 'produtos', 'catalogo']) {
          const prefix = `biosites-${safeSiteId}-${sub}`;
          // We don't know the userId segment, so list the bucket root first
          const rootItems = await listStorageFiles(supabaseUrl, serviceRoleKey, bucket, '').catch(() => []);
          for (const path of rootItems) {
            if (path.includes(safeSiteId)) addPath(bucket, path);
          }
          break; // avoid duplicate scans — one scan of root is enough
        }
      }
    }
  }

  if (grouped.size === 0) return;

  await Promise.all([...grouped.entries()].map(async ([bucket, paths]) => {
    await deleteStorageFiles(supabaseUrl, serviceRoleKey, bucket, paths).catch(err => {
      console.error(`Não foi possível limpar o bucket ${bucket}:`, err);
    });
  }));
}

// Upsert a ClientAccount for a bio site when credentials are set by the admin.
async function upsertClientAccountForBioSite(bioSiteId: string, email: string, passwordHash: string, siteName: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    let account = await prisma.clientAccount.findUnique({ where: { email: normalizedEmail } });
    if (!account) {
      account = await prisma.clientAccount.create({
        data: { name: siteName, email: normalizedEmail, passwordHash },
      });
    } else {
      // Update password hash in case it changed
      await prisma.clientAccount.update({
        where: { id: account.id },
        data: { passwordHash },
      });
    }
    // Link this bio site to the account if not already linked
    await prisma.bioSite.update({
      where: { id: bioSiteId },
      data: { clientAccountId: account.id },
    });
  } catch (error) {
    console.error('upsertClientAccountForBioSite failed (non-critical):', error);
  }
}

async function authenticateClientAccount(email: string, password: string, clientKey?: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // Load all bio sites to find matching credentials
  const records = await prisma.bioSite.findMany();

  // If a clientKey was provided, find the bio site that owns that key
  const keyRecord = clientKey
    ? records.find(item => {
        const content = item.content && typeof item.content === 'object' ? item.content as BioSitePayload : {};
        return content.editKey === clientKey || content.clientEditKey === clientKey;
      })
    : undefined;

  // Find the bio site whose clientAccessEmail matches — prefer keyRecord
  const legacyRecord = keyRecord || records.find(item => {
    const storedEmail = item.clientAccessEmail || '';
    return storedEmail.toLowerCase() === normalizedEmail;
  });

  // Look up existing ClientAccount
  let account = await prisma.clientAccount.findUnique({ where: { email: normalizedEmail } });

  if (!account) {
    // Try legacy / direct credential stored on the BioSite record
    if (!legacyRecord) return null;

    const legacyEmail = (legacyRecord.clientAccessEmail || '').toLowerCase();
    if (legacyEmail !== normalizedEmail) return null;

    const legacyContent = legacyRecord.content && typeof legacyRecord.content === 'object' ? legacyRecord.content as BioSitePayload : {};

    const passwordValid =
      legacyRecord.clientAccessPasswordHash
        ? verifyClientPassword(password, legacyRecord.clientAccessPasswordHash)
        : (typeof legacyContent.clientAccessPassword === 'string' && legacyContent.clientAccessPassword === password);

    if (!passwordValid) return null;

    // Promote legacy record to a ClientAccount
    const passwordHash = legacyRecord.clientAccessPasswordHash || hashClientPassword(password);
    account = await prisma.clientAccount.create({
      data: { name: legacyRecord.name, email: normalizedEmail, passwordHash },
    });

    // Link all bio sites with this email to the new account
    for (const record of records) {
      const recordEmail = (record.clientAccessEmail || '').toLowerCase();
      if (recordEmail === normalizedEmail && !record.clientAccountId) {
        await prisma.bioSite.update({ where: { id: record.id }, data: { clientAccountId: account.id } });
      }
    }
  } else {
    // Verify password against the ClientAccount
    if (!verifyClientPassword(password, account.passwordHash)) return null;

    // Sync any unlinked bio sites with this email to the account
    for (const record of records) {
      const recordEmail = (record.clientAccessEmail || '').toLowerCase();
      if (recordEmail === normalizedEmail && record.clientAccountId !== account.id) {
        await prisma.bioSite.update({ where: { id: record.id }, data: { clientAccountId: account.id } });
      }
    }
  }

  // If a specific key was provided, verify it belongs to this account's email
  if (keyRecord && keyRecord.clientAccountId !== account.id) {
    const keyEmail = (keyRecord.clientAccessEmail || '').toLowerCase();
    if (keyEmail !== normalizedEmail) return null;
    await prisma.bioSite.update({ where: { id: keyRecord.id }, data: { clientAccountId: account.id } });
  }

  // Find the best bio site to return
  const linkedSites = await prisma.bioSite.findMany({
    where: { clientAccountId: account.id, status: { notIn: ['disabled', 'archived'] } },
    orderBy: { updatedAt: 'desc' },
  });

  const selectedSite = keyRecord
    ? (linkedSites.find(s => s.id === keyRecord.id) || linkedSites[0])
    : linkedSites[0];

  if (!selectedSite) return null;

  return { account, site: selectedSite, sessionToken: await createClientSession(account.id) };
}

app.get('/api/bio-sites', requireActiveUser, async (request: AuthenticatedRequest, response) => {
  const page = Math.max(Number(request.query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 5, 1), 50);
  const search = String(request.query.search || '').trim();
  const ownerFilter = { ownerId: request.userId };
  const where = search
    ? {
        AND: [ownerFilter],
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : ownerFilter;

  try {
    const [records, total, summaryRecords] = await Promise.all([
      prisma.bioSite.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.bioSite.count({ where }),
      prisma.bioSite.findMany({ where, select: { status: true, content: true } }),
    ]);
    const summary = summaryRecords.reduce((result, site) => {
      const content = site.content && typeof site.content === 'object' ? site.content as BioSitePayload : {};
      const events = Array.isArray(content.analyticsEvents) ? content.analyticsEvents as Array<{ type?: string }> : [];
      return {
        publishedSites: result.publishedSites + (site.status === 'published' ? 1 : 0),
        totalProducts: result.totalProducts + (Array.isArray(content.products) ? content.products.length : 0),
        totalServices: result.totalServices + (Array.isArray(content.services) ? content.services.length : 0),
        totalLinks: result.totalLinks + (Array.isArray(content.links) ? content.links.length : 0),
        totalViews: result.totalViews + events.filter(event => event.type === 'view' || event.type === 'page_view').length,
        totalWhatsapp: result.totalWhatsapp + events.filter(event => event.type === 'whatsapp_click').length,
      };
    }, { publishedSites: 0, totalProducts: 0, totalServices: 0, totalLinks: 0, totalViews: 0, totalWhatsapp: 0 });
    response.json({ data: records.map(serializeBioSite), total, page, pageSize, summary });
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível carregar os Bio Sites.', detail: String(error) });
  }
});

app.get('/api/bio-sites/slug/:slug', async (request, response) => {
  try {
    const record = await prisma.bioSite.findUnique({ where: { slug: request.params.slug } });
    if (!record) {
      response.status(404).json({ error: 'Bio Site não encontrado.' });
      return;
    }
    if (record.status === 'disabled' || record.status === 'archived') {
      response.status(404).json({ error: 'Este Bio Site está desativado.' });
      return;
    }
    response.json(serializeBioSite(record));
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível carregar o Bio Site.', detail: String(error) });
  }
});

app.get('/api/bio-sites/:id', requireActiveUser, async (request: AuthenticatedRequest, response) => {
  try {
    const record = await prisma.bioSite.findFirst({ where: { id: request.params.id, ownerId: request.userId } });
    if (!record) {
      response.status(404).json({ error: 'Bio Site não encontrado.' });
      return;
    }
    response.json(serializeBioSite(record));
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível carregar o Bio Site.', detail: String(error) });
  }
});

app.post('/api/bio-sites', requireActiveUser, async (request: AuthenticatedRequest, response) => {
  const payload = request.body as BioSitePayload;
  const id = typeof payload.id === 'string' && payload.id ? payload.id : randomUUID();
  const data = await toRecordData(payload);
  if (!data.slug || !data.name) {
    response.status(400).json({ error: 'name e slug são obrigatórios.' });
    return;
  }

  try {
    const record = await prisma.bioSite.create({ data: { id, ownerId: request.userId, ...data } });

    // Proactively create/link a ClientAccount when credentials are provided
    if (data.clientAccessEmail && data.clientAccessPasswordHash) {
      await upsertClientAccountForBioSite(record.id, data.clientAccessEmail, data.clientAccessPasswordHash, data.name);
    }

    response.status(201).json(serializeBioSite(record));
  } catch (error) {
    response.status(409).json({ error: 'Não foi possível criar o Bio Site.', detail: String(error) });
  }
});

app.put('/api/bio-sites/:id', requireClientOrOwner, async (request: AuthenticatedRequest, response) => {
  const payload = request.body as BioSitePayload;
  const data = await toRecordData(payload);
  if (!data.slug || !data.name) {
    response.status(400).json({ error: 'name e slug são obrigatórios.' });
    return;
  }

  try {
    const existing = await findEditableBioSite(request, request.params.id);
    if (!existing) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const record = await prisma.bioSite.update({ where: { id: existing.id }, data });

    // Proactively create/link a ClientAccount when credentials are provided or updated
    const emailToUse = data.clientAccessEmail || existing.clientAccessEmail;
    const hashToUse = data.clientAccessPasswordHash || existing.clientAccessPasswordHash;
    if (emailToUse && hashToUse) {
      await upsertClientAccountForBioSite(record.id, emailToUse, hashToUse, data.name || existing.name);
    }

    response.json(serializeBioSite(record));
  } catch (error) {
    response.status(404).json({ error: 'Não foi possível atualizar o Bio Site.', detail: String(error) });
  }
});

app.delete('/api/bio-sites/:id', requireActiveUser, async (request: AuthenticatedRequest, response) => {
  try {
    const site = await findEditableBioSite(request, request.params.id);
    if (!site) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }

    // Collect all media table entries
    const media = await prisma.bioSiteMedia.findMany({ where: { bioSiteId: site.id }, select: { storageKey: true, type: true } });

    // Collect direct URL fields stored on the bio site record itself
    const directUrls: Array<string | null | undefined> = [
      site.avatarUrl,
      site.logoUrl,
      site.coverImageUrl,
      site.introVideoUrl,
      site.backgroundImageUrl,
      site.backgroundVideoUrl,
    ];

    // Delete DB record first (cascades bookings, leads, access keys, media rows)
    await prisma.bioSite.delete({ where: { id: site.id } });

    // Best-effort storage cleanup (never fails the request)
    try {
      await removeBioSiteStorage(media, [site.id], directUrls, site.ownerId);
    } catch (storageError) {
      console.error(`Bio Site ${site.id} excluído do DB, mas a limpeza do Storage falhou:`, storageError);
    }

    response.status(204).send();
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível excluir o Bio Site.', detail: String(error) });
  }
});

app.get('/api/analytics/events', async (request, response) => {
  const bioSiteId = String(request.query.bioSiteId || '');
  if (!bioSiteId) {
    response.status(400).json({ error: 'bioSiteId é obrigatório.' });
    return;
  }

  try {
    const record = await prisma.bioSite.findUnique({ where: { id: bioSiteId } });
    const content = record?.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    response.json(Array.isArray(content.analyticsEvents) ? content.analyticsEvents : []);
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível carregar os eventos.', detail: String(error) });
  }
});

app.post('/api/analytics/events', async (request, response) => {
  const { bioSiteId, type, targetId, targetLabel, device, referrer } = request.body || {};
  if (typeof bioSiteId !== 'string' || typeof type !== 'string' || typeof device !== 'string') {
    response.status(400).json({ error: 'bioSiteId, type e device são obrigatórios.' });
    return;
  }

  try {
    const record = await prisma.bioSite.findUnique({ where: { id: bioSiteId } });
    if (!record) {
      response.status(404).json({ error: 'Bio Site não encontrado.' });
      return;
    }

    const content = record.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    const currentEvents = Array.isArray(content.analyticsEvents) ? content.analyticsEvents : [];
    const event = {
      id: randomUUID(),
      bioSiteId,
      type,
      targetId,
      targetLabel,
      device,
      referrer,
      timestamp: new Date().toISOString(),
    };
    const nextEvents = [...currentEvents, event].slice(-5000);
    await prisma.bioSite.update({
      where: { id: bioSiteId },
      data: { content: { ...content, analyticsEvents: nextEvents } as Prisma.InputJsonValue },
    });
    response.status(201).json(event);
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível registrar o evento.', detail: String(error) });
  }
});

app.post('/api/pix/payload', (request, response) => {
  const { pixKey, receiverName, city, amount, txId, description } = request.body || {};
  if (typeof pixKey !== 'string' || !pixKey.trim()) {
    response.status(400).json({ error: 'pixKey é obrigatório' });
    return;
  }

  response.json({ payload: generatePixPayload({ pixKey, receiverName, city, amount, txId, description }) });
});

app.post('/api/wifi/payload', (request, response) => {
  const { ssid, password, securityType, hidden } = request.body || {};
  if (typeof ssid !== 'string' || !ssid.trim()) {
    response.status(400).json({ error: 'ssid é obrigatório' });
    return;
  }

  response.json({ payload: generateWifiPayload({ ssid, password, securityType, hidden }) });
});

app.listen(port, () => {
  console.log(`NaBio backend running on http://localhost:${port}`);
});

app.get('/api/bio-sites/client/:key', async (request, response) => {
  response.status(401).json({ error: 'Autenticação de cliente obrigatória.' });
});

app.post('/api/client-authenticate', async (request, response) => {
  const { email, password } = request.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    response.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }
  try {
    const result = await authenticateClientAccount(email, password);
    if (!result) {
      response.status(401).json({ error: 'E-mail ou senha do cliente inválidos.' });
      return;
    }
    const content = result.site.content && typeof result.site.content === 'object' ? result.site.content as BioSitePayload : {};
    response.json({ site: serializeBioSite(result.site), clientKey: content.clientEditKey || content.editKey, sessionToken: result.sessionToken, clientAccount: { id: result.account.id, name: result.account.name, email: result.account.email } });
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível autenticar o cliente.', detail: String(error) });
  }
});

app.post('/api/bio-sites/:id/media', requireClientOrOwner, async (request: AuthenticatedRequest, response) => {
  const { type, usage, url, storageKey, mimeType, fileSize, width, height, durationSeconds, sortOrder } = request.body || {};
  if (!['PHOTO', 'VIDEO'].includes(type) || typeof url !== 'string' || !url.trim()) {
    response.status(400).json({ error: 'type e url são obrigatórios.' });
    return;
  }

  try {
    const site = await findEditableBioSite(request, request.params.id);
    if (!site) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const mediaCount = await prisma.bioSiteMedia.count({ where: { bioSiteId: request.params.id } });
    if (mediaCount >= 10) {
      response.status(409).json({ error: 'Limite de 10 mídias atingido. Remova uma foto ou vídeo antes de enviar outro.' });
      return;
    }
    const media = await prisma.bioSiteMedia.create({
      data: {
        bioSiteId: request.params.id,
        type,
        usage: usage || 'GALLERY',
        url,
        storageKey: typeof storageKey === 'string' ? storageKey : null,
        mimeType: typeof mimeType === 'string' ? mimeType : null,
        fileSize: Number.isFinite(fileSize) ? fileSize : null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      },
    });
    response.status(201).json(media);
  } catch (error) {
    response.status(404).json({ error: 'Não foi possível registrar a mídia.', detail: String(error) });
  }
});

app.get('/api/bio-sites/:id/media', async (request, response) => {
  try {
    const media = await prisma.bioSiteMedia.findMany({ where: { bioSiteId: request.params.id }, orderBy: { sortOrder: 'asc' } });
    response.json(media);
  } catch (error) {
    response.status(404).json({ error: 'Não foi possível carregar as mídias.', detail: String(error) });
  }
});

app.get('/api/bio-sites/:id/bookings', async (request, response) => {
  try {
    const record = await prisma.bioSite.findUnique({ where: { id: request.params.id } });
    const content = record?.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    response.json(Array.isArray(content.bookings) ? content.bookings : []);
  } catch (error) { response.status(500).json({ error: 'Não foi possível carregar os agendamentos.', detail: String(error) }); }
});

app.post('/api/bio-sites/:id/bookings', async (request, response) => {
  const { serviceId, serviceName, customerName, customerEmail, customerPhone, customerWhatsapp, date, time } = request.body || {};
  if (typeof serviceName !== 'string' || typeof customerName !== 'string' || typeof customerWhatsapp !== 'string' || typeof date !== 'string' || typeof time !== 'string') {
    response.status(400).json({ error: 'serviceName, customerName, customerWhatsapp, date e time são obrigatórios.' }); return;
  }
  try {
    const record = await prisma.bioSite.findUnique({ where: { id: request.params.id } });
    if (!record) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const content = record.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    const bookings = Array.isArray(content.bookings) ? content.bookings as Array<Record<string, unknown>> : [];
    const conflict = bookings.some(booking => booking.date === date && booking.time === time && ['pending', 'confirmed'].includes(String(booking.status)));
    if (conflict) { response.status(409).json({ error: 'Este horário já está reservado.' }); return; }
    const booking = { id: randomUUID(), serviceId, serviceName, customerName, customerEmail, customerPhone, customerWhatsapp, date, time, status: 'pending', createdAt: new Date().toISOString() };
    await prisma.bioSite.update({ where: { id: request.params.id }, data: { content: { ...content, bookings: [...bookings, booking] } as Prisma.InputJsonValue } });
    response.status(201).json(booking);
  } catch (error) { response.status(404).json({ error: 'Não foi possível criar o agendamento.', detail: String(error) }); }
});

app.patch('/api/bio-sites/:id/bookings/:bookingId', async (request, response) => {
  try {
    const record = await prisma.bioSite.findUnique({ where: { id: request.params.id } });
    if (!record) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const content = record.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    const bookings = Array.isArray(content.bookings) ? content.bookings as Array<Record<string, unknown>> : [];
    const status = String(request.body?.status || '');
    if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) { response.status(400).json({ error: 'Status inválido.' }); return; }
    const updatedBookings = bookings.map(booking => booking.id === request.params.bookingId ? { ...booking, status } : booking);
    const updated = updatedBookings.find(booking => booking.id === request.params.bookingId);
    await prisma.bioSite.update({ where: { id: request.params.id }, data: { content: { ...content, bookings: updatedBookings } as Prisma.InputJsonValue } });
    if (status === 'completed' && updated) {
      const whatsapp = String(updated.customerWhatsapp || updated.customerPhone || '').replace(/\D/g, '');
      const leads = Array.isArray(content.leads) ? content.leads as Array<Record<string, unknown>> : [];
      const existing = leads.find(lead => String(lead.whatsapp || '').replace(/\D/g, '') === whatsapp);
      const now = new Date().toISOString();
      const lead = existing ? { ...existing, name: updated.customerName, lastService: updated.serviceName, updatedAt: now } : { id: randomUUID(), name: updated.customerName, whatsapp, lastService: updated.serviceName, lastBookingAt: updated.createdAt, createdAt: now, updatedAt: now };
      await prisma.bioSite.update({ where: { id: request.params.id }, data: { content: { ...content, bookings: updatedBookings, leads: existing ? leads.map(item => item.id === existing.id ? lead : item) : [...leads, lead] } as Prisma.InputJsonValue } });
    }
    response.json(updated);
  }
  catch (error) { response.status(404).json({ error: 'Não foi possível atualizar o agendamento.', detail: String(error) }); }
});

app.post('/api/bio-sites/:id/leads', async (request, response) => {
  const { name, whatsapp, lastService } = request.body || {};
  if (typeof name !== 'string' || typeof whatsapp !== 'string') { response.status(400).json({ error: 'name e whatsapp são obrigatórios.' }); return; }
  try {
    const record = await prisma.bioSite.findUnique({ where: { id: request.params.id } });
    if (!record) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const content = record.content && typeof record.content === 'object' ? record.content as BioSitePayload : {};
    const leads = Array.isArray(content.leads) ? content.leads as Array<Record<string, unknown>> : [];
    const normalized = whatsapp.replace(/\D/g, '');
    const existing = leads.find(lead => String(lead.whatsapp || '').replace(/\D/g, '') === normalized);
    const now = new Date().toISOString();
    const lead = existing ? { ...existing, name, lastService, updatedAt: now } : { id: randomUUID(), name, whatsapp: normalized, lastService, createdAt: now, updatedAt: now };
    const nextLeads = existing ? leads.map(item => item.id === existing.id ? lead : item) : [...leads, lead];
    await prisma.bioSite.update({ where: { id: request.params.id }, data: { content: { ...content, leads: nextLeads } as Prisma.InputJsonValue } });
    response.status(201).json(lead);
  }
  catch (error) { response.status(404).json({ error: 'Não foi possível salvar o contato.', detail: String(error) }); }
});

app.delete('/api/bio-sites/:id/media', requireClientOrOwner, async (request: AuthenticatedRequest, response) => {
  const url = String(request.query.url || '');
  if (!url) { response.status(400).json({ error: 'url é obrigatório.' }); return; }
  try {
    const site = await findEditableBioSite(request, request.params.id);
    if (!site) { response.status(404).json({ error: 'Bio Site não encontrado.' }); return; }
    const media = await prisma.bioSiteMedia.findFirst({ where: { bioSiteId: site.id, url } });
    if (!media) { response.status(404).json({ error: 'Mídia não encontrada.' }); return; }
    await removeBioSiteStorage([{ storageKey: media.storageKey, type: media.type }]);
    await prisma.bioSiteMedia.delete({ where: { id: media.id } });
    response.status(204).send();
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível remover a mídia.', detail: String(error) });
  }
});

app.post('/api/bio-sites/client/:key/authenticate', async (request, response) => {
  const { email, password } = request.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    response.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }
  try {
    const result = await authenticateClientAccount(email, password, request.params.key);
    if (!result) {
      response.status(401).json({ error: 'E-mail ou senha do cliente inválidos.' });
      return;
    }
    const content = result.site.content && typeof result.site.content === 'object' ? result.site.content as BioSitePayload : {};
    response.json({ site: serializeBioSite(result.site), clientKey: content.clientEditKey || content.editKey, sessionToken: result.sessionToken, clientAccount: { id: result.account.id, name: result.account.name, email: result.account.email } });
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível autenticar o cliente.', detail: String(error) });
  }
});

app.delete('/api/client-accounts/:identifier', requireActiveUser, async (request, response) => {
  const identifier = decodeURIComponent(request.params.identifier).trim();
  if (!identifier) {
    response.status(400).json({ error: 'E-mail da conta do cliente é obrigatório.' });
    return;
  }
  try {
    const account = await prisma.clientAccount.findFirst({ where: { OR: [{ id: identifier }, { email: identifier.toLowerCase() }] } });
    const email = account?.email || identifier.toLowerCase();
    const sites = await prisma.bioSite.findMany({
      where: account
        ? { OR: [{ clientAccountId: account.id }, { clientAccessEmail: email }] }
        : { clientAccessEmail: email },
      select: { id: true },
    });
    const siteIds = sites.map(site => site.id);
    const media = siteIds.length
      ? await prisma.bioSiteMedia.findMany({ where: { bioSiteId: { in: siteIds } }, select: { storageKey: true, type: true } })
      : [];
    await removeBioSiteStorage(media, siteIds);
    await prisma.$transaction(async transaction => {
      if (siteIds.length) await transaction.bioSite.deleteMany({ where: { id: { in: siteIds } } });
      if (account) await transaction.clientAccount.delete({ where: { id: account.id } });
    });
    response.status(204).send();
  } catch (error) {
    response.status(500).json({ error: 'Não foi possível excluir a conta do cliente e seus dados.', detail: String(error) });
  }
});
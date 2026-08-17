import { promises as dns } from 'dns';

/**
 * Pre-send validation for recipient addresses.
 *
 * A signing request sent to an unreachable address fails silently from the
 * sender's point of view — the workflow sits at "pending" forever while the
 * mail hard-bounces, and hard bounces damage the domain's sending reputation,
 * which then hurts delivery for every other recipient.
 *
 * Deliberately stops at the domain. Probing an individual mailbox over SMTP
 * (RCPT TO without sending) is unreliable and dangerous: catch-all domains
 * accept everything, Gmail and Microsoft 365 commonly accept then bounce later,
 * greylisting returns temporary failures for valid addresses — and mail
 * providers treat a server that repeatedly opens connections just to test
 * addresses as directory harvesting, which is a fast route to being blocklisted.
 * Protecting sender reputation is the whole point, so verification stops where
 * it stays reliable.
 */

export type EmailValidationSeverity = 'ok' | 'warning' | 'error';

export interface EmailValidationResult {
  email: string;
  severity: EmailValidationSeverity;
  /** Shown to the sender. Empty when severity is 'ok'. */
  reason: string;
  /** A corrected address to offer, when the problem looks like a typo. */
  suggestion?: string;
}

// Deliberately stricter than the permissive regex used at signup: a local part
// without spaces or angle brackets, a dotted domain, and a plausible TLD.
const STRICT_EMAIL = /^[^\s@<>",;]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// Domains that exist purely to throw away — fine to send to, but the sender
// almost certainly did not mean to route a legal document there.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'fakeinbox.com',
]);

// Reserved by RFC 2606 or otherwise incapable of receiving mail.
const UNROUTABLE_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test',
  'invalid',
  'localhost',
  'localhost.localdomain',
]);
const UNROUTABLE_TLDS = ['.test', '.invalid', '.localhost', '.example', '.local'];

// Typo targets. Only high-traffic consumer domains: suggesting a correction for
// a company domain we happen not to recognise would be worse than silence.
const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'yahoo.co.in',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'msn.com',
];

/** Levenshtein distance, capped early since we only care about 1–2 edits. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function isUnroutable(domain: string): boolean {
  if (UNROUTABLE_DOMAINS.has(domain)) return true;
  return UNROUTABLE_TLDS.some((tld) => domain === tld.slice(1) || domain.endsWith(tld));
}

// A domain's mail capability rarely changes, and a create page may validate the
// same address repeatedly, so results are cached briefly. Negative results get
// a shorter life so a freshly configured domain is not held against the sender.
const MX_CACHE_TTL_MS = 30 * 60 * 1000;
const MX_NEGATIVE_TTL_MS = 5 * 60 * 1000;
const mxCache = new Map<string, { acceptsMail: boolean; checkedAt: number }>();

/**
 * Whether a domain can receive mail at all: an MX record, or per RFC 5321 an
 * A/AAAA record, which receiving hosts still honour as an implicit MX.
 *
 * DNS failures resolve to "yes". A resolver timeout is not evidence against the
 * recipient, and blocking a legitimate signing request over one would be a far
 * worse outcome than letting a doubtful address through.
 */
async function domainAcceptsMail(domain: string): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached) {
    const ttl = cached.acceptsMail ? MX_CACHE_TTL_MS : MX_NEGATIVE_TTL_MS;
    if (Date.now() - cached.checkedAt < ttl) return cached.acceptsMail;
  }

  let acceptsMail: boolean;
  try {
    const records = await dns.resolveMx(domain);
    acceptsMail = records.length > 0;
  } catch {
    try {
      const addresses = await dns.resolve4(domain);
      acceptsMail = addresses.length > 0;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // NXDOMAIN / no records is a real answer: the domain cannot receive mail.
      // Anything else (timeout, SERVFAIL, resolver down) is our problem.
      acceptsMail = !(code === 'ENOTFOUND' || code === 'NODATA');
    }
  }

  mxCache.set(domain, { acceptsMail, checkedAt: Date.now() });
  return acceptsMail;
}

export class EmailValidationService {
  /**
   * Validate one recipient address.
   *
   * 'error' should block the send; 'warning' is worth showing but the sender
   * may know better than we do and should be able to continue.
   */
  static async validate(rawEmail: string): Promise<EmailValidationResult> {
    const email = (rawEmail || '').trim();

    if (!email) {
      return { email, severity: 'error', reason: 'Email address is required' };
    }
    if (!STRICT_EMAIL.test(email)) {
      return { email, severity: 'error', reason: 'This is not a valid email address' };
    }

    const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();

    if (isUnroutable(domain)) {
      return {
        email,
        severity: 'error',
        reason: `"${domain}" is a reserved test domain and cannot receive email`,
      };
    }

    // Check for a likely typo before DNS: "gmial.com" has no MX either, and a
    // suggestion is far more useful than "domain cannot receive email".
    if (!COMMON_DOMAINS.includes(domain)) {
      for (const candidate of COMMON_DOMAINS) {
        if (editDistance(domain, candidate) <= 2) {
          return {
            email,
            severity: 'warning',
            reason: `Did you mean ${candidate}?`,
            suggestion: `${email.slice(0, email.lastIndexOf('@'))}@${candidate}`,
          };
        }
      }
    }

    if (!(await domainAcceptsMail(domain))) {
      return {
        email,
        severity: 'error',
        reason: `"${domain}" has no mail server, so this address cannot receive the signing request`,
      };
    }

    if (DISPOSABLE_DOMAINS.has(domain)) {
      return {
        email,
        severity: 'warning',
        reason: `"${domain}" is a disposable address service — the signed document may become unrecoverable`,
      };
    }

    return { email, severity: 'ok', reason: '' };
  }

  /** Validate a batch, preserving input order. */
  static async validateMany(emails: string[]): Promise<EmailValidationResult[]> {
    return Promise.all(emails.map((email) => EmailValidationService.validate(email)));
  }
}

export default EmailValidationService;

/**
 * موتور قالب ساده و امن برای چاپ (شبیه Mustache/Handlebars، بدون اجرای کد).
 * ─────────────────────────────────────────────────────────────────────────
 *   {{ meeting.title }}          مقدار متنی (HTML آن escape می‌شود)
 *   {{{ resolution.text }}}      HTML (پس از پاک‌سازی امنیتی درج می‌شود؛ برای متن‌های ویرایشگر)
 *   {{#each items}} … {{else}} … {{/each}}   تکرار؛ داخل حلقه: {{this}} ، {{@index}} ، {{@number}} ، {{@first}} ، {{@last}}
 *   {{#if cond}} … {{else}} … {{/if}}        شرط (آرایه‌ی خالی، رشته‌ی خالی، 0، null و false = نادرست)
 *   {{#unless cond}} … {{/unless}}
 *   {{! توضیح }}                 در خروجی نمی‌آید
 * نام‌ها از داخلی‌ترین حلقه به بیرون جستجو می‌شوند؛ پس داخل {{#each}} هم می‌توان {{meeting.title}} نوشت.
 */

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'var'; path: string; raw: boolean }
  | { kind: 'block'; type: 'each' | 'if' | 'unless'; path: string; body: Node[]; elseBody: Node[] };

export class TemplateError extends Error {}

export interface RenderOptions {
  /** پاک‌سازی HTML برای {{{ }}} (مثلاً DomSanitizer)؛ پیش‌فرض: escape کامل */
  sanitizeHtml?: (html: string) => string;
}

const TAG = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([^}]*?)\s*\}\}/g;
const PATH = /^(?:this|@index|@number|@first|@last|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\.\d+)*)$/;

const cache = new Map<string, Node[]>();

export function renderTemplate(template: string, data: unknown, options: RenderOptions = {}): string {
  let ast = cache.get(template);
  if (!ast) {
    ast = parse(template);
    if (cache.size > 50) cache.clear();
    cache.set(template, ast);
  }
  return renderNodes(ast, [{ value: data }], options);
}

/** بررسی درستی قالب (برای ویرایشگر)؛ پیام خطا یا null */
export function validateTemplate(template: string): string | null {
  try {
    parse(template);
    return null;
  } catch (e) {
    return e instanceof TemplateError ? e.message : 'قالب نامعتبر است.';
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════
// Parser
// ═══════════════════════════════════════════════════════════
function parse(template: string): Node[] {
  const root: Node[] = [];
  const stack: { node: Extract<Node, { kind: 'block' }>; inElse: boolean }[] = [];
  const target = () => {
    const top = stack[stack.length - 1];
    return top ? (top.inElse ? top.node.elseBody : top.node.body) : root;
  };

  let last = 0;
  for (const match of template.matchAll(TAG)) {
    const index = match.index ?? 0;
    if (index > last) target().push({ kind: 'text', value: template.slice(last, index) });
    last = index + match[0].length;

    if (match[1] !== undefined) {
      target().push({ kind: 'var', path: checkPath(match[1].trim()), raw: true });
      continue;
    }

    const tag = (match[2] ?? '').trim();
    if (!tag || tag.startsWith('!')) continue;

    if (tag.startsWith('#')) {
      const [type, ...rest] = tag.slice(1).trim().split(/\s+/);
      if (type !== 'each' && type !== 'if' && type !== 'unless')
        throw new TemplateError(`بلوک ناشناخته: {{#${type}}}`);
      const block: Extract<Node, { kind: 'block' }> = { kind: 'block', type, path: checkPath(rest.join(' ')), body: [], elseBody: [] };
      target().push(block);
      stack.push({ node: block, inElse: false });
    } else if (tag === 'else') {
      const top = stack[stack.length - 1];
      if (!top || top.inElse) throw new TemplateError('{{else}} خارج از بلوک یا تکراری است.');
      top.inElse = true;
    } else if (tag.startsWith('/')) {
      const type = tag.slice(1).trim();
      const top = stack.pop();
      if (!top) throw new TemplateError(`{{/${type}}} بدون بلوک باز.`);
      if (top.node.type !== type) throw new TemplateError(`انتظار {{/${top.node.type}}} بود ولی {{/${type}}} آمد.`);
    } else {
      target().push({ kind: 'var', path: checkPath(tag), raw: false });
    }
  }

  if (last < template.length) target().push({ kind: 'text', value: template.slice(last) });
  if (stack.length) throw new TemplateError(`بلوک {{#${stack[stack.length - 1].node.type}}} بسته نشده است.`);
  return root;
}

function checkPath(path: string): string {
  if (!PATH.test(path)) throw new TemplateError(`نام متغیر نامعتبر: «${path}»`);
  return path;
}

// ═══════════════════════════════════════════════════════════
// Renderer
// ═══════════════════════════════════════════════════════════
interface Scope {
  value: unknown;
  index?: number;
  count?: number;
}

function renderNodes(nodes: Node[], scopes: Scope[], options: RenderOptions): string {
  let out = '';
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out += node.value;
        break;
      case 'var': {
        const value = resolve(node.path, scopes);
        if (value === null || value === undefined) break;
        out += node.raw
          ? (options.sanitizeHtml ? options.sanitizeHtml(String(value)) : escapeHtml(value))
          : escapeHtml(value);
        break;
      }
      case 'block': {
        const value = resolve(node.path, scopes);
        if (node.type === 'each') {
          const list = Array.isArray(value) ? value : [];
          if (list.length === 0) {
            out += renderNodes(node.elseBody, scopes, options);
          } else {
            list.forEach((item, i) => {
              out += renderNodes(node.body, [...scopes, { value: item, index: i, count: list.length }], options);
            });
          }
        } else {
          const truthy = isTruthy(value);
          const show = node.type === 'if' ? truthy : !truthy;
          out += renderNodes(show ? node.body : node.elseBody, scopes, options);
        }
        break;
      }
    }
  }
  return out;
}

function resolve(path: string, scopes: Scope[]): unknown {
  const current = scopes[scopes.length - 1];
  switch (path) {
    case 'this': return current.value;
    case '@index': return current.index;
    case '@number': return current.index === undefined ? undefined : current.index + 1;
    case '@first': return current.index === 0;
    case '@last': return current.index !== undefined && current.index === (current.count ?? 0) - 1;
  }

  const parts = path.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scopeValue = scopes[i].value;
    if (scopeValue !== null && typeof scopeValue === 'object' && Object.hasOwn(scopeValue, parts[0])) {
      return parts.reduce<unknown>((acc, key) => readOwn(acc, key), scopeValue);
    }
  }
  return undefined;
}

/** فقط ویژگی‌های خود شیء (نه prototype)؛ به‌علاوه‌ی length آرایه */
function readOwn(target: unknown, key: string): unknown {
  if (target === null || typeof target !== 'object') return undefined;
  if (Array.isArray(target) && key === 'length') return target.length;
  return Object.hasOwn(target, key) ? (target as Record<string, unknown>)[key] : undefined;
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return !!value;
}

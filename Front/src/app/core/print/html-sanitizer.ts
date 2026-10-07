/**
 * پاک‌سازی HTML برای چاپ.
 * ─────────────────────────────────────────────────────────────────────────
 * پنجره‌ی چاپ هم‌مبدأ با برنامه است (به توکن کاربر دسترسی دارد)؛ پس هیچ اسکریپتی — نه از متن مصوبه و نه از
 * قالب سفارشی — نباید در آن اجرا شود. برخلاف DomSanitizer انگولار، ویژگی style حفظ می‌شود تا قالب‌بندی
 * ویرایشگر (رنگ، تراز، فاصله) در چاپ از بین نرود.
 */

const BLOCKED_TAGS = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base',
  'form', 'input', 'button', 'textarea', 'select', 'option', 'template', 'noscript', 'svg', 'math',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'srcset']);

const SAFE_URL = /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp);|blob:|#|\/|\.{0,2}\/)/i;
const UNSAFE_CSS = /expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:|@import/gi;

/** پاک‌سازی یک قطعه HTML (حذف اسکریپت، رویدادها، آدرس‌های خطرناک و تگ‌های فعال) */
export function sanitizeRichHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/** پاک‌سازی CSS قالب (حذف @import، expression و ... و جلوگیری از بستن تگ style) */
export function sanitizeCss(css: string): string {
  return (css || '')
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(UNSAFE_CSS, '/* removed */');
}

function cleanNode(root: Element): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);
  const toRemove: Node[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.COMMENT_NODE) {
      toRemove.push(node);
      continue;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tag) || tag === 'style') {
      toRemove.push(el);
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();

      if (name.startsWith('on') || name === 'formaction' || name === 'srcdoc') {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRS.has(name) && value && !SAFE_URL.test(value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'style' && UNSAFE_CSS.test(value)) {
        UNSAFE_CSS.lastIndex = 0;
        el.setAttribute('style', value.replace(UNSAFE_CSS, ''));
      }
      UNSAFE_CSS.lastIndex = 0;
    }

    if (tag === 'a') {
      el.setAttribute('rel', 'noopener noreferrer');
      el.setAttribute('target', '_blank');
    }
  }

  toRemove.forEach(n => n.parentNode?.removeChild(n));
}

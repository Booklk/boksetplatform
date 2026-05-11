/**
 * Help article reader — renders a single Markdown article from
 * data/helpArticles.ts. Same renderMarkdown subset used elsewhere
 * (escape + link + bold/italic + headings + lists + tables) so vendor
 * authors can write Markdown safely without us shipping a heavy
 * sanitiser library.
 */
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Clock, MessageCircle } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { findArticle, HELP_CATEGORIES } from '../data/helpArticles';

function renderMarkdown(md: string): { __html: string } {
  const escape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeUrl = (u: string): string | null => {
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^\/[^/]/.test(trimmed)) return trimmed;
    return null;
  };

  const inlineFmt = (s: string): string => {
    let r = escape(s);
    r = r.replace(/`([^`]+?)`/g, '<code>$1</code>');
    r = r.replace(/\[([^\]]+?)\]\(([^)\s]+?)\)/g, (_m, text: string, url: string) => {
      const safe = safeUrl(url);
      if (!safe) return text;
      return `<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    });
    r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    r = r.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
    return r;
  };

  const lines = md.split('\n');
  const out: string[] = [];
  let listKind: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableHeaders: string[] = [];

  const closeList = () => {
    if (listKind) {
      out.push(`</${listKind}>`);
      listKind = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push('</tbody></table>');
      inTable = false;
      tableHeaders = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      closeList();
      closeTable();
      continue;
    }
    // Headings
    const h = line.match(/^(#{1,4})\s+(.+)/);
    if (h) {
      closeList(); closeTable();
      const level = h[1].length;
      out.push(`<h${level}>${inlineFmt(h[2])}</h${level}>`);
      continue;
    }
    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!inTable) {
        const next = lines[i + 1] ?? '';
        if (next.includes('---')) {
          tableHeaders = cells;
          out.push('<table><thead><tr>');
          for (const h of cells) out.push(`<th>${inlineFmt(h)}</th>`);
          out.push('</tr></thead><tbody>');
          inTable = true;
          i++; // skip separator
          continue;
        }
      } else {
        out.push('<tr>');
        for (const c of cells) out.push(`<td>${inlineFmt(c)}</td>`);
        out.push('</tr>');
        continue;
      }
    } else if (inTable) {
      closeTable();
    }
    // Lists
    const ul = line.match(/^[\s]*[-*]\s+(.+)/);
    const ol = line.match(/^[\s]*\d+\.\s+(.+)/);
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      if (listKind !== kind) {
        closeList();
        out.push(`<${kind}>`);
        listKind = kind;
      }
      out.push(`<li>${inlineFmt((ul ?? ol)![1])}</li>`);
      continue;
    } else {
      closeList();
    }
    // Paragraph
    out.push(`<p>${inlineFmt(line)}</p>`);
  }
  closeList();
  closeTable();

  return { __html: out.join('') };
}

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? findArticle(slug) : undefined;

  if (!article) {
    return (
      <MarketingLayout>
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl font-black mb-3">المقال غير موجود</h1>
            <p className="text-slate-400 mb-6">لعلّك تبحث عن مقال آخر — ارجع لمركز المساعدة</p>
            <Link to="/help" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">
              <ArrowRight className="w-4 h-4 rotate-180" /> مركز المساعدة
            </Link>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  const category = HELP_CATEGORIES.find((c) => c.id === article.category);
  const body = renderMarkdown(article.body);

  return (
    <MarketingLayout>
      <Helmet>
        <title>{article.title} — مركز المساعدة | Jdawil</title>
        <meta name="description" content={article.body.slice(0, 160).replace(/[*#`>|]/g, '')} />
        <link rel="canonical" href={`https://jdawil.sa/help/article/${article.slug}`} />
      </Helmet>

      <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white">
        <article className="max-w-3xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="text-xs text-slate-500 mb-6 flex items-center gap-2">
            <Link to="/help" className="hover:text-white">مركز المساعدة</Link>
            <span>›</span>
            {category && <span>{category.emoji} {category.nameAr}</span>}
          </nav>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">{article.title}</h1>

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-10">
            <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {article.minutes} دقائق قراءة</span>
            <span className="opacity-50">·</span>
            <span>{category?.nameAr}</span>
          </div>

          {/* Body */}
          <div className="help-article" dangerouslySetInnerHTML={body} />

          {/* CTA — talk to support */}
          <div className="mt-12 pt-8 border-t border-white/10 rounded-xl bg-white/3 p-6 text-center">
            <p className="text-slate-300 text-sm mb-4">ما حليت مشكلتك؟ تواصل مع الدعم — تاجر سعودي يكلّمك خلال دقائق.</p>
            <a
              href="https://wa.me/966500000000?text=محتاج%20مساعدة%20في%20Jdawil"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold"
            >
              <MessageCircle className="w-4 h-4" /> تواصل واتساب
            </a>
          </div>

          {/* Back to index */}
          <div className="mt-8 text-center">
            <Link to="/help" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm">
              <ArrowRight className="w-4 h-4 rotate-180" /> كل المقالات
            </Link>
          </div>
        </article>
      </div>

      <style>{`
        .help-article h2 { font-size: 1.25rem; font-weight: 800; margin-top: 2rem; margin-bottom: 0.75rem; color: #e2e8f0; }
        .help-article h3 { font-size: 1.1rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #cbd5e1; }
        .help-article p  { line-height: 1.75; color: #cbd5e1; margin-bottom: 1rem; }
        .help-article ul, .help-article ol { padding-right: 1.5rem; margin-bottom: 1rem; color: #cbd5e1; }
        .help-article li { margin-bottom: 0.4rem; line-height: 1.7; }
        .help-article a  { color: #60a5fa; text-decoration: underline; }
        .help-article code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; direction: ltr; display: inline-block; }
        .help-article strong { color: #fff; }
        .help-article table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
        .help-article th, .help-article td { padding: 8px 12px; border: 1px solid rgba(255,255,255,0.1); text-align: right; }
        .help-article th { background: rgba(255,255,255,0.04); font-weight: 700; color: #fff; }
      `}</style>
    </MarketingLayout>
  );
}

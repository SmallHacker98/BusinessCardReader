/**
 * OCR結果からフィールドを抽出
 *
 * manga-ocr: 日本語をスペースなしで出力 → 氏名・会社名・役職が取れる
 * Tesseract:  日本語文字間にスペースを挿入 → removeJapaneseSpacesで除去
 */

// ── 日本語スペース除去（Tesseractフォールバック用・改行は保持）────────────

const removeJapaneseSpaces = (text) => {
  let result = text;
  for (let i = 0; i < 4; i++) {
    result = result.replace(
      /([\u3000-\u9fff\uff00-\uffef\u3040-\u30ff\u4e00-\u9fff])[^\S\n]+([\u3000-\u9fff\uff00-\uffef\u3040-\u30ff\u4e00-\u9fff])/g,
      '$1$2'
    );
  }
  for (let i = 0; i < 4; i++) {
    result = result
      .replace(/([\u30a0-\u30ff])[^\S\n]+ー/g, '$1ー')
      .replace(/ー[^\S\n]+([\u30a0-\u30ff])/g, 'ー$1');
  }
  return result;
};

// ── パターン定義 ─────────────────────────────────────────────────────────────

const TEL_LABELED = /(?:TEL|Tel|tel|電話|携帯|Mobile|直通)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const FAX_LABELED = /(?:FAX|Fax|fax|ファクス|ファックス)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const BARE_PHONE  = /(?<![a-zA-Z\d])(0\d{1,4}[-\s]\d{2,4}[-\s]\d{4})(?![a-zA-Z\d])/g;
const EMAIL_PAT   = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const ZIP_PAT     = /〒\s*\d{3}[-ー]\d{4}/;
const PREF_PAT    = /(?:北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)/;
const COMPANY_JP  = /(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|公益財団法人|一般財団法人|医療法人|学校法人|社会福祉法人)/;
const COMPANY_EN  = /\b(?:Inc\.?|Corp\.?|Co\.?,?\s*Ltd\.?|LLC|LLP|GmbH|S\.A\.?|PLC)\b/i;
const DEPT_PAT    = /(部|課|室|局|チーム|グループ|事業部|本部|センター|Division|Department|Dept\.?)/;
const TITLE_PAT   = /(社長|副社長|専務|常務|取締役|部長|次長|課長|係長|主任|マネージャー|ディレクター|CEO|COO|CFO|CTO|VP|President|Director|Manager)/i;
const NAME_KANJI  = /^[\u4e00-\u9fff]{1,4}\s*[\u4e00-\u9fff]{1,6}$/;
const NAME_KANA   = /^[ぁ-ん]{2,6}\s*[ぁ-ん]{1,6}$|^[ァ-ヶー]{2,8}\s*[ァ-ヶー]{1,6}$/;
const NAME_ALPHA  = /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+$/;

const cleanPhone  = (s) => s.replace(/\s/g, '').replace(/[ー－]/g, '-');
const isNoise     = (s) => /^[\s\-_=・•●○※〒]+$/.test(s) || s.length < 2;
const isContact   = (s) =>
  /@/.test(s) || /https?:\/\//i.test(s) ||
  TEL_LABELED.test(s) || FAX_LABELED.test(s) ||
  ZIP_PAT.test(s) || PREF_PAT.test(s) ||
  /^[\d\s\-\+\(\)]{8,}$/.test(s);

// ── メイン ────────────────────────────────────────────────────────────────────

export const parseFields = (ocrResult) => {
  const rawText  = typeof ocrResult === 'string' ? ocrResult : (ocrResult.text || '');
  const engine   = typeof ocrResult === 'string' ? 'unknown'  : (ocrResult.engine || 'unknown');

  // Tesseract出力は日本語スペース除去、manga-ocrはそのまま
  const text = engine === 'tesseract' ? removeJapaneseSpaces(rawText) : rawText;
  console.log('[fieldParser] engine:', engine);
  console.log('[fieldParser] cleaned text:\n', text);

  const lines   = text.split('\n').map(l => l.trim()).filter(l => !isNoise(l));
  const usedIdx = new Set();
  let name = '', companyName = '', department = '', title = '';
  let phone = '', fax = '', email = '', address = '';

  // ── 企業名
  for (let i = 0; i < lines.length; i++) {
    if (COMPANY_JP.test(lines[i]) || COMPANY_EN.test(lines[i])) {
      companyName = lines[i];
      usedIdx.add(i);
      break;
    }
  }

  // ── 役職
  for (let i = 0; i < lines.length; i++) {
    if (usedIdx.has(i)) continue;
    if (TITLE_PAT.test(lines[i]) && !DEPT_PAT.test(lines[i])) {
      title = lines[i];
      usedIdx.add(i);
      break;
    }
  }

  // ── 部署名
  const deptLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (usedIdx.has(i)) continue;
    if (DEPT_PAT.test(lines[i]) && !isContact(lines[i])) {
      deptLines.push(lines[i]);
      usedIdx.add(i);
    }
  }
  department = deptLines.join('\n');

  // ── 氏名（漢字・カナ・英字パターン）
  for (let i = 0; i < lines.length; i++) {
    if (usedIdx.has(i)) continue;
    const l = lines[i];
    if (isContact(l) || COMPANY_JP.test(l) || COMPANY_EN.test(l)) continue;
    if (NAME_KANJI.test(l) || NAME_KANA.test(l) || NAME_ALPHA.test(l)) {
      name = l;
      usedIdx.add(i);
      break;
    }
  }

  // ── 氏名フォールバック（2〜8文字の日本語のみ行）
  if (!name) {
    for (let i = 0; i < lines.length; i++) {
      if (usedIdx.has(i)) continue;
      const l = lines[i];
      if (isContact(l) || COMPANY_JP.test(l) || TITLE_PAT.test(l) || DEPT_PAT.test(l)) continue;
      if (/^[\u4e00-\u9fff\u3040-\u30ff]{2,8}$/.test(l)) {
        name = l;
        usedIdx.add(i);
        break;
      }
    }
  }

  // ── メール
  const emailMatch = text.match(EMAIL_PAT);
  if (emailMatch) email = emailMatch[0];

  // ── 電話・FAX
  const phoneCandidates = [];
  for (const line of lines) {
    const faxM = line.match(FAX_LABELED);
    const telM = line.match(TEL_LABELED);
    if (faxM && !fax) fax = cleanPhone(faxM[1]);
    else if (telM)    phoneCandidates.push(cleanPhone(telM[1]));
  }
  if (phoneCandidates.length > 0) phone = phoneCandidates[0];
  if (!phone || !fax) {
    const bare = [...text.matchAll(BARE_PHONE)].map(m => cleanPhone(m[1]));
    if (!phone && bare.length >= 1) phone = bare[0];
    if (!fax   && bare.length >= 2) fax   = bare[1];
  }

  // ── 住所
  const addrLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (ZIP_PAT.test(l) || PREF_PAT.test(l)) {
      addrLines.push(l.replace(/[^\S\n]+/g, ''));
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (/[市区町村]|^\d/.test(next)) {
          addrLines.push(next.replace(/[^\S\n]+/g, ''));
        }
      }
      break;
    }
  }
  address = addrLines.join(' ');

  const result = { name, companyName, department, title, phone, fax, email, address };
  console.log('[fieldParser] result:', result);
  return result;
};

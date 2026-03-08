/**
 * ハイブリッドOCR結果からフィールドを抽出
 *
 * manga-ocrテキスト → 氏名・企業名・部署名（日本語テキスト）
 * Tesseractテキスト → 電話・FAX・メール・住所（構造化データ）
 */

// ── パターン定義 ─────────────────────────────────────────────────────────────

const TEL_LINE   = /(?:TEL|Tel|tel|電話|携帯|Mobile|直通|携帯電話)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const FAX_LINE   = /(?:FAX|Fax|fax|ファクス|ファックス)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const BARE_PHONE = /(?<![a-zA-Z\d])(0\d{1,4}[-\s]\d{2,4}[-\s]\d{4})(?![a-zA-Z\d])/g;
const EMAIL_PAT  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const ZIP_PAT    = /〒\s*\d{3}[-ー]\d{4}/;
const PREF_PAT   = /(?:北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)/;

const COMPANY_JP = /(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|公益財団法人|一般財団法人|医療法人|学校法人|社会福祉法人)/;
const COMPANY_EN = /\b(?:Inc\.?|Corp\.?|Co\.?,?\s*Ltd\.?|LLC|LLP|GmbH|S\.A\.?|PLC)\b/i;
const DEPT_PAT   = /(部|課|室|局|チーム|グループ|事業部|本部|センター|Division|Department|Dept\.?)/;
const TITLE_PAT  = /(社長|副社長|専務|常務|取締役|部長|次長|課長|係長|主任|マネージャー|ディレクター|CEO|COO|CFO|CTO|VP|President|Director|Manager)/i;

// 氏名パターン
const NAME_KANJI = /^[\u4e00-\u9fff]{1,4}\s*[\u4e00-\u9fff]{1,6}$/;
const NAME_KANA  = /^[ぁ-ん]{2,6}\s+[ぁ-ん]{1,6}$|^[ァ-ヶー]{2,8}\s+[ァ-ヶー]{1,6}$/;
const NAME_ALPHA = /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+$/;

const cleanPhone   = (s) => s.replace(/\s/g, '').replace(/[ー－]/g, '-');
const isNoise      = (s) => /^[\s\-_=＝・•●○▶︎※]+$/.test(s) || s.length < 2;
const isContactLine = (s) =>
  /@/.test(s) || /https?:\/\/|www\./i.test(s) ||
  TEL_LINE.test(s) || FAX_LINE.test(s) ||
  ZIP_PAT.test(s) || PREF_PAT.test(s) ||
  /^[\d\s\-\+\(\)]{8,}$/.test(s);

// ── manga-ocrテキストから日本語フィールドを抽出 ───────────────────────────

const extractJapaneseFields = (mangaText) => {
  if (!mangaText) return {};
  const lines = mangaText.split('\n').map(l => l.trim()).filter(l => !isNoise(l));

  let name = '', companyName = '', department = '', title = '';
  const deptLines = [];
  const usedLines = new Set();

  // 企業名（法人格キーワード）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (COMPANY_JP.test(line) || COMPANY_EN.test(line)) {
      companyName = line;
      usedLines.add(i);
      break;
    }
  }

  // 部署名（企業名の周辺から複数行収集）
  const companyIdx = lines.findIndex(l => l === companyName);
  const deptStart  = companyIdx >= 0 ? companyIdx + 1 : 0;
  for (let i = deptStart; i < Math.min(deptStart + 8, lines.length); i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if (isContactLine(line)) continue;
    if (DEPT_PAT.test(line)) {
      deptLines.push(line);
      usedLines.add(i);
    } else if (deptLines.length > 0 && line.length <= 30 && !/\d/.test(line)
               && !NAME_KANJI.test(line)) {
      deptLines.push(line);
      usedLines.add(i);
    } else if (deptLines.length > 0) {
      break;
    }
  }
  department = deptLines.join('\n');

  // 役職
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    if (TITLE_PAT.test(lines[i]) && !DEPT_PAT.test(lines[i])) {
      title = lines[i];
      usedLines.add(i);
      break;
    }
  }

  // 氏名（漢字→かな→英字の優先順）
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if ((NAME_KANJI.test(line) || NAME_KANA.test(line) || NAME_ALPHA.test(line))
        && line !== companyName && !DEPT_PAT.test(line)) {
      name = line;
      usedLines.add(i);
      break;
    }
  }

  // 氏名が見つからない場合: 短くて数字・連絡先でもない行
  if (!name) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      if (!isContactLine(line) && !COMPANY_JP.test(line) && !DEPT_PAT.test(line)
          && line.length >= 2 && line.length <= 16 && !/^\d/.test(line)) {
        name = line;
        break;
      }
    }
  }

  return { name, companyName, department, title };
};

// ── Tesseractテキストから構造化データを抽出 ───────────────────────────────

const extractStructuredData = (tesseractText) => {
  const lines = tesseractText.split('\n').map(l => l.trim()).filter(l => !isNoise(l));
  let phone = '', fax = '', email = '', address = '';

  // メール
  const emailMatch = tesseractText.match(EMAIL_PAT);
  if (emailMatch) email = emailMatch[0];

  // 電話・FAX（ラベル付き優先）
  const phoneCandidates = [];
  for (const line of lines) {
    const faxM = line.match(FAX_LINE);
    const telM = line.match(TEL_LINE);
    if (faxM && !fax) fax = cleanPhone(faxM[1]);
    else if (telM)    phoneCandidates.push(cleanPhone(telM[1]));
  }
  if (phoneCandidates.length > 0) phone = phoneCandidates[0];

  // ラベルなし電話フォールバック
  if (!phone || !fax) {
    const bare = [...tesseractText.matchAll(BARE_PHONE)].map(m => cleanPhone(m[1]));
    if (!phone && bare.length >= 1) phone = bare[0];
    if (!fax   && bare.length >= 2) fax   = bare[1];
  }

  // 住所
  const addrLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ZIP_PAT.test(line) || PREF_PAT.test(line)) {
      addrLines.push(line);
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (/^\d/.test(next) || PREF_PAT.test(next) || /[市区町村]/.test(next)) {
          addrLines.push(next);
        }
      }
      break;
    }
  }
  address = addrLines.join(' ');

  return { phone, fax, email, address };
};

// ── メインエントリ ────────────────────────────────────────────────────────────

export const parseFields = (ocrResult) => {
  // { text, mangaText, combined } または 文字列
  const tesseractText = typeof ocrResult === 'string' ? ocrResult : (ocrResult.text || '');
  const mangaText     = typeof ocrResult === 'string' ? ''         : (ocrResult.mangaText || '');

  // manga-ocrが取れていれば日本語フィールドはそちらを優先
  // 取れていなければTesseractテキストで補完
  const jpSource = mangaText || tesseractText;
  const jpFields = extractJapaneseFields(jpSource);

  // 構造化データは常にTesseractから取る（精度が高いため）
  const structuredFields = extractStructuredData(tesseractText);

  // manga-ocrで企業名が取れなかった場合、Tesseractからも探す
  if (!jpFields.companyName) {
    const fallbackLines = tesseractText.split('\n').map(l => l.trim());
    for (const line of fallbackLines) {
      if (COMPANY_JP.test(line) || COMPANY_EN.test(line)) {
        jpFields.companyName = line;
        break;
      }
    }
  }

  return {
    name:        jpFields.name        || '',
    companyName: jpFields.companyName || '',
    department:  jpFields.department  || '',
    title:       jpFields.title       || '',
    phone:       structuredFields.phone   || '',
    fax:         structuredFields.fax     || '',
    email:       structuredFields.email   || '',
    address:     structuredFields.address || '',
    raw:         tesseractText,
    mangaRaw:    mangaText,
  };
};

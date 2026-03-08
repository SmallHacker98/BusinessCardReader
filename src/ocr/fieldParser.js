/**
 * 名刺OCRテキストから各フィールドを抽出
 * 
 * 日本語名刺の構造的特性を活用:
 *   - 企業名は上部に大きく表示（株式会社等のキーワード）
 *   - 部署名は企業名の直下、複数行に渡ることがある
 *   - 氏名はカード中央付近に大きく表示
 *   - 連絡先（TEL/FAX/Email）はキーワードが前置される
 *   - 住所は〒または都道府県で始まる
 */

// ---- パターン定義 ----

// 電話番号（TEL/FAX/携帯等のラベルも含む行全体を捕捉）
const TEL_LINE   = /(?:TEL|Tel|tel|電話|携帯|Mobile|直通|携帯電話)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const FAX_LINE   = /(?:FAX|Fax|fax|ファクス|ファックス)[^\d]*(\+?[\d\s\-\(\)]{9,})/i;
const BARE_PHONE = /(?<![a-zA-Z\d])(0\d{1,4}[-\s]\d{2,4}[-\s]\d{4})(?![a-zA-Z\d])/g;

// メールアドレス
const EMAIL_PAT  = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

// 郵便番号・住所
const ZIP_PAT    = /〒\s*\d{3}[-ー]\d{4}/;
const PREF_PAT   = /(?:北海道|青森|岩手|宮城|秋田|山形|福島|茨城|栃木|群馬|埼玉|千葉|東京|神奈川|新潟|富山|石川|福井|山梨|長野|岐阜|静岡|愛知|三重|滋賀|京都|大阪|兵庫|奈良|和歌山|鳥取|島根|岡山|広島|山口|徳島|香川|愛媛|高知|福岡|佐賀|長崎|熊本|大分|宮崎|鹿児島|沖縄)/;

// 企業名キーワード
const COMPANY_JP = /(株式会社|有限会社|合同会社|一般社団法人|公益社団法人|公益財団法人|一般財団法人|医療法人|学校法人|社会福祉法人)/;
const COMPANY_EN = /\b(?:Inc\.?|Corp\.?|Co\.?,?\s*Ltd\.?|LLC|LLP|GmbH|S\.A\.?|N\.V\.?|PLC)\b/i;

// 部署・役職キーワード
const DEPT_PAT   = /(部|課|室|局|チーム|グループ|事業部|本部|センター|Division|Department|Dept\.?|Team|Group)/;
const TITLE_PAT  = /(社長|副社長|専務|常務|取締役|部長|次長|課長|係長|主任|マネージャー|ディレクター|エグゼクティブ|CEO|COO|CFO|CTO|CMO|VP|SVP|EVP|President|Director|Manager|Executive)/i;

// 氏名（漢字 or ひらがな/カタカナ のフルネーム）
const NAME_KANJI = /^[\u4e00-\u9fff]{1,4}\s*[\u4e00-\u9fff]{1,6}$/;
const NAME_KANA  = /^[ぁ-ん]{2,6}\s+[ぁ-ん]{1,6}$|^[ァ-ヶー]{2,8}\s+[ァ-ヶー]{1,6}$/;
const NAME_ALPHA = /^[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+$/; // John A. Smith

// ---- ユーティリティ ----

const cleanPhone = (s) => s.replace(/[\s]/g, '').replace(/[ー－]/g, '-');
const isNoise    = (s) => /^[\s\-_=＝・•●○▶︎※]+$/.test(s) || s.length < 2;
const hasDigit   = (s) => /\d/.test(s);
const hasAt      = (s) => /@/.test(s);
const hasURL     = (s) => /https?:\/\/|www\./i.test(s);

// 行が「連絡先情報」かどうか（企業名・部署名・氏名候補から除外）
const isContactLine = (s) =>
  hasAt(s) || hasURL(s) ||
  TEL_LINE.test(s) || FAX_LINE.test(s) ||
  ZIP_PAT.test(s) || PREF_PAT.test(s) ||
  /^[\d\s\-\+\(\)]{8,}$/.test(s);


// ---- メイン ----

export const parseFields = (ocrResult) => {
  // runOCR から { text, lines } を受け取る想定。文字列だけでも動作する
  const rawText = typeof ocrResult === 'string' ? ocrResult : ocrResult.text;
  const lines   = rawText.split('\n').map(l => l.trim()).filter(l => !isNoise(l));

  const result = {
    name: '',
    nameReading: '',   // フリガナ（あれば）
    companyName: '',
    department: '',    // 複数行を改行で結合
    title: '',         // 役職
    phone: '',
    fax: '',
    email: '',
    address: '',
    raw: rawText,
  };

  const usedLines = new Set();

  // ── 1. メール（最も確実） ──
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(EMAIL_PAT);
    if (m) {
      result.email = m[0];
      usedLines.add(i);
      break;
    }
  }

  // ── 2. 電話・FAX（ラベル付き行を優先） ──
  const phoneCandidates = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const telM = line.match(TEL_LINE);
    const faxM = line.match(FAX_LINE);
    if (faxM) {
      result.fax = cleanPhone(faxM[1]);
      usedLines.add(i);
    } else if (telM) {
      phoneCandidates.push({ num: cleanPhone(telM[1]), idx: i });
      usedLines.add(i);
    }
  }
  if (phoneCandidates.length > 0) {
    result.phone = phoneCandidates[0].num;
    // TELラベル付きが2つ以上 → 2つ目を携帯か直通として補完
    if (phoneCandidates.length > 1 && !result.fax) {
      // 2つ目はFAXでなく携帯扱い（別フィールドがあれば拡張可）
    }
  }
  // ラベルなし電話番号フォールバック
  if (!result.phone || !result.fax) {
    const bareMatches = [];
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const m = [...lines[i].matchAll(BARE_PHONE)];
      m.forEach(hit => bareMatches.push({ num: cleanPhone(hit[1]), idx: i }));
    }
    if (!result.phone && bareMatches.length >= 1) {
      result.phone = bareMatches[0].num;
      usedLines.add(bareMatches[0].idx);
    }
    if (!result.fax && bareMatches.length >= 2) {
      result.fax = bareMatches[1].num;
      usedLines.add(bareMatches[1].idx);
    }
  }

  // ── 3. 住所（〒 or 都道府県） ──
  const addressLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if (ZIP_PAT.test(line) || PREF_PAT.test(line)) {
      addressLines.push(line);
      usedLines.add(i);
      // 次の行が番地の続きなら結合（数字で始まる or "市区町村"を含む）
      if (i + 1 < lines.length && !usedLines.has(i + 1)) {
        const next = lines[i + 1];
        if (/^\d/.test(next) || PREF_PAT.test(next) || /[市区町村]/.test(next)) {
          addressLines.push(next);
          usedLines.add(i + 1);
        }
      }
      break;
    }
  }
  result.address = addressLines.join(' ');

  // ── 4. 企業名（JP法人格 > EN法人格 > 上方向に大きい行） ──
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if (COMPANY_JP.test(line) || COMPANY_EN.test(line)) {
      // "株式会社" が行頭にある場合（後置も対応）
      result.companyName = line;
      usedLines.add(i);
      break;
    }
  }

  // ── 5. 部署名・役職（企業名の直後、複数行を収集） ──
  const deptLines = [];
  let companyIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === result.companyName) { companyIdx = i; break; }
  }

  // 企業名の直後から部署キーワードを含む行を連続して取得
  const startIdx = companyIdx >= 0 ? companyIdx + 1 : 0;
  for (let i = startIdx; i < Math.min(startIdx + 6, lines.length); i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if (isContactLine(line)) break;
    if (DEPT_PAT.test(line)) {
      deptLines.push(line);
      usedLines.add(i);
    } else if (deptLines.length > 0 && !NAME_KANJI.test(line) && !NAME_KANA.test(line)) {
      // 部署名が始まった後、続く短い行も部署の一部と判断
      if (line.length <= 30 && !hasDigit(line)) {
        deptLines.push(line);
        usedLines.add(i);
      } else {
        break;
      }
    }
  }
  result.department = deptLines.join('\n');

  // 役職（部署名が見つかった後に出てくる役職キーワード）
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    if (TITLE_PAT.test(lines[i]) && !DEPT_PAT.test(lines[i])) {
      result.title = lines[i];
      usedLines.add(i);
      break;
    }
  }

  // ── 6. 氏名 ──
  // 候補1: 漢字フルネーム（空白区切り）
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const line = lines[i];
    if (NAME_KANJI.test(line)) {
      result.name = line;
      usedLines.add(i);
      // 直前 or 直後にフリガナ（カタカナ）があれば取得
      const prev = i > 0 ? lines[i - 1] : '';
      const next = i < lines.length - 1 ? lines[i + 1] : '';
      if (NAME_KANA.test(prev) && !usedLines.has(i - 1)) {
        result.nameReading = prev;
        usedLines.add(i - 1);
      } else if (NAME_KANA.test(next) && !usedLines.has(i + 1)) {
        result.nameReading = next;
        usedLines.add(i + 1);
      }
      break;
    }
  }
  // 候補2: カタカナ or ひらがなフルネーム
  if (!result.name) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      if (NAME_KANA.test(lines[i])) {
        result.name = lines[i];
        usedLines.add(i);
        break;
      }
    }
  }
  // 候補3: アルファベット氏名
  if (!result.name) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      if (NAME_ALPHA.test(lines[i])) {
        result.name = lines[i];
        usedLines.add(i);
        break;
      }
    }
  }
  // 候補4: 残った短い行で連絡先でもURLでもないもの（最終フォールバック）
  if (!result.name) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i];
      if (
        !isContactLine(line) &&
        !COMPANY_JP.test(line) && !COMPANY_EN.test(line) &&
        !DEPT_PAT.test(line) && !TITLE_PAT.test(line) &&
        line.length >= 2 && line.length <= 16 &&
        !hasDigit(line) && !hasURL(line)
      ) {
        result.name = line;
        usedLines.add(i);
        break;
      }
    }
  }

  return result;
};

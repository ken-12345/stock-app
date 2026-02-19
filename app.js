/**
 * 投資判断アプリ - メインロジック
 * Gemini API（Google Search grounding）を使用して
 * ストップ高銘柄の取得・銘柄分析・投資判断を行う
 */

'use strict';

// ===== 定数 =====
const STORAGE_KEY_API = 'investment_app_api_key';
const STORAGE_KEY_MODEL = 'investment_app_model';
const STORAGE_KEY_THEME = 'investment_app_theme';
const GEMINI_API_LIST = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_API_BASE_TPL = 'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent';
// Google Search groundingに対応しているモデルのキーワード
const SEARCH_CAPABLE_KEYWORDS = ['gemini-2.0', 'gemini-1.5', 'gemini-2.5'];

// ===== 状態管理 =====
const state = {
  apiKey: '',
  selectedModel: '',
  theme: 'dark',
  availableModels: [],
  isLoadingModels: false,
  stockList: [],
  soaringList: [],
  selectedStock: null,
  isLoadingStocks: false,
  isLoadingReport: false,
};

// ===== DOM要素 =====
const els = {
  // ヘッダー
  dateDisplay: document.getElementById('dateDisplay'),
  settingsBtn: document.getElementById('settingsBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  // ストップ高
  fetchBtn: document.getElementById('fetchBtn'),
  fetchStatus: document.getElementById('fetchStatus'),
  stockTableBody: document.getElementById('stockTableBody'),
  tableContainer: document.getElementById('tableContainer'),
  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  stockCount: document.getElementById('stockCount'),
  // 急騰銘柄
  soaringCount: document.getElementById('soaringCount'),
  soaringTableBody: document.getElementById('soaringTableBody'),
  soaringTableContainer: document.getElementById('soaringTableContainer'),
  soaringEmptyState: document.getElementById('soaringEmptyState'),
  // レポート
  reportSection: document.getElementById('reportSection'),
  reportContent: document.getElementById('reportContent'),
  reportLoading: document.getElementById('reportLoading'),
  // モーダル
  settingsModal: document.getElementById('settingsModal'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  // 検索
  customSearchInput: document.getElementById('customSearchInput'),
  customAnalyzeBtn: document.getElementById('customAnalyzeBtn'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  // データ日付
  dataDateDisplay: document.getElementById('dataDateDisplay'),
  soaringDataDateDisplay: document.getElementById('soaringDataDateDisplay'),
  // モデル選択
  fetchModelsBtn: document.getElementById('fetchModelsBtn'),
  modelSelect: document.getElementById('modelSelect'),
  modelStatus: document.getElementById('modelStatus'),
  currentModelBadge: document.getElementById('currentModelBadge'),
};

// ===== 初期化 =====
function init() {
  // APIキー・モデル・テーマ読み込み
  state.apiKey = localStorage.getItem(STORAGE_KEY_API) || '';
  state.selectedModel = localStorage.getItem(STORAGE_KEY_MODEL) || 'gemini-2.0-flash';
  state.theme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';

  // テーマを適用
  applyTheme(state.theme);

  // 日付表示
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  });
  if (els.dateDisplay) els.dateDisplay.textContent = dateStr;

  // 現在のモデルをヘッダーに表示
  updateModelBadge();

  // イベントリスナー
  els.fetchBtn?.addEventListener('click', fetchStopHighStocks);
  els.settingsBtn?.addEventListener('click', openSettings);
  els.closeModalBtn?.addEventListener('click', closeSettings);
  els.cancelSettingsBtn?.addEventListener('click', closeSettings);
  els.saveSettingsBtn?.addEventListener('click', saveSettings);
  els.fetchModelsBtn?.addEventListener('click', fetchAvailableModels);
  els.themeToggleBtn?.addEventListener('click', toggleTheme);
  els.customAnalyzeBtn?.addEventListener('click', handleCustomAnalyze);
  els.customSearchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCustomAnalyze();
  });
  els.clearSearchBtn?.addEventListener('click', () => {
    if (els.customSearchInput) {
      els.customSearchInput.value = '';
      els.customSearchInput.focus();
    }
  });
  els.settingsModal?.addEventListener('click', (e) => {
    if (e.target === els.settingsModal) closeSettings();
  });

  // APIキーが未設定なら設定を促す
  if (!state.apiKey) {
    showAlert('APIキーが設定されていません。右上の設定ボタンからGemini APIキーを入力してください。', 'warning');
  }
}

// ===== テーマ切り替え =====
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(state.theme);
  localStorage.setItem(STORAGE_KEY_THEME, state.theme);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

// ===== モデルバッジ更新 =====
function updateModelBadge() {
  if (els.currentModelBadge) {
    els.currentModelBadge.textContent = state.selectedModel || '未選択';
  }
}

// ===== アラート表示 =====
function showAlert(message, type = 'info') {
  const alertEl = document.getElementById('alertArea');
  if (!alertEl) return;
  const icon = type === 'warning' ? '⚠️' : 'ℹ️';
  alertEl.innerHTML = `
    <div class="alert alert-${type}">
      <span class="alert-icon">${icon}</span>
      <span>${message}</span>
    </div>
  `;
  setTimeout(() => { alertEl.innerHTML = ''; }, 8000);
}

// ===== 設定モーダル =====
function openSettings() {
  els.apiKeyInput.value = state.apiKey;
  // モデルリストを復元
  if (state.availableModels.length > 0) {
    renderModelSelect(state.availableModels);
  }
  els.settingsModal.classList.add('open');
}

function closeSettings() {
  els.settingsModal.classList.remove('open');
}

function saveSettings() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    alert('APIキーを入力してください。');
    return;
  }
  // モデル選択を保存
  const selectedOption = els.modelSelect?.value;
  if (selectedOption) {
    state.selectedModel = selectedOption;
    localStorage.setItem(STORAGE_KEY_MODEL, selectedOption);
  }
  state.apiKey = key;
  localStorage.setItem(STORAGE_KEY_API, key);
  updateModelBadge();
  closeSettings();
  showAlert(`APIキーとモデル（${state.selectedModel}）を保存しました。`, 'info');
}

// ===== 利用可能モデルの取得 =====
async function fetchAvailableModels() {
  const key = els.apiKeyInput.value.trim() || state.apiKey;
  if (!key) {
    setModelStatus('error', 'APIキーを先に入力してください。');
    return;
  }

  if (state.isLoadingModels) return;
  state.isLoadingModels = true;

  setModelStatus('loading', 'モデルを取得中...');
  if (els.fetchModelsBtn) {
    els.fetchModelsBtn.disabled = true;
    els.fetchModelsBtn.textContent = '取得中...';
  }

  try {
    const url = `${GEMINI_API_LIST}?key=${key}&pageSize=100`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `APIエラー (${res.status})`);
    }
    const data = await res.json();
    const models = (data.models || [])
      // generateContent対応のモデルのみ
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      // モデル名を整形（models/gemini-xxx → gemini-xxx）
      .map(m => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName || m.name.replace('models/', ''),
        description: m.description || '',
        supportsSearch: SEARCH_CAPABLE_KEYWORDS.some(k => m.name.includes(k)),
      }))
      // 新しいモデルを上に
      .sort((a, b) => b.id.localeCompare(a.id));

    state.availableModels = models;
    renderModelSelect(models);
    setModelStatus('success', `${models.length}件のモデルを取得しました`);

  } catch (err) {
    console.error(err);
    setModelStatus('error', `取得失敗: ${err.message}`);
  } finally {
    state.isLoadingModels = false;
    if (els.fetchModelsBtn) {
      els.fetchModelsBtn.disabled = false;
      els.fetchModelsBtn.textContent = '🔄 モデルを検索';
    }
  }
}

// ===== モデルセレクトを描画 =====
function renderModelSelect(models) {
  if (!els.modelSelect) return;
  els.modelSelect.innerHTML = models.map(m => {
    const searchTag = m.supportsSearch ? ' ✓検索対応' : ' △検索非対応';
    return `<option value="${m.id}" ${m.id === state.selectedModel ? 'selected' : ''}>${m.displayName}${searchTag}</option>`;
  }).join('');
  // 選択肢がない場合
  if (models.length === 0) {
    els.modelSelect.innerHTML = '<option value="">利用可能なモデルがありません</option>';
  }
}

// ===== モデルステータス表示 =====
function setModelStatus(type, message) {
  if (!els.modelStatus) return;
  const colorMap = { loading: 'var(--text-muted)', success: 'var(--accent-green)', error: 'var(--accent-red)' };
  els.modelStatus.style.color = colorMap[type] || 'var(--text-muted)';
  els.modelStatus.textContent = message;
}

// ===== Gemini API呼び出し =====
async function callGeminiAPI(prompt, useSearch = true) {
  if (!state.apiKey) {
    throw new Error('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
  }

  const model = state.selectedModel || 'gemini-2.0-flash';

  // 選択モデルがSearch対応かチェック
  const supportsSearch = useSearch && SEARCH_CAPABLE_KEYWORDS.some(k => model.includes(k));

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  };

  // Google Search grounding を有効化（対応モデルのみ）
  if (supportsSearch) {
    body.tools = [{ google_search: {} }];
  }

  const url = GEMINI_API_BASE_TPL.replace('{MODEL}', model) + `?key=${state.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `APIエラー (${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // grounding metadata（ソースURL）
  const groundingMeta = data?.candidates?.[0]?.groundingMetadata;
  const sources = groundingMeta?.groundingChunks
    ?.map(c => ({ title: c.web?.title, uri: c.web?.uri }))
    .filter(s => s.uri) || [];

  return { text, sources, model, usedSearch: supportsSearch };
}

// ===== ストップ高銘柄取得 =====
async function fetchStopHighStocks() {
  if (!state.apiKey) {
    openSettings();
    return;
  }

  if (state.isLoadingStocks) return;
  state.isLoadingStocks = true;

  // UI更新
  els.fetchBtn.disabled = true;
  els.emptyState.style.display = 'none';
  els.tableContainer.style.display = 'none';
  if (els.soaringEmptyState) els.soaringEmptyState.style.display = 'none';
  if (els.soaringTableContainer) els.soaringTableContainer.style.display = 'none';
  els.loadingState.style.display = 'flex';
  els.fetchStatus.textContent = 'データ取得中...';

  // 市場終了時刻（15:30）を考慮したターゲット日付の決定
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(15, 30, 0, 0);

  let targetDate = new Date();
  if (now < cutoff) {
    // 15:30前なら前日のデータを取得
    targetDate.setDate(targetDate.getDate() - 1);
  }

  const dateStr = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
あなたは日本株の専門アナリストです。
取得対象日（${dateStr}）の東京証券取引所の「ストップ高銘柄」と「急騰銘柄（前日比+10%以上）」を、Yahoo!ファイナンスや株探などのサイトから取得してください。

以下のJSON形式で出力してください。他のテキストは一切含めず、JSONのみを出力してください：

{
  "date": "取得日付",
  "stopHighs": [
    {
      "no": 1,
      "code": "銘柄コード（4桁）",
      "name": "銘柄名",
      "market": "市場区分",
      "price": "終値（円）",
      "change": "前日比（%）",
      "material": "ストップ高の理由・材料（30文字以内）"
    }
  ],
  "soaring": [
    {
      "no": 1,
      "code": "銘柄コード（4桁）",
      "name": "銘柄名",
      "market": "市場区分",
      "price": "終値（円）",
      "change": "前日比（%）",
      "material": "急騰の理由・材料（30文字以内）"
    }
  ]
}

注意事項：
- 本日の実際のデータを取得してください
- ストップ高銘柄は最大20件、急騰銘柄は最大10件取得してください
- materialが不明な場合は「材料不明」と記載してください
- JSONのみを出力してください
`;

  try {
    const { text, sources } = await callGeminiAPI(prompt, true);

    // JSONパース
    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error('データの解析に失敗しました。');
      }
    }

    // データの日付をUIに反映
    if (data.date) {
      if (els.dataDateDisplay) els.dataDateDisplay.textContent = `(${data.date})`;
      if (els.soaringDataDateDisplay) els.soaringDataDateDisplay.textContent = `(${data.date})`;
    }

    const stopHighs = data.stopHighs || (data.stocks ? data.stocks : []); // 旧形式互換
    const soaringRaw = data.soaring || [];

    // 重複排除: ストップ高銘柄に含まれるコードを急騰銘柄から除外
    const stopHighCodes = new Set(stopHighs.map(s => String(s.code)));
    const filteredSoaring = soaringRaw.filter(s => !stopHighCodes.has(String(s.code)));

    state.stockList = stopHighs;
    state.soaringList = filteredSoaring;

    // ストップ高テーブル描画
    renderStockTable(state.stockList, sources, 'stockTableBody', 'stockCount', 'emptyState', 'tableContainer');

    // 急騰銘柄テーブル描画
    renderStockTable(state.soaringList, [], 'soaringTableBody', 'soaringCount', 'soaringEmptyState', 'soaringTableContainer');

    els.fetchStatus.textContent = `ストップ高: ${state.stockList.length}件 / 急騰: ${state.soaringList.length}件 を取得しました`;

  } catch (err) {
    console.error(err);
    els.loadingState.style.display = 'none';
    els.emptyState.style.display = 'flex';
    els.emptyState.innerHTML = `
      <div class="empty-icon">❌</div>
      <div class="empty-text">
        データの取得に失敗しました<br>
        <small style="color:var(--accent-red)">${err.message}</small>
      </div>
    `;
    els.fetchStatus.textContent = 'エラーが発生しました';
    showAlert(err.message, 'warning');
  } finally {
    state.isLoadingStocks = false;
    els.fetchBtn.disabled = false;
    els.loadingState.style.display = 'none';
  }
}

// ===== 銘柄テーブル描画 =====
// ===== 銘柄テーブル描画 =====
function renderStockTable(stocks, sources = [], bodyId = 'stockTableBody', countId = 'stockCount', emptyId = 'emptyState', containerId = 'tableContainer') {
  const bodyEl = document.getElementById(bodyId);
  const countEl = document.getElementById(countId);
  const emptyEl = document.getElementById(emptyId);
  const containerEl = document.getElementById(containerId);

  if (!stocks || stocks.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (containerEl) containerEl.style.display = 'none';
    if (countEl) countEl.textContent = '0';
    return;
  }

  if (countEl) countEl.textContent = stocks.length;
  if (containerEl) containerEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  if (bodyEl) {
    bodyEl.innerHTML = stocks.map((s, i) => {
      const marketClass = getMarketClass(s.market);
      const changeVal = parseFloat(String(s.change).replace('%', '').replace('+', ''));
      const changeClass = changeVal >= 0 ? 'change-positive' : 'change-negative';
      const changeDisplay = isNaN(changeVal) ? s.change : `${changeVal > 0 ? '+' : ''}${changeVal.toFixed(2)}%`;

      return `
        <tr onclick="analyzeStock('${s.code}', '${escapeHtml(s.name)}', '${escapeHtml(s.market)}', '${escapeHtml(s.price)}', '${escapeHtml(s.change)}', '${escapeHtml(s.material)}')">
          <td style="color:var(--text-muted);font-size:12px">${i + 1}</td>
          <td><span class="stock-code">${s.code}</span></td>
          <td><span class="stock-name">${escapeHtml(s.name)}</span></td>
          <td><span class="market-badge ${marketClass}">${escapeHtml(s.market)}</span></td>
          <td><span class="price-value">${escapeHtml(s.price)}円</span></td>
          <td><span class="${changeClass}">${escapeHtml(changeDisplay)}</span></td>
          <td><span class="material-text">${escapeHtml(s.material)}</span></td>
          <td>
            <button class="analyze-btn" onclick="event.stopPropagation(); analyzeStock('${s.code}', '${escapeHtml(s.name)}', '${escapeHtml(s.market)}', '${escapeHtml(s.price)}', '${escapeHtml(s.change)}', '${escapeHtml(s.material)}')">
              📊 分析
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ソース表示（ストップ高のときのみ表示するなど制御してもよいが、一旦そのまま）
  if (sources.length > 0 && containerId === 'tableContainer') { // メインのテーブルの時だけソース更新
    const sourcesEl = document.getElementById('stockSources');
    if (sourcesEl) {
      sourcesEl.innerHTML = `
        <div class="sources-section">
          <div class="sources-title">📎 参照ソース</div>
          <div class="sources-list">
            ${sources.slice(0, 5).map(s => `<a href="${s.uri}" target="_blank" rel="noopener" class="source-link">・${s.title || s.uri}</a>`).join('')}
          </div>
        </div>
      `;
    }
  }
}

// ===== 市場クラス取得 =====
function getMarketClass(market) {
  if (!market) return 'market-standard';
  const m = market.toLowerCase();
  if (m.includes('プライム') || m.includes('prime')) return 'market-prime';
  if (m.includes('グロース') || m.includes('growth')) return 'market-growth';
  return 'market-standard';
}

// ===== 銘柄分析 =====
async function analyzeStock(code, name, market, price, change, material) {
  if (!state.apiKey) {
    openSettings();
    return;
  }

  if (state.isLoadingReport) return;
  state.isLoadingReport = true;

  // レポートセクション表示
  els.reportSection.classList.add('visible');
  els.reportContent.style.display = 'none';
  els.reportLoading.style.display = 'flex';

  // スクロール
  els.reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 市場終了時刻（15:30）を考慮したターゲット日付の決定
  const now = new Date();
  const cutoff = new Date();
  cutoff.setHours(15, 30, 0, 0);

  let targetDate = new Date();
  if (now < cutoff) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  const dateStr = targetDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `
分析対象日（${dateStr}）における、以下の銘柄を分析してください：
- 銘柄コード: ${code}
- 銘柄名: ${name}
- 市場: ${market}
- 現在株価: ${price}円
- 前日比: ${change}
- ストップ高理由: ${material}
- 分析日: ${dateStr}

Yahoo!ファイナンス、株探、みんかぶ、会社のIRページ、EDINET等から以下の情報を取得して分析してください：
1. 最新決算（売上高、営業利益、経常利益、純利益、前年比成長率）
2. 財務指標（自己資本比率、有利子負債、営業CF）
3. バリュエーション（PER、PBR、ROE、配当利回り）
4. 最新ニュース・材料の評価
5. リスク要因

以下のJSON形式のみで出力してください（マークダウンのコードブロック記号は使わないでください）：

{
  "basicInfo": {
    "name": "${name}",
    "code": "${code}",
    "market": "${market}",
    "price": "${price}",
    "change": "${change}",
    "stopHighReason": "ストップ高の詳細な理由"
  },
  "performance": {
    "revenue": "売上高（最新期）",
    "operatingProfit": "営業利益",
    "ordinaryProfit": "経常利益",
    "netProfit": "純利益",
    "growthRate": "前年比成長率",
    "operatingMargin": "営業利益率",
    "comment": "業績に関するコメント（100文字程度）"
  },
  "financial": {
    "equityRatio": "自己資本比率",
    "interestBearingDebt": "有利子負債",
    "operatingCF": "営業キャッシュフロー",
    "comment": "財務健全性に関するコメント（100文字程度）"
  },
  "valuation": {
    "per": "PER",
    "pbr": "PBR",
    "roe": "ROE",
    "dividendYield": "配当利回り",
    "eps": "EPS",
    "bps": "BPS",
    "comment": "バリュエーションに関するコメント（100文字程度）"
  },
  "material": {
    "strength": "強い/普通/弱い",
    "strengthScore": 75,
    "continuity": "長期/中期/短期",
    "heatLevel": "過熱/適温/冷静",
    "comment": "材料の評価コメント（100文字程度）"
  },
  "risks": [
    "リスク要因1",
    "リスク要因2",
    "リスク要因3"
  ],
  "cautions": "注意点（50文字程度）",
  "verdict": {
    "judgment": "買い または 中立 または 売り",
    "reason1": "判断理由1（50文字程度）",
    "reason2": "判断理由2（50文字程度）",
    "reason3": "判断理由3（50文字程度）",
    "shortTerm": "短期トレードの場合の戦略",
    "longTerm": "中長期投資の場合の戦略",
    "stopLoss": "損切りライン目安",
    "profitTarget": "利確目標の考え方"
  },
  "sources": [
    {"title": "参照サイト名", "url": "URL"}
  ],
  "dataNote": "取得できなかったデータがある場合はここに記載"
}

重要なルール：
- 必ず事実ベースで分析すること（推測で断定しない）
- データが取得できない場合は「取得できなかった」と明記すること
- 煽りや過剰な楽観は禁止
- 必ずリスクを明示すること
- JSONのみを出力し、他のテキストは含めないこと
`;

  try {
    const { text, sources } = await callGeminiAPI(prompt, true);

    // JSONパース
    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      const match = jsonText.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error('分析データの解析に失敗しました。');
      }
    }

    // grounding sourcesをマージ
    if (sources.length > 0) {
      data.groundingSources = sources;
    }

    renderReport(data);

  } catch (err) {
    console.error(err);
    els.reportContent.innerHTML = `
      <div class="alert alert-warning">
        <span class="alert-icon">❌</span>
        <span>分析に失敗しました: ${err.message}</span>
      </div>
    `;
    els.reportContent.style.display = 'block';
    showAlert(err.message, 'warning');
  } finally {
    state.isLoadingReport = false;
    els.reportLoading.style.display = 'none';
    els.reportContent.style.display = 'block';
  }
}

// ===== レポート描画 =====
function renderReport(data) {
  const { basicInfo, performance, financial, valuation, material, risks, cautions, verdict, sources, groundingSources, dataNote } = data;

  // 投資判断クラス
  const judgmentMap = { '買い': 'buy', '売り': 'sell', '中立': 'neutral' };
  const verdictClass = judgmentMap[verdict?.judgment] || 'neutral';
  const verdictEmoji = { '買い': '✅', '売り': '🔴', '中立': '⚖️' }[verdict?.judgment] || '⚖️';

  // 材料強度スコア
  const strengthScore = material?.strengthScore || 50;
  const strengthClass = strengthScore >= 70 ? 'high' : strengthScore >= 40 ? 'medium' : 'low';

  // ソースURL（grounding + data内）
  const allSources = [
    ...(groundingSources || []).map(s => ({ title: s.title, url: s.uri })),
    ...(sources || []),
  ].filter((s, i, arr) => s.url && arr.findIndex(x => x.url === s.url) === i);

  els.reportContent.innerHTML = `
    <!-- レポートヘッダー -->
    <div class="report-header-card">
      <div class="report-stock-info">
        <div>
          <div class="report-stock-name">${escapeHtml(basicInfo?.name || '')}</div>
          <div class="report-stock-meta">
            <span class="report-code">${escapeHtml(basicInfo?.code || '')}</span>
            <span class="market-badge ${getMarketClass(basicInfo?.market)}">${escapeHtml(basicInfo?.market || '')}</span>
            <span class="status-dot live"></span>
            <span style="font-size:11px;color:var(--text-muted)">リアルタイム分析</span>
          </div>
          <div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">
            📌 ストップ高理由: ${escapeHtml(basicInfo?.stopHighReason || basicInfo?.stopHighReason || '取得できなかった')}
          </div>
        </div>
        <div class="report-price-block">
          <div class="report-price">${escapeHtml(basicInfo?.price || '')}円</div>
          <div class="report-change ${parseFloat(String(basicInfo?.change).replace('%', '').replace('+', '')) >= 0 ? 'change-positive' : 'change-negative'}">
            ${escapeHtml(basicInfo?.change || '')}
          </div>
        </div>
      </div>
    </div>

    <!-- 投資判断バナー -->
    <div class="verdict-banner ${verdictClass}">
      <div>
        <div class="verdict-label">📌 総合投資判断</div>
      </div>
      <div class="verdict-text">${verdictEmoji} ${escapeHtml(verdict?.judgment || '中立')}</div>
    </div>

    <!-- グリッド -->
    <div class="report-grid">

      <!-- 業績分析 -->
      <div class="report-card">
        <div class="report-card-title">
          <span class="card-icon">📈</span>
          業績分析（決算）
        </div>
        <div class="data-row">
          <span class="data-label">売上高</span>
          <span class="data-value">${escapeHtml(performance?.revenue || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">営業利益</span>
          <span class="data-value">${escapeHtml(performance?.operatingProfit || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">経常利益</span>
          <span class="data-value">${escapeHtml(performance?.ordinaryProfit || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">純利益</span>
          <span class="data-value">${escapeHtml(performance?.netProfit || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">前年比成長率</span>
          <span class="data-value highlight">${escapeHtml(performance?.growthRate || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">営業利益率</span>
          <span class="data-value">${escapeHtml(performance?.operatingMargin || '取得できなかった')}</span>
        </div>
        <div class="comment-block">${escapeHtml(performance?.comment || '')}</div>
      </div>

      <!-- 財務健全性 -->
      <div class="report-card">
        <div class="report-card-title">
          <span class="card-icon">🏦</span>
          財務健全性
        </div>
        <div class="data-row">
          <span class="data-label">自己資本比率</span>
          <span class="data-value">${escapeHtml(financial?.equityRatio || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">有利子負債</span>
          <span class="data-value">${escapeHtml(financial?.interestBearingDebt || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">営業キャッシュフロー</span>
          <span class="data-value">${escapeHtml(financial?.operatingCF || '取得できなかった')}</span>
        </div>
        <div class="comment-block">${escapeHtml(financial?.comment || '')}</div>
      </div>

      <!-- バリュエーション -->
      <div class="report-card">
        <div class="report-card-title">
          <span class="card-icon">💹</span>
          株価バリュエーション
        </div>
        <div class="data-row">
          <span class="data-label">PER</span>
          <span class="data-value">${escapeHtml(valuation?.per || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">PBR</span>
          <span class="data-value">${escapeHtml(valuation?.pbr || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">ROE</span>
          <span class="data-value">${escapeHtml(valuation?.roe || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">EPS</span>
          <span class="data-value">${escapeHtml(valuation?.eps || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">BPS</span>
          <span class="data-value">${escapeHtml(valuation?.bps || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">配当利回り</span>
          <span class="data-value">${escapeHtml(valuation?.dividendYield || '取得できなかった')}</span>
        </div>
        <div class="comment-block">${escapeHtml(valuation?.comment || '')}</div>
      </div>

      <!-- 材料評価 -->
      <div class="report-card">
        <div class="report-card-title">
          <span class="card-icon">🔥</span>
          材料の評価
        </div>
        <div class="data-row">
          <span class="data-label">材料の強さ</span>
          <span class="data-value">${escapeHtml(material?.strength || '取得できなかった')}</span>
        </div>
        <div class="strength-meter">
          <span style="font-size:11px;color:var(--text-muted);width:60px">強度</span>
          <div class="strength-bar">
            <div class="strength-fill ${strengthClass}" style="width:${strengthScore}%"></div>
          </div>
          <span style="font-size:11px;color:var(--text-muted);width:30px">${strengthScore}%</span>
        </div>
        <div class="data-row">
          <span class="data-label">継続性</span>
          <span class="data-value">${escapeHtml(material?.continuity || '取得できなかった')}</span>
        </div>
        <div class="data-row">
          <span class="data-label">需給（過熱度）</span>
          <span class="data-value">${escapeHtml(material?.heatLevel || '取得できなかった')}</span>
        </div>
        <div class="comment-block">${escapeHtml(material?.comment || '')}</div>
      </div>

    </div>

    <!-- リスク -->
    <div class="report-card" style="margin-bottom:16px">
      <div class="report-card-title">
        <span class="card-icon">⚠️</span>
        リスク要因
      </div>
      <ul class="risk-list">
        ${(risks || []).map(r => `<li class="risk-item">${escapeHtml(r)}</li>`).join('')}
      </ul>
      ${cautions ? `<div class="comment-block" style="margin-top:12px">📌 注意点: ${escapeHtml(cautions)}</div>` : ''}
    </div>

    <!-- 総合評価 -->
    <div class="report-card" style="margin-bottom:16px">
      <div class="report-card-title">
        <span class="card-icon">🎯</span>
        総合評価・投資戦略
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">判断理由</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${verdict?.reason1 ? `<div style="display:flex;gap:8px;font-size:13px"><span style="color:var(--accent-blue);flex-shrink:0">①</span><span style="color:var(--text-secondary)">${escapeHtml(verdict.reason1)}</span></div>` : ''}
          ${verdict?.reason2 ? `<div style="display:flex;gap:8px;font-size:13px"><span style="color:var(--accent-blue);flex-shrink:0">②</span><span style="color:var(--text-secondary)">${escapeHtml(verdict.reason2)}</span></div>` : ''}
          ${verdict?.reason3 ? `<div style="display:flex;gap:8px;font-size:13px"><span style="color:var(--accent-blue);flex-shrink:0">③</span><span style="color:var(--text-secondary)">${escapeHtml(verdict.reason3)}</span></div>` : ''}
        </div>
      </div>
      <div class="strategy-grid">
        <div class="strategy-item">
          <div class="strategy-label">⚡ 短期トレード</div>
          <div class="strategy-value">${escapeHtml(verdict?.shortTerm || '取得できなかった')}</div>
        </div>
        <div class="strategy-item">
          <div class="strategy-label">📅 中長期投資</div>
          <div class="strategy-value">${escapeHtml(verdict?.longTerm || '取得できなかった')}</div>
        </div>
        <div class="strategy-item">
          <div class="strategy-label">🛑 損切りライン</div>
          <div class="strategy-value" style="color:var(--accent-red)">${escapeHtml(verdict?.stopLoss || '取得できなかった')}</div>
        </div>
        <div class="strategy-item">
          <div class="strategy-label">🎯 利確目標</div>
          <div class="strategy-value" style="color:var(--accent-green)">${escapeHtml(verdict?.profitTarget || '取得できなかった')}</div>
        </div>
      </div>
    </div>

    ${dataNote ? `<div class="alert alert-info"><span class="alert-icon">ℹ️</span><span>${escapeHtml(dataNote)}</span></div>` : ''}

    <!-- ソース -->
    ${allSources.length > 0 ? `
    <div class="sources-section">
      <div class="sources-title">📎 参照ソース</div>
      <div class="sources-list">
        ${allSources.slice(0, 8).map(s => `<a href="${s.url}" target="_blank" rel="noopener" class="source-link">・${escapeHtml(s.title || s.url)}</a>`).join('')}
      </div>
    </div>
    ` : ''}

    <!-- 免責事項 -->
    <div class="disclaimer">
      ⚠️ 本レポートは情報提供を目的としており、投資勧誘を目的とするものではありません。
      投資判断はご自身の責任において行ってください。
      AIによる分析であり、実際の投資成果を保証するものではありません。
    </div>
  `;
}

// ===== 検索ボタンハンドラー =====
async function handleCustomAnalyze() {
  const query = els.customSearchInput.value.trim();
  if (!query) {
    showAlert('銘柄コードまたは銘柄名を入力してください。', 'warning');
    return;
  }

  // 銘柄コードか名前かを判別（簡易）
  const isCode = /^[0-9]{4}$/.test(query);
  const code = isCode ? query : '';
  const name = isCode ? '' : query;

  // 分析実行
  analyzeStock(code, name, '取得中', '取得中', '+0.00%', '個別検索による分析');
}

// ===== ユーティリティ =====
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===== 起動 =====
document.addEventListener('DOMContentLoaded', init);

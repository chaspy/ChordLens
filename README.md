# ChordLens

ChordLens はローカルブラウザで動く、画像からコード進行抽出 + ローカル調性解析アプリです。

## 技術スタック

- React + TypeScript + Vite
- TailwindCSS
- OpenAI互換API（画像→コード抽出のみ）
- 調性推定ロジックは pure TypeScript（ローカル）

## セットアップ

```bash
npm install
cp .env.local.example .env.local
# .env.local に API キーを設定
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

## APIキー

- 必須です。
- 優先順:
1. UI入力欄のキー
2. `.env.local` の `VITE_OPENAI_API_KEY`

## 主な機能

1. 画像アップロード（Drag & Drop対応）
2. LLMでコード抽出（JSON配列）
3. 手動コード編集（抽出前から可能）
4. ローカルのキー推定（24キー総当たり）
5. Top 3候補 + 信頼度 + 内訳表示
6. Circle of Fifths 風の SVG 可視化

## キー推定ロジック（ローカル）

各キーに対して以下を合計してスコア化:

- Diatonic Match Score: +3 / -1
- Ending Resolution Score: I終止 +5, vi終止 +3
- V→I detection: +4
- Accidental penalty: -1

上位3件を返し、上位内で正規化して confidence (0..1) を算出。

## エッジケース

- コード数が3未満: `Not enough harmonic data`
- 平行調で拮抗する場合: `Ambiguous (parallel key)` バッジ表示

## Future Hook

`detectModulation(progression: string[]): ModulationResult[]` を実装用プレースホルダとして定義済み。

## サンプル進行

- `C Am F G`
- `Am F C G`
- `Dm G C Am`
- `C Am Em G`（曖昧になりやすい例）

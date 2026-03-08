# ChordLens

ChordLens は MIDI ファイルから音楽構造を可視化・解析し、構造化 JSON を出力するローカル Web アプリです。

「音楽構造を読むレンズ」として、MIDI から得られるノート列・ピッチ分布・調性候補などの複数レイヤーを 1 つの画面と JSON に統合します。

## 技術スタック

- React + TypeScript + Vite
- TailwindCSS
- @tonejs/midi（MIDI パース）
- Krumhansl-Schmuckler アルゴリズム（調性推定）
- すべてローカルブラウザで完結。サーバー不要。

## セットアップ

```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:4317` を開いてください。

## 使い方

1. `.mid` / `.midi` ファイルをドラッグ＆ドロップ（またはクリックして選択）
2. 自動的に解析が実行され、結果が表示されます
3. JSON をプレビュー表示し、ダウンロード可能

## 主な機能

- **MIDI アップロード**: Drag & Drop 対応
- **MIDI パース**: トラック・ノート・テンポ・拍子を構造化
- **ピアノロール表示**: SVG ベースのノート可視化（トラック色分け、ベロシティ反映）
- **ピッチクラスヒストグラム**: 12 音の分布を棒グラフで表示
- **調性候補推定**: Krumhansl-Schmuckler アルゴリズムで上位 5 キーを表示
- **Circle of Fifths**: 推定キーを五度圏上にマッピング
- **JSON エクスポート**: 構造化された解析結果をダウンロード

## JSON スキーマ概要

出力 JSON は raw data と derived data を分離した構造です:

```json
{
  "meta": {
    "sourceFile": "melody.mid",
    "ticksPerBeat": 480,
    "tempoBpm": 120,
    "timeSignature": "4/4",
    "durationSeconds": 21.46
  },
  "tracks": [
    {
      "id": 0,
      "name": "melody",
      "notes": [
        {
          "pitch": 61,
          "noteName": "C#4",
          "pitchClass": 1,
          "startTick": 480,
          "durationTick": 240,
          "startBeat": 1.0,
          "durationBeat": 0.5,
          "bar": 1,
          "beatInBar": 1.0,
          "velocity": 96,
          "channel": 0
        }
      ]
    }
  ],
  "analysis": {
    "pitchClassHistogram": { "C": 0, "C#": 11, "...": "..." },
    "range": { "lowest": "C#4", "highest": "D#5" },
    "keyCandidates": [
      { "key": "F# major", "score": 0.701 },
      { "key": "A# minor", "score": 0.686 }
    ]
  },
  "summary": {
    "noteCount": 48,
    "trackCount": 1,
    "durationSeconds": 21.46
  }
}
```

### レイヤー構成

| レイヤー | 内容 |
|---------|------|
| `meta` | MIDI ファイルメタデータ（テンポ、拍子、PPQ） |
| `tracks` | トラックごとのノート列（raw data） |
| `analysis` | 派生データ（ヒストグラム、レンジ、キー候補） |
| `summary` | 統計情報 |

## 調性推定アルゴリズム

Krumhansl-Schmuckler アルゴリズムを使用:
- 全ノートのピッチクラス分布を集計
- 12 の major / 12 の minor キープロファイルとのピアソン相関係数を計算
- 相関係数の高い上位 5 キーを候補として表示

## アーキテクチャ

```
src/
├── types/
│   ├── music.ts          # 既存の調性解析型
│   └── midi.ts           # MIDI ドメイン型
├── lib/
│   ├── midiParser.ts     # MIDI パース（@tonejs/midi ラッパー）
│   ├── midiAnalysis.ts   # 解析ロジック（pure functions）
│   ├── keyDetection.ts   # コード進行ベースの調性推定（既存）
│   └── chords.ts         # コード解析ユーティリティ（既存）
├── components/
│   ├── MidiDropzone.tsx   # MIDI ファイル入力
│   ├── PianoRoll.tsx      # ピアノロール表示
│   ├── PitchClassHistogram.tsx  # ピッチクラス分布
│   ├── KeyCandidates.tsx  # 調性候補カード
│   ├── Summary.tsx        # サマリー情報
│   ├── JsonPanel.tsx      # JSON プレビュー & ダウンロード
│   ├── TonalMap.tsx       # 五度圏 SVG（既存）
│   ├── KeyCard.tsx        # キー結果カード（既存）
│   └── ConfidenceBar.tsx  # 信頼度バー（既存）
└── App.tsx               # メインアプリケーション
```

### 設計方針

- UI と解析ロジックを分離（将来の Web Worker 化を想定）
- 解析ロジックは pure function で構成
- raw data と derived data を JSON 上で明確に分離

## 今後の拡張案

- **Chord candidate suggestion**: ノート列からコード候補を自動推定
- **Harmony analysis**: 小節ごとの和声解析
- **AI prompt export**: LLM に渡しやすい中間表現の生成
- **MusicXML / DAW export**: 他ツールとの連携
- **Multi-file comparison**: 複数 MIDI の比較分析
- **Bar-by-bar summary**: 小節ごとのサマリー表示
- **Web Worker**: 大きな MIDI ファイルのバックグラウンド解析

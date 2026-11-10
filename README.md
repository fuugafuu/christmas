# 🎄 Snowletter — みんなのクリスマスツリー

ログイン不要で名前とメッセージを公開のクリスマスツリーに飾れる、日本語のクリスマスサイト。

## 主な機能

- 名前（最大24文字）とメッセージ（最大280文字）を誰でも投稿できます。
- 4種類のカード色、6種類のオーナメントと送信前のライブプレビュー。
- 公開メッセージウォール（新着順・きらめき順・色別・読み込み済みの投稿を検索）。
- 投稿1件につき、同じ送信元から1回の光（イルミネーション）を贈れます。
- 最新投稿をツリーのオーナメントとして表示し、選ぶと該当カードへ移動。
- クリスマスまでの日本時間カウントダウン、雪、柔らかなイルミネーション。
- 共有リンク、迷惑投稿の報告、成功演出、レスポンシブ・アクセシビリティ対応。

## 構成

- index.html — ページ構造
- styles.css — クリスマスデザイン・アニメーション
- app.js — 投稿・表示・リアクション・絞り込み・カウントダウン
- supabase/schema.sql — データベースとサーバー側レート制限
- supabase/functions/christmas-api/index.ts — 公開API
- vercel.json — Web配信設定
- tests/smoke.test.mjs — 自動チェック

## 保存先

フロントエンドはVercelのchristmasプロジェクト、保存APIはSupabase Edge Functionのchristmas-apiです。

API: https://ctteohttbcohzlouaxpo.supabase.co/functions/v1/christmas-api

既存Supabaseプロジェクトbuntyousodateri内のchristmas_*という独立したテーブルだけを利用します。文鳥ゲームのデータとは混ざりません。サーバーの秘密鍵はブラウザに含まれません。

## 投稿の安全対策

- 1送信元あたり60秒間隔・24時間15投稿をサーバー側で制限。
- リンクやメールアドレスなどの宣伝投稿を拒否。
- 投稿テキストはHTMLとして解釈せず、安全に表示。
- 報告は1送信元につき1投稿1回、24時間10回まで。
- 送信元の生IPを保存せず、サーバーでハッシュ化した値のみ記録。
- 名前と投稿内容は全世界に公開されるため、実名・住所・連絡先は投稿しないよう画面で案内。

公開掲示板では荒らしを完全には防げません。報告を定期的に確認してください。

## 管理・通報

Supabase SQL Editorで通報を見る:

    select w.id,w.display_name,w.message,count(r.wish_id) as reports
    from public.christmas_wishes w
    join public.christmas_reports r on r.wish_id=w.id
    group by w.id,w.display_name,w.message
    order by reports desc;

不適切な投稿はSupabaseダッシュボードでis_hidden=trueにすると全体から非表示になります。非表示は復元可能です。

Edge APIには任意の管理エンドポイントもありますが、CHRISTMAS_ADMIN_TOKENをSupabase Edge Function Secretsに設定しない限り無効です。

## テスト

    npm test

HTML・CSS・JavaScript中心の軽量な構成で、ブラウザ側に追加パッケージをインストールしなくても動作します。
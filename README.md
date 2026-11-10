# 🎄 Snowletter — クリスマスメッセージサイト

ログイン不要で、名前とメッセージだけで参加できるクリスマスサイトです。

**公開サイト:** https://christmas-gray-iota.vercel.app/

## ページ

| ページ | 内容 |
| --- | --- |
| [ホーム](/) | 短い案内、最近のメッセージ |
| [投稿する](/write.html) | 名前・メッセージ・カードの色・飾りを選択、プレビュー |
| [みんなの投稿](/messages.html) | 投稿一覧・全件検索・並び替え・光を贈る・共有・通報 |
| [自分の投稿](/mine.html) | 自分の投稿の確認・編集・取り消し、管理コードの保存・復元 |
| [カウントダウン](/countdown.html) | 日本時間で12月25日までの残り日数/時分秒、12月1〜24日のカレンダー、雪のON/OFF |

各ページは独立したHTMLです。旧1ページ構成で使っていた `app.js` と `styles.css` は現在読み込んでいません。現行ページは `site.js` と `site.css` を使います。

## 投稿の取り消しと管理コード

- 投稿時にブラウザで **256-bitのランダムな管理トークン** を生成します。サーバーにはトークンそのものを保存せず、SHA-256ハッシュのみ保存します。
- 自分の投稿一覧から、その投稿だけ編集・取り消しができます。取り消した投稿は公開一覧から消え、元には戻せません。
- 投稿カードの **「管理コード」** を選ぶと `SL2|投稿UUID|トークン` をコピーできます。**他人に見せないでください。**
- 別の端末やブラウザで `自分の投稿 → 管理コードを貼り付け → 読み込む` を選ぶと、サーバーがトークンを検証し、正しい場合のみ編集・取り消し権限を復元します。
- **以前のバージョンからある投稿** は管理トークンを発行していないため、同じ名前を入力しても権限を取得できません。その場合は運営者がSupabaseダッシュボードから非表示にしてください。

## 素材

`assets/` にクリスマス用の軽量なSVG装飾素材を14種類収録しています。アイコン、オーナメント、バッジ、フレーム、雪、ペーパー、背景、ボタンなどを `site.css` から参照しています。SVGファイルはWeb向けの簡略化した図柄であり、**別途生成した高画質PNG/WebPの画像そのものではありません**。

## 技術構成

- **フロントエンド:** バニラHTML/CSS/JavaScript、Vercel
- **保存先:** Supabaseの既存プロジェクト `ctteohttbcohzlouaxpo` 内の `christmas_*` テーブル。文鳥ゲームとは別のテーブルです。
- **API:** `https://ctteohttbcohzlouaxpo.supabase.co/functions/v1/christmas-api`
- **APIソース:** `supabase/functions/christmas-api/index.ts`
- **DBマイグレーション:** `supabase/migrations/20261110120000_christmas_anonymous_ownership.sql`
- **自動テスト:** `npm test`（GitHub Actionsでも実行）

## 安全対策と制約

- 投稿は名前24文字・本文280文字、サーバー側で1分の投稿間隔と24時間15件の上限を適用。
- URLやメールアドレスを含む投稿を拒否。投稿文字列は `textContent` で表示してHTMLとして実行しません。
- 同じ送信元からの「光」は同じ投稿へ1回まで。迷惑投稿の報告機能があります。
- 投稿は公開されます。名前・住所・電話番号・連絡先など個人情報の公開に注意してください。
- 本人確認は管理トークン方式なので、管理コードを紛失し端末データも消すと自力で復元できません。
- 匿名掲示板の荒らしを完全に防ぐ仕組みではありません。運営者による通報確認・非表示対応が必要です。

### 通報内容の確認（管理者）

```sql
select w.id, w.display_name, w.message, count(r.wish_id) as reports
from public.christmas_wishes w
join public.christmas_reports r on r.wish_id = w.id
group by w.id, w.display_name, w.message
order by reports desc;
```

不適切な投稿はSupabaseダッシュボードで `christmas_wishes.is_hidden = true` にすると公開一覧に出なくなります。

## 開発

```bash
npm test
```

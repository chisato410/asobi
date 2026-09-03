const PUBLIC_URL = "https://asobi-nekotyping.vercel.app/";

const WORDS = [
  { label: "マンチカン", reading: "まんちかん", romaji: ["manchikan", "munchkin"], kind: "猫種", wiki: "マンチカン", coat: "calico", fallback: "短い脚で知られる猫種ですが、脚の長さには個体差があります。" },
  { label: "スコティッシュフォールド", reading: "すこてぃっしゅふぉーるど", romaji: ["sukotisshufo-rudo", "sukotisshuforudo", "sukotisshufoorudo", "scottishfold"], kind: "猫種", wiki: "スコティッシュフォールド", coat: "tabby", fallback: "前に折れた耳で知られる、スコットランド原産の猫種です。" },
  { label: "アメリカンショートヘア", reading: "あめりかんしょーとへあ", romaji: ["amerikansho-tohea", "amerikanshotohea", "amerikanshootohea", "americanshorthair"], kind: "猫種", wiki: "アメリカンショートヘア", coat: "tabby", fallback: "しま模様の印象が強い、アメリカ原産の猫種です。" },
  { label: "メインクーン", reading: "めいんくーん", romaji: ["meinku-n", "meinkun", "meinkuun", "mainecoon"], kind: "猫種", wiki: "メインクーン", coat: "tabby", fallback: "大きな体と豊かな長毛が特徴の猫種です。" },
  { label: "ロシアンブルー", reading: "ろしあんぶるー", romaji: ["roshianburu-", "roshianburu", "roshianburuu", "russianblue"], kind: "猫種", wiki: "ロシアンブルー", coat: "black", fallback: "青みがかった灰色の被毛と緑色の目で知られます。" },
  { label: "ラグドール", reading: "らぐどーる", romaji: ["ragudo-ru", "ragudoru", "ragudooru", "ragdoll"], kind: "猫種", wiki: "ラグドール", coat: "point", fallback: "青い目とポイントカラーが印象的な長毛種です。" },
  { label: "ベンガル", reading: "べんがる", romaji: ["bengaru", "bengal"], kind: "猫種", wiki: "ベンガル (ネコ)", coat: "tabby", fallback: "野性的な斑点模様が目を引く猫種です。" },
  { label: "シャム", reading: "しゃむ", romaji: ["shamu", "syamu", "siamese"], kind: "猫種", wiki: "シャム (ネコ)", coat: "point", fallback: "濃いポイントカラーと青い目で知られる猫種です。" },
  { label: "ペルシャ", reading: "ぺるしゃ", romaji: ["perusha", "perusya", "persian"], kind: "猫種", wiki: "ペルシャ (ネコ)", coat: "white", fallback: "長く豊かな被毛と丸みのある顔が特徴です。" },
  { label: "ノルウェージャンフォレストキャット", reading: "のるうぇーじゃんふぉれすときゃっと", romaji: ["noruwe-janforesutokyatto", "noruwejanforesutokyatto", "noruweejanforesutokyatto", "norwegianforestcat"], kind: "猫種", wiki: "ノルウェージャンフォレストキャット", coat: "tabby", fallback: "北欧の寒さに適応した、厚い長毛をもつ大型の猫種です。" },
  { label: "アビシニアン", reading: "あびしにあん", romaji: ["abishinian", "abisinian", "abyssinian"], kind: "猫種", wiki: "アビシニアン", coat: "calico", fallback: "一本の毛に複数の色が入るティッキングが特徴です。" },
  { label: "スフィンクス", reading: "すふぃんくす", romaji: ["sufinkusu", "hufinkusu", "sphynx"], kind: "猫種", wiki: "スフィンクス (ネコ)", coat: "white", fallback: "無毛に見えますが、皮膚には細かな産毛があります。" },
  { label: "ブリティッシュショートヘア", reading: "ぶりてぃっしゅしょーとへあ", romaji: ["buritisshusho-tohea", "buritisshushotohea", "buritisshushootohea", "britishshorthair"], kind: "猫種", wiki: "ブリティッシュショートヘア", coat: "black", fallback: "丸い顔と密度の高い被毛で知られる英国の猫種です。" },
  { label: "アメリカンカール", reading: "あめりかんかーる", romaji: ["amerikanka-ru"], kind: "猫種", wiki: "アメリカンカール", coat: "calico", fallback: "後ろ向きに反り返った耳が特徴の猫種です。" },
  { label: "アメリカンボブテイル", reading: "あめりかんぼぶている", romaji: ["amerikanbobuteiru"], kind: "猫種", wiki: "アメリカンボブテイル", coat: "tabby", fallback: "短い尾とがっしりした体つきが特徴の猫種です。" },
  { label: "エキゾチックショートヘア", reading: "えきぞちっくしょーとへあ", romaji: ["ekizotikkusho-tohea"], kind: "猫種", wiki: "エキゾチックショートヘア", coat: "white", fallback: "ペルシャに似た丸い顔と短い被毛をもつ猫種です。" },
  { label: "エジプシャンマウ", reading: "えじぷしゃんまう", romaji: ["ejipushanmau"], kind: "猫種", wiki: "エジプシャンマウ", coat: "tabby", fallback: "自然に生じた斑点模様で知られる猫種です。" },
  { label: "オシキャット", reading: "おしきゃっと", romaji: ["oshikyatto"], kind: "猫種", wiki: "オシキャット", coat: "tabby", fallback: "野生猫のような斑点をもつ、活発な猫種です。" },
  { label: "オリエンタルショートヘア", reading: "おりえんたるしょーとへあ", romaji: ["orientarusho-tohea"], kind: "猫種", wiki: "オリエンタルショートヘア", coat: "black", fallback: "細身の体と大きな耳が印象的な猫種です。" },
  { label: "コーニッシュレックス", reading: "こーにっしゅれっくす", romaji: ["ko-nisshurekkusu"], kind: "猫種", wiki: "コーニッシュレックス", coat: "calico", fallback: "柔らかく波打つ巻き毛をもつ猫種です。" },
  { label: "デボンレックス", reading: "でぼんれっくす", romaji: ["debonrekkusu"], kind: "猫種", wiki: "デボンレックス", coat: "calico", fallback: "大きな耳と短い巻き毛が特徴の猫種です。" },
  { label: "セルカークレックス", reading: "せるかーくれっくす", romaji: ["seruka-kurekkusu"], kind: "猫種", wiki: "セルカークレックス", coat: "tabby", fallback: "ふんわりとした巻き毛で知られる猫種です。" },
  { label: "サイベリアン", reading: "さいべりあん", romaji: ["saiberian"], kind: "猫種", wiki: "サイベリアン", coat: "tabby", fallback: "ロシアの寒さに適応した豊かな被毛をもつ猫種です。" },
  { label: "シンガプーラ", reading: "しんがぷーら", romaji: ["shingapu-ra"], kind: "猫種", wiki: "シンガプーラ", coat: "calico", fallback: "小柄な体と大きな目で知られる猫種です。" },
  { label: "ソマリ", reading: "そまり", romaji: ["somari"], kind: "猫種", wiki: "ソマリ (猫)", coat: "calico", fallback: "アビシニアンに似た長い被毛と豊かな尾をもちます。" },
  { label: "ターキッシュアンゴラ", reading: "たーきっしゅあんごら", romaji: ["ta-kisshuangora"], kind: "猫種", wiki: "ターキッシュアンゴラ", coat: "white", fallback: "細身の体と絹のような長毛が特徴の猫種です。" },
  { label: "ターキッシュバン", reading: "たーきっしゅばん", romaji: ["ta-kisshuban"], kind: "猫種", wiki: "ターキッシュバン", coat: "white", fallback: "頭と尾に色が入るバン模様で知られる猫種です。" },
  { label: "シャルトリュー", reading: "しゃるとりゅー", romaji: ["sharutoryu-"], kind: "猫種", wiki: "シャルトリュー", coat: "black", fallback: "青灰色の被毛と銅色の目が印象的なフランスの猫種です。" },
  { label: "ジャパニーズボブテイル", reading: "じゃぱにーずぼぶている", romaji: ["japani-zubobuteiru"], kind: "猫種", wiki: "ジャパニーズボブテイル", coat: "calico", fallback: "ぽんぽんのような短い尾をもつ日本ゆかりの猫種です。" },
  { label: "バーマン", reading: "ばーまん", romaji: ["ba-man"], kind: "猫種", wiki: "バーマン", coat: "point", fallback: "青い目と白い手袋のような足先が特徴の猫種です。" },
  { label: "バーミーズ", reading: "ばーみーず", romaji: ["ba-mi-zu"], kind: "猫種", wiki: "バーミーズ", coat: "point", fallback: "光沢のある短毛と丸い目をもつ猫種です。" },
  { label: "ボンベイ", reading: "ぼんべい", romaji: ["bonbei"], kind: "猫種", wiki: "ボンベイ (猫)", coat: "black", fallback: "黒くつややかな被毛から小さな黒豹にも例えられます。" },
  { label: "ヒマラヤン", reading: "ひまらやん", romaji: ["himarayan"], kind: "猫種", wiki: "ヒマラヤン", coat: "point", fallback: "長い被毛とポイントカラー、青い目が特徴です。" },
  { label: "ラパーマ", reading: "らぱーま", romaji: ["rapa-ma"], kind: "猫種", wiki: "ラパーマ", coat: "calico", fallback: "軽やかなカールを描く被毛が特徴の猫種です。" },
  { label: "サバンナ", reading: "さばんな", romaji: ["sabanna"], kind: "猫種", wiki: "サバンナキャット", coat: "tabby", fallback: "長い脚と斑点模様が目を引く猫種です。" },
  { label: "トイガー", reading: "といがー", romaji: ["toiga-"], kind: "猫種", wiki: "トイガー", coat: "tabby", fallback: "トラを思わせる大胆なしま模様を目指して作られた猫種です。" },
  { label: "トンキニーズ", reading: "とんきにーず", romaji: ["tonkini-zu"], kind: "猫種", wiki: "トンキニーズ", coat: "point", fallback: "シャムとバーミーズの特徴を受け継ぐ猫種です。" },
  { label: "バリニーズ", reading: "ばりにーず", romaji: ["barini-zu"], kind: "猫種", wiki: "バリニーズ", coat: "point", fallback: "シャムに似た姿と長く絹のような被毛をもちます。" },
  { label: "バーミラ", reading: "ばーみら", romaji: ["ba-mira"], kind: "猫種", wiki: "バーミラ", coat: "white", fallback: "銀色に見える被毛とやさしい表情が特徴です。" },
  { label: "マンクス", reading: "まんくす", romaji: ["mankusu"], kind: "猫種", wiki: "マンクス", coat: "tabby", fallback: "尾が短い、またはほとんどないことで知られる猫種です。" },
  { label: "キムリック", reading: "きむりっく", romaji: ["kimurikku"], kind: "猫種", wiki: "キムリック", coat: "tabby", fallback: "マンクスの長毛タイプとして知られる猫種です。" },
  { label: "コラット", reading: "こらっと", romaji: ["koratto"], kind: "猫種", wiki: "コラット", coat: "black", fallback: "銀青色の被毛とハート形の顔が特徴のタイ原産種です。" },
  { label: "スノーシュー", reading: "すのーしゅー", romaji: ["suno-shu-"], kind: "猫種", wiki: "スノーシュー", coat: "point", fallback: "白い靴下のような足先とポイントカラーが特徴です。" },
  { label: "ピーターボールド", reading: "ぴーたーぼーるど", romaji: ["pi-ta-bo-rudo"], kind: "猫種", wiki: "ピーターボールド", coat: "white", fallback: "細身の体と毛の少ない皮膚をもつ猫種です。" },
  { label: "ピクシーボブ", reading: "ぴくしーぼぶ", romaji: ["pikushi-bobu"], kind: "猫種", wiki: "ピクシーボブ", coat: "tabby", fallback: "短い尾と野性的な外見が特徴の猫種です。" },
  { label: "ラガマフィン", reading: "らがまふぃん", romaji: ["ragamafin"], kind: "猫種", wiki: "ラガマフィン", coat: "calico", fallback: "大きな体と柔らかな長毛をもつ猫種です。" },
  { label: "ネベロング", reading: "ねべろんぐ", romaji: ["neberongu"], kind: "猫種", wiki: "ネベロング", coat: "black", fallback: "青灰色の長い被毛をもつ、しなやかな猫種です。" },
  { label: "カオマニー", reading: "かおまにー", romaji: ["kaomani-"], kind: "猫種", wiki: "カオマニー", coat: "white", fallback: "白い被毛と宝石のような目で知られるタイの猫種です。" },
  { label: "ソコケ", reading: "そこけ", romaji: ["sokoke"], kind: "猫種", wiki: "ソコケ", coat: "tabby", fallback: "木目のような独特のしま模様をもつ猫種です。" },
  { label: "セレンゲティ", reading: "せれんげてぃ", romaji: ["serengeti"], kind: "猫種", wiki: "セレンゲティ (猫)", coat: "tabby", fallback: "長い脚と斑点模様が印象的な猫種です。" },
  { label: "チャウシー", reading: "ちゃうしー", romaji: ["chaushi-"], kind: "猫種", wiki: "チャウシー", coat: "tabby", fallback: "すらりとした体と大きな耳をもつ活動的な猫種です。" },
  { label: "ハバナブラウン", reading: "はばなぶらうん", romaji: ["habanaburaun"], kind: "猫種", wiki: "ハバナブラウン", coat: "black", fallback: "温かみのある茶色一色の被毛が特徴です。" },
  { label: "アメリカンワイヤーヘア", reading: "あめりかんわいやーへあ", romaji: ["amerikanwaiya-hea"], kind: "猫種", wiki: "アメリカンワイヤーヘア", coat: "tabby", fallback: "一本一本が縮れた弾力のある被毛をもちます。" },
  { label: "ヨーロピアンショートヘア", reading: "よーろぴあんしょーとへあ", romaji: ["yo-ropiansho-tohea"], kind: "猫種", wiki: "ヨーロピアンショートヘア", coat: "tabby", fallback: "ヨーロッパの自然な家猫を基礎とする猫種です。" },
  { label: "ブラジリアンショートヘア", reading: "ぶらじりあんしょーとへあ", romaji: ["burajiriansho-tohea"], kind: "猫種", wiki: "ブラジリアンショートヘア", coat: "calico", fallback: "ブラジルの街猫を起源とする短毛の猫種です。" },
  { label: "ドンスコイ", reading: "どんすこい", romaji: ["donsukoi"], kind: "猫種", wiki: "ドンスコイ", coat: "white", fallback: "毛が少ない、または無毛の姿で知られる猫種です。" },
  { label: "ミヌエット", reading: "みぬえっと", romaji: ["minuetto"], kind: "猫種", wiki: "ミヌエット (猫)", coat: "calico", fallback: "短い脚とふっくらした長毛が特徴の猫種です。" },
  { label: "スクーカム", reading: "すくーかむ", romaji: ["suku-kamu"], kind: "猫種", wiki: "スクーカム", coat: "calico", fallback: "短い脚とカールした被毛をもつ小柄な猫種です。" },
  { label: "オーストラリアンミスト", reading: "おーすとらりあんみすと", romaji: ["o-sutorarianmisuto"], kind: "猫種", wiki: "オーストラリアンミスト", coat: "tabby", fallback: "淡い霧をまとったような斑点模様が特徴です。" },
  { label: "エーゲ猫", reading: "えーげねこ", romaji: ["e-geneko"], kind: "猫種", wiki: "エーゲキャット", coat: "white", fallback: "エーゲ海の島々で育まれたギリシャ原産の猫です。" },
  { label: "三毛猫", reading: "みけねこ", romaji: ["mikeneko"], kind: "毛柄", wiki: "三毛猫", coat: "calico", fallback: "白・黒・茶の三色をもつ猫。多くはメスです。" },
  { label: "サバトラ", reading: "さばとら", romaji: ["sabatora"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "銀灰色の地に黒いしまが入った、魚のサバを思わせる毛柄です。" },
  { label: "キジトラ", reading: "きじとら", romaji: ["kijitora"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "茶褐色の地に黒いしまが入った、日本でよく見られる毛柄です。" },
  { label: "茶トラ", reading: "ちゃとら", romaji: ["chatora", "tyatora", "cyatora"], kind: "毛柄", wiki: "トラネコ", coat: "calico", fallback: "明るい茶色の地に濃い茶色のしまが入った毛柄です。" },
  { label: "ハチワレ", reading: "はちわれ", romaji: ["hachiware"], kind: "毛柄", wiki: "鉢割れ", coat: "black", fallback: "額の色が八の字のように分かれた模様の呼び名です。" },
  { label: "サビ猫", reading: "さびねこ", romaji: ["sabineko"], kind: "毛柄", wiki: "サビ猫", coat: "calico", fallback: "黒と赤茶が細かく混ざり合う、さび色の毛柄です。" },
  { label: "黒猫", reading: "くろねこ", romaji: ["kuroneko"], kind: "毛柄", wiki: "黒猫", coat: "black", fallback: "全身の大部分が黒い毛で覆われた猫の総称です。" },
  { label: "白猫", reading: "しろねこ", romaji: ["shironeko"], kind: "毛柄", wiki: "白猫", coat: "white", fallback: "全身が白い毛で覆われた猫。目の色はさまざまです。" },
  { label: "タキシード猫", reading: "たきしーどねこ", romaji: ["takishi-doneko", "takishidoneko", "takishiidoneko", "tuxedocat"], kind: "毛柄", wiki: "白黒猫", coat: "black", fallback: "黒い上着と白いシャツを着たように見える白黒の毛柄です。" },
  { label: "ポイントカラー", reading: "ぽいんとからー", romaji: ["pointokara-", "pointokara", "pointokaraa", "pointcolor"], kind: "毛柄", wiki: "ポイントカラー", coat: "point", fallback: "耳・顔・足・尾など体の先端の色が濃くなる毛色です。" },
  { label: "黒白猫", reading: "くろしろねこ", romaji: ["kuroshironeko"], kind: "毛柄", wiki: "白黒猫", coat: "black", fallback: "黒と白の被毛が組み合わさった猫の毛柄です。" },
  { label: "茶白猫", reading: "ちゃしろねこ", romaji: ["chashironeko"], kind: "毛柄", wiki: "トラネコ", coat: "calico", fallback: "茶色のしま模様と白い部分をあわせもつ毛柄です。" },
  { label: "キジ白", reading: "きじしろ", romaji: ["kijishiro"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "キジトラ模様に白い胸元や足先が加わった毛柄です。" },
  { label: "サバ白", reading: "さばしろ", romaji: ["sabashiro"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "サバトラ模様と白い部分が組み合わさった毛柄です。" },
  { label: "パステル三毛", reading: "ぱすてるみけ", romaji: ["pasuterumike"], kind: "毛柄", wiki: "三毛猫", coat: "calico", fallback: "灰色や薄茶色が淡く混ざる、やさしい色合いの三毛柄です。" },
  { label: "縞三毛", reading: "しまみけ", romaji: ["shimamike"], kind: "毛柄", wiki: "三毛猫", coat: "calico", fallback: "三毛の色分けにしま模様も加わった毛柄です。" },
  { label: "麦わら猫", reading: "むぎわらねこ", romaji: ["mugiwaraneko"], kind: "毛柄", wiki: "サビ猫", coat: "calico", fallback: "茶系の細かな色が混ざり、麦わらを思わせる毛柄です。" },
  { label: "キジサビ", reading: "きじさび", romaji: ["kijisabi"], kind: "毛柄", wiki: "サビ猫", coat: "calico", fallback: "キジトラのしま模様とサビ柄が重なった毛柄です。" },
  { label: "ブルー", reading: "ぶるー", romaji: ["buru-"], kind: "毛色", wiki: "ネコ#毛色", coat: "black", fallback: "黒色が淡く見える、青みを帯びた灰色の毛色です。" },
  { label: "クリーム", reading: "くりーむ", romaji: ["kuri-mu"], kind: "毛色", wiki: "ネコ#毛色", coat: "calico", fallback: "赤系の色が淡くなった、柔らかな薄橙色の毛色です。" },
  { label: "キャリコ", reading: "きゃりこ", romaji: ["kyariko"], kind: "毛柄", wiki: "三毛猫", coat: "calico", fallback: "英語圏で三毛柄を表すときに使われる呼び名です。" },
  { label: "トーティシェル", reading: "とーてぃしぇる", romaji: ["to-tisheru"], kind: "毛柄", wiki: "サビ猫", coat: "calico", fallback: "黒と赤系の色が混ざる、亀の甲羅を思わせる毛柄です。" },
  { label: "バイカラー", reading: "ばいからー", romaji: ["baikara-"], kind: "毛柄", wiki: "白黒猫", coat: "black", fallback: "白ともう一色の二色で構成される毛柄です。" },
  { label: "ソリッド", reading: "そりっど", romaji: ["soriddo"], kind: "毛柄", wiki: "ネコ#毛色", coat: "black", fallback: "全身がほぼ一色で、模様が目立たない毛柄です。" },
  { label: "クラシックタビー", reading: "くらしっくたびー", romaji: ["kurashikkutabi-"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "体の側面に渦巻きのような太い模様が入るタビーです。" },
  { label: "マッカレルタビー", reading: "まっかれるたびー", romaji: ["makkarerutabi-"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "魚の骨のように細い縦じまが並ぶタビーです。" },
  { label: "スポッテッドタビー", reading: "すぽってっどたびー", romaji: ["supotteddotabi-"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "しまが途切れて斑点のように見えるタビーです。" },
  { label: "ティックドタビー", reading: "てぃっくどたびー", romaji: ["tikkudotabi-"], kind: "毛柄", wiki: "トラネコ", coat: "tabby", fallback: "一本の毛に濃淡が入り、細かな模様に見えるタビーです。" },
  { label: "スモーク", reading: "すもーく", romaji: ["sumo-ku"], kind: "毛色", wiki: "ネコ#毛色", coat: "black", fallback: "毛先は濃く、毛の根元が白く見える毛色です。" },
  { label: "チンチラ", reading: "ちんちら", romaji: ["chinchira"], kind: "毛色", wiki: "チンチラ (ネコ)", coat: "white", fallback: "毛先だけに色が入り、きらめくように見える毛色です。" },
  { label: "肉球", reading: "にくきゅう", romaji: ["nikukyu", "nikukyuu"], kind: "猫のからだ", wiki: "肉球", coat: "calico", fallback: "足裏にある柔らかな部分。歩行時の衝撃や音をやわらげます。" },
  { label: "ひげ", reading: "ひげ", romaji: ["hige"], kind: "猫のからだ", wiki: "洞毛", coat: "white", fallback: "猫のひげは周囲のものや空気の流れを感じる感覚器です。" },
  { label: "しっぽ", reading: "しっぽ", romaji: ["shippo", "sippo"], kind: "猫のからだ", wiki: "尾", coat: "tabby", fallback: "バランスをとるほか、気持ちを表すのにも使われます。" },
  { label: "猫耳", reading: "ねこみみ", romaji: ["nekomimi"], kind: "猫のからだ", wiki: "耳", coat: "tabby", fallback: "猫の耳は広い範囲へ動き、小さな音の方向も探れます。" },
  { label: "瞳孔", reading: "どうこう", romaji: ["doukou"], kind: "猫のからだ", wiki: "瞳孔", coat: "black", fallback: "明るい場所では細く、暗い場所では丸く大きく開きます。" },
  { label: "タペタム", reading: "たぺたむ", romaji: ["tapetamu"], kind: "猫のからだ", wiki: "輝板", coat: "point", fallback: "目の奥で光を反射し、暗い場所で見る力を助ける層です。" },
  { label: "舌", reading: "した", romaji: ["shita"], kind: "猫のからだ", wiki: "舌", coat: "calico", fallback: "食事や水飲み、毛づくろいに活躍する器官です。" },
  { label: "ざらざら舌", reading: "ざらざらじた", romaji: ["zarazarajita"], kind: "猫のからだ", wiki: "ネコ#舌", coat: "calico", fallback: "猫の舌には小さな突起が並び、ブラシのような役割をします。" },
  { label: "鉤爪", reading: "かぎづめ", romaji: ["kagidume", "kagizume"], kind: "猫のからだ", wiki: "鉤爪", coat: "tabby", fallback: "普段はしまっておき、必要なときに出せる曲がった爪です。" },
  { label: "被毛", reading: "ひもう", romaji: ["himou"], kind: "猫のからだ", wiki: "毛 (動物)", coat: "white", fallback: "体を覆い、温度や皮膚を守る猫の毛です。" },
  { label: "アンダーコート", reading: "あんだーこーと", romaji: ["anda-ko-to"], kind: "猫のからだ", wiki: "毛 (動物)", coat: "white", fallback: "外側の毛の下に生える、細く柔らかな下毛です。" },
  { label: "マズル", reading: "まずる", romaji: ["mazuru"], kind: "猫のからだ", wiki: "口吻", coat: "calico", fallback: "鼻と口のまわりにある、少しふくらんだ部分です。" },
  { label: "ウィスカーパッド", reading: "うぃすかーぱっど", romaji: ["wisuka-paddo"], kind: "猫のからだ", wiki: "ネコ#感覚器", coat: "white", fallback: "ひげの根元にある、ふっくらとした頬の部分です。" },
  { label: "香箱座り", reading: "こうばこずわり", romaji: ["kobakozuwari", "koubakozuwari"], kind: "猫のしぐさ", wiki: "香箱座り", coat: "calico", fallback: "前足と後ろ足を体の下に折りたたんで座る姿です。" },
  { label: "へそ天", reading: "へそてん", romaji: ["hesoten"], kind: "猫のしぐさ", wiki: "ヘソ天", coat: "white", fallback: "お腹を上に向けて、仰向けに寝転がる姿の呼び名です。" },
  { label: "猫パンチ", reading: "ねこぱんち", romaji: ["nekopanchi", "nekopanti"], kind: "猫のしぐさ", wiki: "猫パンチ", coat: "calico", fallback: "前足を素早く繰り出す猫の動き。爪を出さないこともあります。" },
  { label: "ゴロゴロ", reading: "ごろごろ", romaji: ["gorogoro"], kind: "猫のしぐさ", wiki: "ネコ#喉鳴らし", coat: "tabby", fallback: "くつろいでいるときなどに聞こえる、低い喉鳴らしの音です。" },
  { label: "ふみふみ", reading: "ふみふみ", romaji: ["fumifumi", "humihumi"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "point", fallback: "前足を交互に押しつけるように動かすしぐさです。" },
  { label: "毛づくろい", reading: "けづくろい", romaji: ["kedukuroi", "kezukuroi"], kind: "猫のしぐさ", wiki: "グルーミング", coat: "calico", fallback: "舌を使って被毛を整え、清潔に保つ行動です。" },
  { label: "爪とぎ", reading: "つめとぎ", romaji: ["tsumetogi"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "tabby", fallback: "爪の手入れや目印のために、物の表面を引っかく行動です。" },
  { label: "頭突き", reading: "ずつき", romaji: ["zutsuki"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "black", fallback: "頭や額をこつんと寄せて、親しみを表すしぐさです。" },
  { label: "すりすり", reading: "すりすり", romaji: ["surisuri"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "calico", fallback: "頬や体を人や物にこすりつけるしぐさです。" },
  { label: "しっぽを立てる", reading: "しっぽをたてる", romaji: ["shippowotateru"], kind: "猫のしぐさ", wiki: "ネコ#尾", coat: "tabby", fallback: "親しい相手へのあいさつなどで見られるしっぽの動きです。" },
  { label: "イカ耳", reading: "いかみみ", romaji: ["ikamimi"], kind: "猫のしぐさ", wiki: "ネコ#耳", coat: "black", fallback: "耳を横や後ろへ倒し、いかの形のように見える状態です。" },
  { label: "クラッキング", reading: "くらっきんぐ", romaji: ["kurakkingu"], kind: "猫のしぐさ", wiki: "ネコ#鳴き声", coat: "tabby", fallback: "獲物を見つけたときなどに歯を細かく鳴らす行動です。" },
  { label: "ニャー", reading: "にゃー", romaji: ["nya-"], kind: "猫のことば", wiki: "ネコ#鳴き声", coat: "calico", fallback: "猫が人とのやり取りなどで使う代表的な鳴き声です。" },
  { label: "あくび", reading: "あくび", romaji: ["akubi"], kind: "猫のしぐさ", wiki: "欠伸", coat: "white", fallback: "口を大きく開ける、眠いときやくつろいだときのしぐさです。" },
  { label: "猫キック", reading: "ねこきっく", romaji: ["nekokikku"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "calico", fallback: "抱えた相手を後ろ足で素早く蹴るような動きです。" },
  { label: "箱入り猫", reading: "はこいりねこ", romaji: ["hakoirineko"], kind: "猫のしぐさ", wiki: "ネコ#習性", coat: "tabby", fallback: "箱を見つけると、すっぽり中へ入りたがる猫の姿です。" },
  { label: "アンモニャイト", reading: "あんもにゃいと", romaji: ["anmonyaito"], kind: "猫のしぐさ", wiki: "ネコ#睡眠", coat: "calico", fallback: "体を丸くして眠る、アンモナイトのような猫の姿です。" },
];

const elements = {
  machine: document.querySelector("#typeMachine"),
  time: document.querySelector("#timeValue"),
  score: document.querySelector("#scoreValue"),
  paws: document.querySelector("#pawValue"),
  kind: document.querySelector("#wordKind"),
  japanese: document.querySelector("#japaneseWord"),
  reading: document.querySelector("#reading"),
  romaji: document.querySelector("#romaji"),
  swatch: document.querySelector("#coatSwatch"),
  progress: document.querySelector("#tailProgress"),
  start: document.querySelector("#startButton"),
  startLabel: document.querySelector("#startLabel"),
  sound: document.querySelector("#soundButton"),
  soundLabel: document.querySelector("#soundLabel"),
  volume: document.querySelector("#volumeControl"),
  volumeValue: document.querySelector("#volumeValue"),
  trail: [...document.querySelectorAll("#pawTrail img")],
  levelPicker: document.querySelector("#levelPicker"),
  levelInputs: [...document.querySelectorAll('input[name="level"]')],
  memoCount: document.querySelector("#memoCount"),
  noteList: document.querySelector("#noteList"),
  noteEmpty: document.querySelector("#noteEmpty"),
  dialog: document.querySelector("#resultDialog"),
  resultKicker: document.querySelector("#resultKicker"),
  resultPaws: document.querySelector("#resultPaws"),
  resultScore: document.querySelector("#resultScore"),
  resultAccuracy: document.querySelector("#resultAccuracy"),
  resultCombo: document.querySelector("#resultCombo"),
  shareImage: document.querySelector("#shareImageButton"),
  shareLink: document.querySelector("#shareLinkButton"),
  shareStatus: document.querySelector("#shareStatus"),
  retry: document.querySelector("#retryButton"),
  close: document.querySelector("#closeButton"),
};

let state = {
  playing: false,
  duration: 60,
  score: 0,
  paws: 0,
  combo: 0,
  bestCombo: 0,
  correctKeys: 0,
  totalKeys: 0,
  missStreak: 0,
  typed: "",
  candidates: [],
  target: "",
  word: null,
  timerId: null,
  endAt: 0,
  lastWord: null,
  wordDeck: [],
  memoTotal: 0,
  graceKeys: new Set(),
  graceUntil: 0,
};

let soundOn = true;
let masterVolume = .7;
let audioContext = null;
const wikiCache = new Map();
const soundEffects = {
  wordComplete: new Audio("./assets/seikai.mp3"),
  mistake: new Audio("./assets/machigai.mp3"),
  result: new Audio("./assets/end.mp3"),
};
const shareArt = new Image();
Object.values(soundEffects).forEach((sound) => {
  sound.preload = "auto";
  sound.volume = masterVolume;
});

function getAudioContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioContext = new AudioContext();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
  return audioContext;
}

function shuffledWords() {
  const deck = [...WORDS];
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  const nextIndex = deck.length - 1;
  if (deck[nextIndex] === state.lastWord && nextIndex > 0) {
    const swapIndex = Math.floor(Math.random() * nextIndex);
    [deck[nextIndex], deck[swapIndex]] = [deck[swapIndex], deck[nextIndex]];
  }
  return deck;
}

function pickWord() {
  if (!state.wordDeck.length) state.wordDeck = shuffledWords();
  return state.wordDeck.pop();
}

function showWord(word) {
  state.word = word;
  state.lastWord = word;
  state.typed = "";
  state.candidates = NekoTyping.expandRomajiVariants(word.romaji);
  state.target = word.romaji[0];
  elements.kind.textContent = word.kind;
  elements.japanese.textContent = word.label;
  elements.reading.textContent = word.reading;
  elements.swatch.className = `coat-swatch ${word.coat || ""}`;
  renderProgress();
}

function renderProgress() {
  const remaining = state.target.slice(state.typed.length);
  elements.romaji.innerHTML = `<span class="typed">${state.typed}</span><span class="remaining">${remaining}</span>`;
  elements.progress.style.width = `${state.target.length ? (state.typed.length / state.target.length) * 100 : 0}%`;
}

function playTone(correct = true) {
  if (!soundOn || masterVolume <= 0) return;
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = correct ? "sine" : "square";
  oscillator.frequency.value = correct ? 540 + (state.typed.length % 5) * 45 : 120;
  gain.gain.setValueAtTime((correct ? .025 : .035) * masterVolume, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + (correct ? .055 : .09));
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + .1);
}

function playEffect(name) {
  if (!soundOn || masterVolume <= 0) return;
  const sound = soundEffects[name];
  if (!sound) return;
  sound.pause();
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function currentAccuracy() {
  return state.totalKeys ? Math.round((state.correctKeys / state.totalKeys) * 100) : 100;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function canvasToFile(canvas, filename) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (file) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(file);
    };
    const timeoutId = window.setTimeout(() => finish(null), 3000);
    try {
      canvas.toBlob((blob) => {
        finish(blob ? new File([blob], filename, { type: "image/png" }) : null);
      }, "image/png");
    } catch {
      finish(null);
    }
  });
}

async function createShareCard() {
  if (!shareArt.complete || !shareArt.naturalWidth || typeof File === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(shareArt, 0, 0, canvas.width, canvas.height);
  drawRoundedRect(context, 58, 54, 490, 522, 34);
  context.fillStyle = "rgba(255, 248, 234, .92)";
  context.fill();
  context.strokeStyle = "rgba(48, 40, 31, .72)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "#30281f";
  context.font = '800 31px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText("asobi  ねこタイプ", 105, 118);
  context.fillStyle = "#a86c49";
  context.font = '700 22px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText(`${state.duration}秒のきろく`, 105, 175);

  context.fillStyle = "#e88724";
  context.font = '800 76px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText(`${state.paws}こ`, 98, 283);
  context.fillStyle = "#30281f";
  context.font = '800 34px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText("肉球をあつめました。", 104, 338);

  context.fillStyle = "#f2bd32";
  drawRoundedRect(context, 96, 379, 414, 68, 18);
  context.fill();
  context.strokeStyle = "#30281f";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#30281f";
  context.font = '800 24px "M PLUS Rounded 1c", "Hiragino Sans", sans-serif';
  context.fillText(`スコア  ${state.score.toLocaleString("ja-JP")}`, 125, 422);

  context.fillStyle = "#65594e";
  context.font = '700 20px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText(`正確さ ${currentAccuracy()}%　最高コンボ ${state.bestCombo}`, 104, 493);
  context.fillStyle = "#a86c49";
  context.font = '700 18px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif';
  context.fillText("#ねこタイプ", 104, 536);

  return canvasToFile(canvas, "neko-type-result.png");
}

function resultShareText(includeUrl = false) {
  let text =
    `ねこタイプで${state.paws}この肉球を集めました。\n` +
    `スコア ${state.score.toLocaleString("ja-JP")} / 正確さ ${currentAccuracy()}% / 最高コンボ ${state.bestCombo}`;
  if (includeUrl) text += `\n\n${PUBLIC_URL}`;
  text += "\n\n#ねこタイプ";
  return text;
}

function openXShare() {
  const params = new URLSearchParams({ text: resultShareText(), url: PUBLIC_URL });
  window.location.assign(`https://twitter.com/intent/tweet?${params.toString()}`);
}

function setShareStatus(message) {
  elements.shareStatus.textContent = message;
}

async function copyImageToClipboard(file) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    const timeout = new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("Clipboard timeout")), 2500);
    });
    await Promise.race([
      navigator.clipboard.write([new ClipboardItem({ "image/png": file })]),
      timeout,
    ]);
    return true;
  } catch {
    return false;
  }
}

function supportsFileShareEnvironment() {
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return isMobileDevice && Boolean(navigator.share) && Boolean(navigator.canShare);
}

function pasteShortcutLabel() {
  return /Macintosh|Mac OS X/i.test(navigator.userAgent) ? "⌘V" : "Ctrl+V";
}

function supportsNativeFileShare(file) {
  if (!supportsFileShareEnvironment()) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadShareImage(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadFallbackShareImage() {
  const link = document.createElement("a");
  link.href = "./og-image.png";
  link.download = "neko-type-result.png";
  document.body.append(link);
  link.click();
  link.remove();
}

async function shareResultImage() {
  elements.shareImage.disabled = true;
  setShareStatus("共有画像を作っています…");
  try {
    const file = await createShareCard();
    if (!file) {
      downloadFallbackShareImage();
      setShareStatus("OGP画像を保存しました。Xの投稿に添付してください。");
      window.setTimeout(openXShare, 650);
      return;
    }

    const shareData = { title: "ねこタイプ", text: resultShareText(true), files: [file] };
    if (supportsNativeFileShare(file)) {
      await navigator.share(shareData);
      setShareStatus("共有しました。");
      return;
    }

    const copied = await copyImageToClipboard(file);
    if (copied) {
      setShareStatus(`画像をコピーしました。Xの投稿欄で${pasteShortcutLabel()}を押して貼り付けてください。`);
    } else {
      downloadShareImage(file);
      setShareStatus("画像を保存しました。Xの投稿に添付してください。");
    }
    window.setTimeout(openXShare, 650);
  } catch (error) {
    if (error?.name === "AbortError") {
      setShareStatus("共有をキャンセルしました。");
    } else {
      downloadFallbackShareImage();
      setShareStatus("OGP画像を保存しました。Xの投稿に添付してください。");
      window.setTimeout(openXShare, 650);
    }
  } finally {
    elements.shareImage.disabled = false;
  }
}

function prepareShareArt() {
  shareArt.addEventListener("load", () => {
    elements.shareImage.disabled = false;
    setShareStatus(supportsFileShareEnvironment()
      ? "共有先でXを選ぶだけです。"
      : `画像をコピーしてXの投稿画面を開きます。Xでは自動で貼られないので、投稿欄で${pasteShortcutLabel()}を押してください。`);
  }, { once: true });
  shareArt.addEventListener("error", () => {
    setShareStatus("共有画像を読み込めませんでした。再読み込みしてください。");
  }, { once: true });
  shareArt.src = "./og-art.png";
}

function flashPaw() {
  const paw = elements.trail[(state.paws - 1) % elements.trail.length];
  paw.classList.remove("is-lit");
  void paw.offsetWidth;
  paw.classList.add("is-lit");
}

function articleUrl(word) {
  const [title, fragment] = word.wiki.split("#");
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}${fragment ? `#${encodeURIComponent(fragment)}` : ""}`;
}

function addMemo(word) {
  elements.noteEmpty.hidden = true;
  state.memoTotal += 1;
  elements.memoCount.textContent = `${state.memoTotal}枚`;

  const entry = document.createElement("article");
  entry.className = "note-entry is-loading";
  entry.innerHTML = `
    <header><h3></h3><small></small></header>
    <p>Wikipediaを読んでいます…</p>
    <a target="_blank" rel="noreferrer">Wikipediaで読む</a>
  `;
  entry.querySelector("h3").textContent = word.label;
  entry.querySelector("small").textContent = word.kind;
  entry.querySelector("a").href = articleUrl(word);
  elements.noteList.prepend(entry);
  loadWikiNote(word, entry);
}

async function loadWikiNote(word, entry) {
  const copy = entry.querySelector("p");
  if (wikiCache.has(word.wiki)) {
    copy.textContent = wikiCache.get(word.wiki);
    entry.classList.remove("is-loading");
    return;
  }

  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    exsentences: "2",
    redirects: "1",
    titles: word.wiki.split("#")[0],
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`https://ja.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) throw new Error("Wikipedia request failed");
    const data = await response.json();
    const page = Object.values(data.query?.pages || {})[0];
    const text = page?.extract?.trim() || word.fallback;
    wikiCache.set(word.wiki, text);
    copy.textContent = text;
  } catch {
    wikiCache.set(word.wiki, word.fallback);
    copy.textContent = word.fallback;
  } finally {
    entry.classList.remove("is-loading");
  }
}

function completeWord(graceKeys = []) {
  const finished = state.word;
  const typedLength = state.typed.length;
  state.paws += 1;
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.score += typedLength * 10 + Math.min(state.combo, 20) * 5;
  state.graceKeys = new Set(graceKeys);
  state.graceUntil = performance.now() + 420;
  elements.paws.textContent = state.paws;
  elements.score.textContent = state.score;
  elements.machine.classList.remove("is-correct");
  void elements.machine.offsetWidth;
  elements.machine.classList.add("is-correct");
  flashPaw();
  playEffect("wordComplete");
  addMemo(finished);
  showWord(pickWord());
}

function handleKey(event) {
  if (!state.playing || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
  const key = event.key.toLowerCase();
  if (!/^[a-z-]$/.test(key)) return;
  event.preventDefault();

  if (performance.now() < state.graceUntil && state.graceKeys.has(key)) {
    state.totalKeys += 1;
    state.correctKeys += 1;
    state.graceKeys.delete(key);
    playTone(true);
    return;
  }

  state.totalKeys += 1;
  const result = NekoTyping.matchRomaji(state.candidates, state.typed, key);
  if (result.accepted) {
    state.correctKeys += 1;
    state.missStreak = 0;
    state.typed = result.typed;
    state.candidates = result.candidates;
    if (!state.candidates.includes(state.target)) {
      state.target = NekoTyping.chooseDisplayTarget(state.candidates, state.target);
    }
    renderProgress();
    if (result.complete) completeWord(result.graceKeys);
    else playTone(true);
  } else {
    state.combo = 0;
    state.missStreak += 1;
    if (state.missStreak >= 3) {
      playEffect("mistake");
      state.missStreak = 0;
    }
    elements.machine.classList.remove("is-error");
    void elements.machine.offsetWidth;
    elements.machine.classList.add("is-error");
  }
}

function updateTimer() {
  const remaining = Math.max(0, state.endAt - performance.now());
  elements.time.textContent = (remaining / 1000).toFixed(1);
  if (remaining <= 0) endGame();
}

function selectedDuration() {
  return Number(elements.levelInputs.find((input) => input.checked)?.value || 60);
}

function syncLevel() {
  state.duration = selectedDuration();
  elements.time.textContent = state.duration.toFixed(1);
  elements.startLabel.textContent = `${state.duration}秒ではじめる`;
}

function startGame() {
  window.clearInterval(state.timerId);
  getAudioContext();
  state = {
    ...state,
    playing: true,
    duration: selectedDuration(),
    score: 0,
    paws: 0,
    combo: 0,
    bestCombo: 0,
    correctKeys: 0,
    totalKeys: 0,
    missStreak: 0,
    typed: "",
    candidates: [],
    wordDeck: [],
    graceKeys: new Set(),
    graceUntil: 0,
    endAt: performance.now() + selectedDuration() * 1000,
  };
  elements.score.textContent = "0";
  elements.paws.textContent = "0";
  elements.time.textContent = state.duration.toFixed(1);
  elements.levelPicker.disabled = true;
  elements.machine.classList.add("is-playing");
  showWord(pickWord());
  state.timerId = window.setInterval(updateTimer, 50);
}

function endGame() {
  if (!state.playing) return;
  state.playing = false;
  window.clearInterval(state.timerId);
  state.timerId = null;
  elements.time.textContent = "0.0";
  elements.machine.classList.remove("is-playing");
  elements.levelPicker.disabled = false;
  elements.startLabel.textContent = `${state.duration}秒でもう一度`;
  const accuracy = currentAccuracy();
  elements.resultKicker.textContent = `${state.duration}秒、おつかれさまでした`;
  elements.resultPaws.textContent = state.paws;
  elements.resultScore.textContent = state.score;
  elements.resultAccuracy.textContent = `${accuracy}%`;
  elements.resultCombo.textContent = state.bestCombo;
  playEffect("result");
  elements.dialog.showModal();
}

elements.start.addEventListener("click", startGame);
elements.shareImage.addEventListener("click", shareResultImage);
elements.shareLink.addEventListener("click", openXShare);
elements.retry.addEventListener("click", () => {
  elements.dialog.close();
  startGame();
});
elements.close.addEventListener("click", () => elements.dialog.close());
elements.sound.addEventListener("click", () => {
  soundOn = !soundOn;
  if (!soundOn) {
    Object.values(soundEffects).forEach((sound) => {
      sound.pause();
      sound.currentTime = 0;
    });
  }
  elements.sound.setAttribute("aria-pressed", String(soundOn));
  elements.soundLabel.textContent = soundOn ? "音あり" : "音なし";
});
elements.volume.addEventListener("input", () => {
  masterVolume = Number(elements.volume.value) / 100;
  Object.values(soundEffects).forEach((sound) => {
    sound.volume = masterVolume;
  });
  const percentage = `${elements.volume.value}%`;
  elements.volumeValue.textContent = percentage;
  elements.volume.setAttribute("aria-valuetext", percentage);
  elements.volume.style.setProperty("--volume-fill", percentage);
});
elements.levelInputs.forEach((input) => input.addEventListener("change", syncLevel));
document.addEventListener("keydown", (event) => {
  if (state.playing) handleKey(event);
  else if (event.key === "Enter" && !elements.dialog.open) startGame();
});
elements.dialog.addEventListener("cancel", () => elements.dialog.close());

prepareShareArt();
elements.volume.dispatchEvent(new Event("input"));
syncLevel();

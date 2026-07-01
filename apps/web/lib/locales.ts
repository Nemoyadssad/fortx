// Lightweight i18n for the app chrome (navigation + common controls).
// Page bodies fall back to English; this can be extended key-by-key.

export type Lang = { code: string; name: string; flag: string };

export const LANGS: Lang[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export const KEYS = [
  'nav.markets', 'nav.games', 'nav.leaderboard', 'nav.calendar',
  'nav.daily', 'nav.cases', 'nav.wheel', 'nav.vip', 'nav.invite',
  'nav.cashier', 'nav.profile', 'nav.mybets', 'nav.admin',
  'nav.help', 'nav.how', 'nav.terms', 'nav.responsible',
  'group.play', 'group.rewards', 'group.account', 'group.help',
  'common.signin', 'common.search', 'common.language',
] as const;

// Values are in the same order as KEYS.
const ROWS: Record<string, string[]> = {
  en: ['Markets', 'Games', 'Leaderboard', 'Calendar', 'Daily rewards', 'Mystery Cases', 'Daily wheel', 'VIP Club', 'Invite & earn 50%', 'Cashier', 'Profile', 'My bets', 'Admin', 'Help center', 'How it works', 'Terms of Use', 'Responsible Gaming', 'Play', 'Rewards', 'Account', 'Help', 'Sign in', 'Search markets…', 'Language'],
  es: ['Mercados', 'Juegos', 'Clasificación', 'Calendario', 'Recompensas diarias', 'Cajas misteriosas', 'Rueda diaria', 'Club VIP', 'Invita y gana 50%', 'Cajero', 'Perfil', 'Mis apuestas', 'Admin', 'Centro de ayuda', 'Cómo funciona', 'Términos de uso', 'Juego responsable', 'Jugar', 'Recompensas', 'Cuenta', 'Ayuda', 'Iniciar sesión', 'Buscar mercados…', 'Idioma'],
  pt: ['Mercados', 'Jogos', 'Classificação', 'Calendário', 'Recompensas diárias', 'Caixas misteriosas', 'Roleta diária', 'Clube VIP', 'Convide e ganhe 50%', 'Caixa', 'Perfil', 'Minhas apostas', 'Admin', 'Central de ajuda', 'Como funciona', 'Termos de uso', 'Jogo responsável', 'Jogar', 'Recompensas', 'Conta', 'Ajuda', 'Entrar', 'Buscar mercados…', 'Idioma'],
  fr: ['Marchés', 'Jeux', 'Classement', 'Calendrier', 'Récompenses quotidiennes', 'Coffres mystères', 'Roue quotidienne', 'Club VIP', 'Invitez et gagnez 50%', 'Caisse', 'Profil', 'Mes paris', 'Admin', "Centre d'aide", 'Comment ça marche', "Conditions d'utilisation", 'Jeu responsable', 'Jouer', 'Récompenses', 'Compte', 'Aide', 'Se connecter', 'Rechercher des marchés…', 'Langue'],
  de: ['Märkte', 'Spiele', 'Bestenliste', 'Kalender', 'Tägliche Belohnungen', 'Mystery-Boxen', 'Tägliches Rad', 'VIP-Club', 'Einladen & 50% verdienen', 'Kasse', 'Profil', 'Meine Wetten', 'Admin', 'Hilfecenter', "So funktioniert's", 'Nutzungsbedingungen', 'Verantwortungsvolles Spielen', 'Spielen', 'Belohnungen', 'Konto', 'Hilfe', 'Anmelden', 'Märkte suchen…', 'Sprache'],
  it: ['Mercati', 'Giochi', 'Classifica', 'Calendario', 'Premi giornalieri', 'Casse misteriose', 'Ruota giornaliera', 'Club VIP', 'Invita e guadagna 50%', 'Cassa', 'Profilo', 'Le mie scommesse', 'Admin', 'Centro assistenza', 'Come funziona', "Termini d'uso", 'Gioco responsabile', 'Gioca', 'Premi', 'Account', 'Aiuto', 'Accedi', 'Cerca mercati…', 'Lingua'],
  ru: ['Рынки', 'Игры', 'Лидеры', 'Календарь', 'Ежедневные награды', 'Кейсы', 'Колесо дня', 'VIP-клуб', 'Пригласить · 50%', 'Касса', 'Профиль', 'Мои ставки', 'Админ', 'Центр помощи', 'Как это работает', 'Условия', 'Ответственная игра', 'Играть', 'Награды', 'Аккаунт', 'Помощь', 'Войти', 'Поиск рынков…', 'Язык'],
  uk: ['Ринки', 'Ігри', 'Лідери', 'Календар', 'Щоденні нагороди', 'Кейси', 'Щоденне колесо', 'VIP-клуб', 'Запросити · 50%', 'Каса', 'Профіль', 'Мої ставки', 'Адмін', 'Довідковий центр', 'Як це працює', 'Умови', 'Відповідальна гра', 'Грати', 'Нагороди', 'Акаунт', 'Допомога', 'Увійти', 'Пошук ринків…', 'Мова'],
  pl: ['Rynki', 'Gry', 'Ranking', 'Kalendarz', 'Codzienne nagrody', 'Skrzynie', 'Koło dnia', 'Klub VIP', 'Zaproś i zarób 50%', 'Kasa', 'Profil', 'Moje zakłady', 'Admin', 'Centrum pomocy', 'Jak to działa', 'Regulamin', 'Odpowiedzialna gra', 'Graj', 'Nagrody', 'Konto', 'Pomoc', 'Zaloguj się', 'Szukaj rynków…', 'Język'],
  tr: ['Piyasalar', 'Oyunlar', 'Lider tablosu', 'Takvim', 'Günlük ödüller', 'Gizemli kasalar', 'Günlük çark', 'VIP Kulüp', 'Davet et & %50 kazan', 'Kasa', 'Profil', 'Bahislerim', 'Yönetici', 'Yardım merkezi', 'Nasıl çalışır', 'Kullanım şartları', 'Sorumlu oyun', 'Oyna', 'Ödüller', 'Hesap', 'Yardım', 'Giriş yap', 'Piyasa ara…', 'Dil'],
  vi: ['Thị trường', 'Trò chơi', 'Bảng xếp hạng', 'Lịch', 'Phần thưởng hằng ngày', 'Hộp bí ẩn', 'Vòng quay hằng ngày', 'Câu lạc bộ VIP', 'Mời & kiếm 50%', 'Quầy', 'Hồ sơ', 'Cược của tôi', 'Quản trị', 'Trung tâm trợ giúp', 'Cách hoạt động', 'Điều khoản', 'Chơi có trách nhiệm', 'Chơi', 'Phần thưởng', 'Tài khoản', 'Trợ giúp', 'Đăng nhập', 'Tìm thị trường…', 'Ngôn ngữ'],
  id: ['Pasar', 'Game', 'Papan peringkat', 'Kalender', 'Hadiah harian', 'Kotak misteri', 'Roda harian', 'Klub VIP', 'Undang & dapat 50%', 'Kasir', 'Profil', 'Taruhan saya', 'Admin', 'Pusat bantuan', 'Cara kerja', 'Ketentuan', 'Bermain bertanggung jawab', 'Main', 'Hadiah', 'Akun', 'Bantuan', 'Masuk', 'Cari pasar…', 'Bahasa'],
  zh: ['市场', '游戏', '排行榜', '日历', '每日奖励', '神秘宝箱', '每日转盘', 'VIP 俱乐部', '邀请赚 50%', '收银台', '个人资料', '我的下注', '管理', '帮助中心', '玩法说明', '使用条款', '理性游戏', '游戏', '奖励', '账户', '帮助', '登录', '搜索市场…', '语言'],
  ja: ['マーケット', 'ゲーム', 'ランキング', 'カレンダー', 'デイリー報酬', 'ミステリーケース', 'デイリーホイール', 'VIPクラブ', '招待して50%獲得', 'キャッシャー', 'プロフィール', 'マイベット', '管理', 'ヘルプセンター', '使い方', '利用規約', '責任あるゲーム', 'プレイ', '報酬', 'アカウント', 'ヘルプ', 'ログイン', 'マーケットを検索…', '言語'],
  ko: ['마켓', '게임', '리더보드', '캘린더', '일일 보상', '미스터리 박스', '일일 룰렛', 'VIP 클럽', '초대하고 50% 받기', '캐셔', '프로필', '내 베팅', '관리자', '도움말 센터', '이용 방법', '이용약관', '책임 게임', '플레이', '보상', '계정', '도움말', '로그인', '마켓 검색…', '언어'],
};

export const STRINGS: Record<string, Record<string, string>> = {};
for (const [code, vals] of Object.entries(ROWS)) {
  const map: Record<string, string> = {};
  KEYS.forEach((k, i) => { map[k] = vals[i] ?? k; });
  STRINGS[code] = map;
}

// ---------------------------------------------------------------------------
// Extra strings (page titles, taglines, common buttons). Partial languages are
// fine — anything missing falls back to English automatically.
// ---------------------------------------------------------------------------
const EXTRA: Record<string, Record<string, string>> = {
  'help.title': { en: 'How can we help?', es: '¿Cómo podemos ayudarte?', pt: 'Como podemos ajudar?', fr: 'Comment pouvons-nous aider ?', de: 'Wie können wir helfen?', it: 'Come possiamo aiutarti?', ru: 'Чем помочь?', uk: 'Чим допомогти?', pl: 'Jak możemy pomóc?', tr: 'Nasıl yardımcı olabiliriz?', vi: 'Chúng tôi có thể giúp gì?', id: 'Ada yang bisa kami bantu?', zh: '需要什么帮助？', ja: 'どうされましたか？', ko: '무엇을 도와드릴까요?' },
  'help.sub': { en: 'Guides, answers and tips for getting the most out of FORTX.', es: 'Guías, respuestas y consejos para aprovechar FORTX al máximo.', pt: 'Guias, respostas e dicas para aproveitar o FORTX ao máximo.', fr: 'Guides, réponses et astuces pour profiter au mieux de FORTX.', de: 'Anleitungen, Antworten und Tipps für das Beste aus FORTX.', it: 'Guide, risposte e consigli per sfruttare al meglio FORTX.', ru: 'Гайды, ответы и советы, чтобы получить максимум от FORTX.' },
  'help.contactTitle': { en: 'Still need a hand?', es: '¿Aún necesitas ayuda?', pt: 'Ainda precisa de ajuda?', fr: 'Besoin d’aide ?', de: 'Brauchst du noch Hilfe?', it: 'Hai ancora bisogno di aiuto?', ru: 'Нужна помощь?', uk: 'Потрібна допомога?', pl: 'Potrzebujesz pomocy?', tr: 'Hâlâ yardım mı lazım?', vi: 'Vẫn cần trợ giúp?', id: 'Masih butuh bantuan?', zh: '仍需帮助？', ja: 'お困りですか？', ko: '도움이 필요하신가요?' },
  'help.contactBtn': { en: 'Contact us', es: 'Contáctanos', pt: 'Fale conosco', fr: 'Nous contacter', de: 'Kontaktiere uns', it: 'Contattaci', ru: 'Связаться с нами', uk: 'Зв’язатися з нами', pl: 'Skontaktuj się', tr: 'Bize ulaşın', vi: 'Liên hệ', id: 'Hubungi kami', zh: '联系我们', ja: 'お問い合わせ', ko: '문의하기' },
  'help.searchPlaceholder': { en: 'Search articles…', es: 'Buscar artículos…', pt: 'Buscar artigos…', fr: 'Rechercher des articles…', de: 'Artikel suchen…', it: 'Cerca articoli…', ru: 'Поиск статей…', uk: 'Пошук статей…', pl: 'Szukaj artykułów…', tr: 'Makale ara…', vi: 'Tìm bài viết…', id: 'Cari artikel…', zh: '搜索文章…', ja: '記事を検索…', ko: '도움말 검색…' },
  'wheel.title': { en: 'Daily Wheel of Fortune', es: 'Rueda de la Fortuna diaria', pt: 'Roleta da Sorte diária', fr: 'Roue de la Fortune quotidienne', de: 'Tägliches Glücksrad', it: 'Ruota della Fortuna giornaliera', ru: 'Колесо Фортуны', uk: 'Колесо Фортуни', pl: 'Codzienne Koło Fortuny', tr: 'Günlük Şans Çarkı', vi: 'Vòng quay May mắn hằng ngày', id: 'Roda Keberuntungan Harian', zh: '每日幸运转盘', ja: 'デイリー運命のホイール', ko: '데일리 행운의 룰렛' },
  'calendar.title': { en: 'Events calendar', es: 'Calendario de eventos', pt: 'Calendário de eventos', fr: 'Calendrier des événements', de: 'Veranstaltungskalender', it: 'Calendario eventi', ru: 'Календарь событий', uk: 'Календар подій', pl: 'Kalendarz wydarzeń', tr: 'Etkinlik takvimi', vi: 'Lịch sự kiện', id: 'Kalender acara', zh: '事件日历', ja: 'イベントカレンダー', ko: '이벤트 캘린더' },
  'calendar.sub': { en: 'Upcoming markets by close date — plan your predictions ahead.', es: 'Próximos mercados por fecha de cierre — planifica tus predicciones.', pt: 'Próximos mercados por data de fechamento — planeje suas previsões.', fr: 'Marchés à venir par date de clôture — planifiez vos prédictions.', de: 'Kommende Märkte nach Schlussdatum — plane deine Vorhersagen.', it: 'Mercati in arrivo per data di chiusura — pianifica le tue previsioni.', ru: 'Ближайшие рынки по дате закрытия — планируй прогнозы заранее.' },
  'games.sub': { en: 'Provably-fair instant games. Pick one and play.', es: 'Juegos instantáneos con verificación justa. Elige y juega.', pt: 'Jogos instantâneos com prova de justiça. Escolha e jogue.', fr: 'Jeux instantanés vérifiables. Choisissez et jouez.', de: 'Beweisbar faire Sofortspiele. Wähle eines und spiele.', it: 'Giochi istantanei provabilmente equi. Scegli e gioca.', ru: 'Честные мгновенные игры. Выбирай и играй.', uk: 'Чесні миттєві ігри. Обирай і грай.', pl: 'Uczciwe gry natychmiastowe. Wybierz i graj.', tr: 'Kanıtlanabilir adil anlık oyunlar. Seç ve oyna.', vi: 'Trò chơi tức thì công bằng. Chọn và chơi.', id: 'Game instan yang terbukti adil. Pilih dan main.', zh: '可验证公平的即时游戏，选一个开玩。', ja: '実証可能に公平な即時ゲーム。選んでプレイ。', ko: '검증 가능한 공정 게임. 골라서 플레이하세요.' },
  'common.playNow': { en: 'Play now', es: 'Jugar ahora', pt: 'Jogar agora', fr: 'Jouer', de: 'Jetzt spielen', it: 'Gioca ora', ru: 'Играть', uk: 'Грати', pl: 'Graj teraz', tr: 'Şimdi oyna', vi: 'Chơi ngay', id: 'Main sekarang', zh: '立即游戏', ja: '今すぐプレイ', ko: '지금 플레이' },
  'common.signinToPlay': { en: 'Sign in to play', es: 'Inicia sesión para jugar', pt: 'Entre para jogar', fr: 'Connectez-vous pour jouer', de: 'Zum Spielen anmelden', it: 'Accedi per giocare', ru: 'Войдите, чтобы играть', uk: 'Увійдіть, щоб грати', pl: 'Zaloguj się, aby grać', tr: 'Oynamak için giriş yap', vi: 'Đăng nhập để chơi', id: 'Masuk untuk bermain', zh: '登录后游戏', ja: 'ログインしてプレイ', ko: '로그인하고 플레이' },
  'common.loading': { en: 'Loading…', es: 'Cargando…', pt: 'Carregando…', fr: 'Chargement…', de: 'Lädt…', it: 'Caricamento…', ru: 'Загрузка…', uk: 'Завантаження…', pl: 'Ładowanie…', tr: 'Yükleniyor…', vi: 'Đang tải…', id: 'Memuat…', zh: '加载中…', ja: '読み込み中…', ko: '불러오는 중…' },
  'common.copyLink': { en: 'Copy link', es: 'Copiar enlace', pt: 'Copiar link', fr: 'Copier le lien', de: 'Link kopieren', it: 'Copia link', ru: 'Копировать ссылку', uk: 'Копіювати посилання', pl: 'Kopiuj link', tr: 'Bağlantıyı kopyala', vi: 'Sao chép liên kết', id: 'Salin tautan', zh: '复制链接', ja: 'リンクをコピー', ko: '링크 복사' },
  'common.copied': { en: 'Copied!', es: '¡Copiado!', pt: 'Copiado!', fr: 'Copié !', de: 'Kopiert!', it: 'Copiato!', ru: 'Скопировано!', uk: 'Скопійовано!', pl: 'Skopiowano!', tr: 'Kopyalandı!', vi: 'Đã sao chép!', id: 'Disalin!', zh: '已复制！', ja: 'コピーしました！', ko: '복사됨!' },
  'common.spin': { en: 'Spin', es: 'Girar', pt: 'Girar', fr: 'Tourner', de: 'Drehen', it: 'Gira', ru: 'Крутить', uk: 'Крутити', pl: 'Zakręć', tr: 'Çevir', vi: 'Quay', id: 'Putar', zh: '旋转', ja: 'スピン', ko: '돌리기' },
  'common.claimToBalance': { en: 'Claim to balance', es: 'Reclamar al saldo', pt: 'Resgatar para o saldo', fr: 'Récupérer sur le solde', de: 'Auf Guthaben gutschreiben', it: 'Riscatta sul saldo', ru: 'Забрать на баланс', uk: 'Забрати на баланс', pl: 'Odbierz na saldo', tr: 'Bakiyeye aktar', vi: 'Nhận vào số dư', id: 'Klaim ke saldo', zh: '领取到余额', ja: '残高に受け取る', ko: '잔액으로 받기' },
  'home.casinoTitle': { en: 'Casino games', es: 'Juegos de casino', pt: 'Jogos de cassino', fr: 'Jeux de casino', de: 'Casino-Spiele', it: 'Giochi da casinò', ru: 'Игры казино', uk: 'Ігри казино', pl: 'Gry kasynowe', tr: 'Casino oyunları', vi: 'Trò chơi sòng bài', id: 'Permainan kasino', zh: '娱乐场游戏', ja: 'カジノゲーム', ko: '카지노 게임' },
};

for (const [key, vals] of Object.entries(EXTRA)) {
  for (const code of Object.keys(STRINGS)) {
    STRINGS[code][key] = vals[code] ?? vals.en ?? key;
  }
}

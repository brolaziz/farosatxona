# Farosatxona

Telegram guruhlari uchun kunlik farosat boti, qora dizayndagi admin va foydalanuvchi Mini App.

## Imkoniyatlar

- Har bir guruh uchun alohida balans va kunlik urinish; bot va Web App bir xil xizmatdan foydalanadi.
- 6 daraja, kunlik seriya, jami va ishlab topilgan farosat reytinglari.
- Qora bozor: **1 Telegram Star = 1 gramm**, xaridda guruh tanlanadi.
- Xarid grammi kunlik minus, adminning oddiy ayirishi va resetdan himoyalangan.
- Xarid jami balans va umumiy darajaga qo‘shiladi; kunlik yutuqlar **ishlab topilgan** balans darajasiga bog‘liq.
- Admin: statistika/grafiklar, guruh va foydalanuvchi qidiruvi/sahifalash, balansni sabab bilan tuzatish, muddatli cheklovlar, to‘lov/qaytarish, Telegram tranzaksiyalarini solishtirish va qolib ketgan xaridlarni tiklash.
- E’lonlar: auditoriya tanlash, matnni oldindan ko‘rish, sinov yuborish, rejalashtirish, natijalar.
- O‘yin sozlamalari, ega/admin/moderator/kuzatuvchi rollari, amallar tarixi, xatolarni qayta ishlash, CSV eksport.
- Avtomatik kunlik va qo‘lda zaxiralash; to‘lovlarni yo‘qotadigan eski nusxani tiklashdan himoya.
- Serverda Telegram initData imzosi va muddati, sessiya, har bir amal vakolati hamda guruh a’zoligi tekshiriladi.
- Telegram update’lari bazaga saqlanadi; takroriy to‘lovlar, qayta ishga tushish va qaytarishlar uchun tiklanish mavjud.

## Ishga tushirish

Node.js **22.16+**, amalda Node.js **24 LTS** tavsiya qilinadi.

1. Kutubxonalarni o‘rnating: `npm ci`.
2. `.env.example` dan `.env` yarating va haqiqiy qiymatlarni yozing.
3. Interfeysni yig‘ing: `npm run build`.
4. Ishga tushiring: `npm start`.

`.env`:

| Sozlama       | Vazifasi                                                               |
| ------------- | ---------------------------------------------------------------------- |
| BOT_TOKEN     | BotFather bergan token; frontendga uzatilmaydi                         |
| ADMIN_IDS     | Tizim egalarining Telegram ID’lari, vergul bilan ajratiladi            |
| DATABASE_PATH | Doimiy diskdagi SQLite fayli                                           |
| TZ            | Odatda Asia/Tashkent                                                   |
| PORT / HOST   | HTTP server, odatda 3000 / 0.0.0.0                                     |
| WEB_APP_URL   | Web App’ning HTTPS manzili                                             |
| BOT_USERNAME  | Bot username’i; ishga tushganda getMe orqali ham aniqlanadi            |
| SUPPORT_URL   | Xarid bo‘yicha yordam uchun HTTPS Telegram havolasi; sotuv uchun kerak |
| BACKUP_DIR    | Zaxiralar saqlanadigan doimiy katalog                                  |
| AUTO_BACKUP   | Kunlik zaxira yoqilgan; o‘chirish uchun false                          |

Telegram’da BotFather orqali Main Mini App’ga `WEB_APP_URL` manzilini belgilang.
Bot shaxsiy chat menyusini o‘zi sozlaydi. Main Mini App sozlanishi guruhdagi `startapp` havolalari uchun kerak.
Sotuv yoqiladigan guruhlarda botga admin huquqi bering; a’zolik tekshiruvi shu huquq bilan ishonchli ishlaydi.
Foydalanuvchi avval guruhda `/farosat` yozadi; keyin guruh Web App’da ko‘rinadi.

Bir bot/baza uchun **bitta nusxa** ishlating. Bot long polling’dan foydalanadi; oldingi webhook faol bo‘lsa uni olib tashlang. Yangi versiya eski admin tugmalarini moliyaviy yoki o‘chirish amali sifatida bajarmaydi.

## Mahalliy namoyish

`npm run build` dan keyin `node src/preview.js`:

- `http://127.0.0.1:3000` da admin va user ekranlarini ko‘rish mumkin.
- Yuqoridagi namoyish tugmasi orqali ikkala rol orasida o‘tiladi.
- Ma’lumotlar faqat xotirada, botga ulanish va haqiqiy to‘lovlar o‘chirilgan.
- Namoyish serveri faqat loopback manzilida ishlaydi. Uni ommaga hosting qilmang.
- Port band bo‘lsa `PREVIEW_PORT` ni boshqa portga belgilang.

Production serverda namoyish orqali kirish **mavjud emas**.

## Komandalar

`/farosat`, `/men`, `/top`, `/darajalar`, `/id`, `/bozor`, `/admin`, `/help`, `/terms`, `/paysupport`.

Admin guruhdan `/admin` yozsa, boshqaruvni shaxsiy chatda ochish havolasi keladi. Boshqaruv ma’lumotlari guruhga yuborilmaydi.

## To‘lov va hisob qoidalari

Server buyurtmada xaridor, guruh va miqdorni qayd etadi. Stars miqdori **100 ga ko‘paytirilmaydi**.
Frontenddagi to‘lov oynasi yopilishi balansni oshirmaydi. Faqat Telegram tasdiqlagan muvaffaqiyatli to‘lov yoki tekshirilgan Telegram tranzaksiyasi asosida kredit beriladi.
Receipt, ledger va balans bitta tranzaksiyada yoziladi. Bir charge ID qayta kelganda kredit takrorlanmaydi; bitta buyurtmaga ikkinchi charge kelsa, ikkinchi to‘lov qaytariladi.

Qaytarish to‘liq to‘lov bo‘yicha bajariladi. Tarmoq uzilganda qaytarish holati saqlanib qoladi va qayta tekshiriladi. Sotib olingan gramm sarflash/uzatish funksiyasi yo‘q; u qaytarish uchun hisobda saqlanadi.
Telegram hisobini solishtirish 500 ta tranzaksiyadan ko‘rib chiqadi; keyingi sahifaga davom etish mumkin. Topilmagan yoki mos kelmagan buyurtmalar operatorga ko‘rsatiladi.

O‘yin resetida ishlab topilgan balans reset qilinadi. Xarid balansi, cheklar va kunlik urinish tarixi saqlanadi. Reset bugungi urinishni qayta ochmaydi. Xaridsiz profillar arxivlanadi; foydalanuvchi qaytib o‘ynaganda profil qayta ochiladi.

## Eski bazani ko‘chirish

Birinchi ishga tushishda eski bazaning `.before-v2-....bak` nusxasi olinadi. Migratsiya balans, ID, seriya va kunlik natijalarni saqlaydi.
Eski balans boshlang‘ich qoldiq sifatida yoziladi; ilgari audit bo‘lmagan admin o‘zgarishlarining manbasini aniq tiklash mumkin emas.
Migratsiya qayta ishga tushishda takrorlanmaydi. Production bazani ko‘chirishdan oldin alohida zaxira ham oling.

## Zaxira va tiklash

- Admin → Ma’lumotlar → Zaxira yaratish / Yuklab olish.
- CLI: `npm run backup`.
- Kunlik avtomatik zaxira server katalogida saqlanadi. Tashqi disk yoki mustaqil saqlash joyiga ham nusxa olib turing.
- Tiklash: botni to‘xtatib, `node scripts/restore.js /path/to/backup.db --confirm`.

Tiklash joriy bazaning oldingi nusxasini ham oladi. Yangi buyurtma, to‘lov yoki qaytarish holatini yo‘qotadigan zaxira rad qilinadi. Baza butunlay buzilgan bo‘lsa, moliyaviy holatni operator tekshirib tiklashi kerak.
Instance lock ishlayotgan bot ustiga baza yozilishidan himoya qiladi.

## Hosting

Railway uchun tayyor infratuzilma `.railway/railway.ts` faylida. Batafsil tartib: [Railway qo‘llanmasi](docs/railway.md).

Dockerfile frontend va backendni bitta image’da tayyorlaydi:

```sh
docker build -t farosatxona .
docker run --env-file .env -p 3000:3000 -v farosat-data:/app/data farosatxona
```

HTTPS reverse proxy yoki hosting platformasining HTTPS domenidan foydalaning.
Railway/VPS/Docker’da bitta instance va **doimiy volume** kerak. Diskni `/app/data` ga ulang, `DATABASE_PATH=/app/data/farosatxona.db` va `BACKUP_DIR=/app/data/backups`.
Build: `npm ci && npm run build`. Start: `node src/index.js`. Health check: `/health`.
Tokenni faqat serverning maxfiy muhit sozlamasida saqlang. Production’ga `src/preview.js` ni start komandasi sifatida bermang.

## Tekshirish

`npm test` yoki `node --test`; `npm run build`; `npm audit`.
Testlar Telegram’ga haqiqiy so‘rov yoki haqiqiy to‘lov yubormaydi. Sinov serverida Telegram’ning alohida test bot muhiti bilan Stars oqimini tekshirish kerak.
Brauzerda Android/iOS Telegram va kompyuter ekranlarini, navigatsiya, modal, qidiruv, xaridni bekor qilish va Web App’ni qayta ochishni tekshiring.

Rasmiy manbalar: [Mini Apps](https://core.telegram.org/bots/webapps), [Stars](https://core.telegram.org/bots/payments-stars), [Bot API](https://core.telegram.org/bots/api).

# Farosatxona Telegram bot

Guruh a'zolari Farosatxonaga har kuni bir marta `/farosat` yozib, tasodifiy farosat luqmasini oladi yoki boridan ayriladi. Farosat grammda o'lchanadi, natijalar har bir Telegram guruhi uchun alohida saqlanadi.

## Imkoniyatlar

- kuniga bitta halol urinish (Toshkent vaqti bo'yicha);
- 6 daraja: Bronza, Kumush, Oltin, Platina, Olmos, Afsonaviy;
- daraja oshgan sari ijobiy natija ehtimoli va yutuq kattalashadi;
- kulgili musbat/manfiy hukmlar va daraja almashish xabarlari;
- guruh bo'yicha TOP-10;
- kunlik seriya va shaxsiy statistika;
- tashqi kutubxonasiz ishlaydi: Node.js va ichki SQLite yetarli.

## Ishga tushirish

Talab: **Node.js 22.13 yoki yangiroq**.

1. Telegram'da `@BotFather` bilan bot yarating va token oling.
2. `.env.example` nusxasini `.env` nomi bilan saqlang.
3. `.env` ichidagi `BOT_TOKEN` qiymatini haqiqiy token bilan almashtiring.
4. Botni ishga tushiring:

```bash
npm start
```

5. Botni guruhga qo'shib, `/farosat` yozing.

Bot faqat slash-komandalarni o'qiydi, shuning uchun BotFather'dagi privacy mode'ni o'chirish shart emas. Bir paytda faqat bitta nusxani ishga tushiring: long polling va webhook birga ishlamaydi.

## Komandalar

| Komanda | Vazifasi |
|---|---|
| `/farosat` | Bugungi farosatni o'lchaydi |
| `/men` | Shaxsiy statistika va daraja |
| `/top` | Guruhning TOP-10 reytingi |
| `/darajalar` | Daraja chegaralari va imkoniyatlar |
| `/help` | Qisqa yo'riqnoma |

## Tekshirish

```bash
npm test
```

Ma'lumotlar odatda `data/farosatxona.db` faylida saqlanadi. Serverga ko'chirganda shu fayl uchun doimiy disk ajrating va zaxira nusxa olib turing.

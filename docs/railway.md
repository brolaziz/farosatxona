# Railway’da Farosatxona

Bot va Mini App bitta servisda ishlaydi. SQLite va zaxiralar `/app/data` volume’da saqlanadi. Bitta nusxa va doim ishlash rejimi kerak; bot long polling ishlatadi.

## Tayyor konfiguratsiya

`.railway/railway.ts` Railway’ning rasmiy `railway/iac` SDK’sidan foydalanadi. Unda Dockerfile, `/health`, qayta ishga tushirish, 30 soniyali to‘xtash muddati, bitta nusxa va 500 MB boshlang‘ich volume belgilangan. Bot tokeni va admin ID `preserve()` orqali serverda saqlanadi; faylga yozilmaydi. Production domeni va yordam manzili konfiguratsiyada belgilangan.

`builder: "RAILPACK"` Railway public API’ning haqiqiy `Builder` enum’iga mos. Railway repozitoriydagi Dockerfile’ni avtomatik aniqlab Docker build qiladi; bu API versiyasiga `builder: "DOCKERFILE"` yuborish rad etiladi.

`partial = "farosatxona"` faqat ushbu repozitoriyga tegishli servis va volume’ni boshqaradi. Boshqa repozitoriylar servislariga egalik olinmaydi. Mavjud Farosatxona servisining nomi boshqacha bo‘lsa, konfiguratsiya va resurs bog‘lanishini avval moslang. Har safar `config plan` natijasida o‘chirish amali yo‘qligini tekshiring.

Servis GitHub’dagi `brolaziz/farosatxona` repozitoriyning `main` tarmog‘iga ulanadi. Konfiguratsiyani qo‘llashdan oldin tekshirilgan kod GitHub’ga push qilingan bo‘lishi kerak.

## Ishga tushirish

1. `npm ci`, `npm test`, `npm run build`.
2. Railway CLI: `npm install -g @railway/cli`; hisobga kiring: `railway login`.
3. Farosatxona ulangan loyihaning aniq ID’siga `railway link` bilan ulaning.
4. `railway config plan` orqali yangi servis va volume’ni tekshiring. Keyin shu tekshirilgan konfiguratsiyani `railway config apply` bilan qo‘llang.
5. Railway → farosatxona → Variables’da quyidagilarni kiriting:

| Kalit        | Qiymat                                                         |
| ------------ | -------------------------------------------------------------- |
| BOT_TOKEN    | BotFather bergan haqiqiy token; sealed secret sifatida saqlang |
| ADMIN_IDS    | Egalar Telegram ID’lari, vergul bilan ajratilgan               |
| SUPPORT_URL  | Xarid bo‘yicha yordam uchun haqiqiy HTTPS manzil               |
| BOT_USERNAME | Bot username’i, `@` belgisiz; getMe orqali ham aniqlanadi      |
| WEB_APP_URL  | Railway bergan haqiqiy HTTPS domen                             |

6. Networking’da Railway domenini yarating, target port `3000`. `WEB_APP_URL` ni aynan shu HTTPS manzilga qo‘ying.
7. Eski botni to‘xtating, uning SQLite bazasini zaxiralang va kerak bo‘lsa volume’dagi `/app/data/farosatxona.db` ga ko‘chiring. Ishlayotgan bazani oddiy fayl nusxalash bilan ko‘chirmang: `npm run backup` SQLite’ning izchil snapshotini yaratadi. Volume’dagi mavjud bazani ustiga yozishdan oldin alohida zaxira oling.
8. GitHub’dan deploy qiling. Deployment status, build log, runtime log va HTTPS `/health` javobini tekshiring. Mahalliy kod bilan deploy kerak bo‘lsa `railway up --service farosatxona` ham ishlaydi.
9. BotFather → Main Mini App’ga `WEB_APP_URL` ni kiriting. Guruhda botga admin huquqi bering, shaxsiy chatda `/start` va `/admin` ni tekshiring.

Railway volume’lari root foydalanuvchisiga tegishli bo‘lgani uchun `RAILWAY_RUN_UID=0` rasmiy ko‘rsatmaga muvofiq kiritilgan. Oddiy Docker named volume uchun image odatda `node` foydalanuvchisida ishlaydi.

## Deploydan keyingi tekshiruv

- `/health` HTTP 200; Mini App ochilishi va Telegram orqali haqiqiy kirish.
- Admin panel faqat ruxsatli ID’ga ochilishi.
- Guruh tanlash, bot va Mini App’dan bir kunlik umumiy urinish.
- Test bot muhitida Stars invoice, bekor qilish, tasdiqlangan xarid va qaytarish; **1 Star = 1 gramm**.
- Qayta ishga tushirgandan keyin balans va chek saqlanishi, ikkinchi kredit bo‘lmasligi.
- Zaxirani yuklab olish; mustaqil tashqi nusxa ham saqlash.

Bot tokeni yoki mavjud baza yo‘qligida jonli ishga tushgan deb hisoblamang. Lokal namoyish sahifasi `src/preview.js` production uchun mo‘ljallanmagan.

## CLI natijasini tekshirish

`config apply` ning exit code’i va “Applied” matni yolg‘iz o‘zi deployni tasdiqlamaydi. `--json` javobidagi `diagnostics` va `status` ni, so‘ng `railway service list --json` orqali haqiqiy servis/volume va deployment holatini tekshiring. Tarif muddati tugaganda CLI muvaffaqiyat matnini chiqarishi mumkin, lekin backend yangi resurslarni yaratmaydi. `Your trial has expired. Please select a plan to continue using Railway` bo‘lsa, workspace tarifini faollashtirish kerak.

Windows’da SDK yangi CLI versiyasini topa olmasa, rasmiy paketning native executable’ini to‘g‘ridan-to‘g‘ri ko‘rsating. Global `@railway/cli` o‘rnatilganda:

```powershell
$railwayNative = Join-Path (npm root -g) '@railway/cli/bin/railway.exe'
$env:_ = $railwayNative
& $railwayNative config plan --out .railway/deploy-plan.json
& $railwayNative config apply --plan .railway/deploy-plan.json --yes --json
```

Reja faqat kutilgan Farosatxona resurslarini o‘zgartirayotganini tekshiring. Pinned plan maxfiy qiymatlar va resurs holatini o‘z ichiga olishi mumkin; `.gitignore` uni GitHub’ga push qilishdan chiqaradi.

Rasmiy manbalar: [Railway CLI](https://docs.railway.com/cli), [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code), [Volume va ruxsatlar](https://docs.railway.com/volumes), [Volume cheklovlari](https://docs.railway.com/volumes/reference).

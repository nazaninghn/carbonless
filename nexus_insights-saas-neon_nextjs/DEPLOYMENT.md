# راهنمای دیپلوی در Vercel

## مرحله 1: آماده‌سازی کد

✅ پروژه آماده است و build موفقیت‌آمیز انجام شد.

## مرحله 2: ایجاد مخزن Git

اگر هنوز Git را راه‌اندازی نکرده‌اید:

```bash
cd nexus_insights-saas-neon_nextjs
git init
git add .
git commit -m "Initial commit - Carbonless Carbon Calculator"
```

## مرحله 3: آپلود به GitHub

1. در GitHub یک repository جدید بسازید
2. کد را push کنید:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## مرحله 4: دیپلوی در Vercel

### روش 1: از طریق وب‌سایت Vercel

1. به [vercel.com](https://vercel.com) بروید
2. با GitHub لاگین کنید
3. روی "Add New Project" کلیک کنید
4. Repository خود را انتخاب کنید
5. تنظیمات را بررسی کنید:
   - **Framework Preset:** Next.js
   - **Root Directory:** `./` (یا اگر در پوشه دیگری است، آن را مشخص کنید)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
6. روی "Deploy" کلیک کنید

### روش 2: از طریق Vercel CLI

```bash
# نصب Vercel CLI
npm i -g vercel

# لاگین
vercel login

# دیپلوی
vercel

# برای production
vercel --prod
```

## مرحله 5: تنظیمات دامنه (اختیاری)

1. در داشبورد Vercel، به تب "Domains" بروید
2. دامنه دلخواه خود را اضافه کنید
3. DNS records را طبق دستورالعمل Vercel تنظیم کنید

## مرحله 6: متغیرهای محیطی (در صورت نیاز)

اگر در آینده نیاز به API keys یا متغیرهای محیطی داشتید:

1. در داشبورد Vercel، به تب "Settings" بروید
2. به بخش "Environment Variables" بروید
3. متغیرهای خود را اضافه کنید

## نکات مهم

- ✅ Build موفقیت‌آمیز است
- ✅ تمام صفحات responsive هستند
- ✅ سیستم دو زبانه (ترکی/انگلیسی) کار می‌کند
- ✅ تمام لینک‌ها به Next.js routes تبدیل شده‌اند
- ✅ لوگو در مسیر `/public/carbonless.png` قرار دارد

## پس از دیپلوی

پس از دیپلوی موفق، لینک سایت شما به شکل زیر خواهد بود:
```
https://your-project-name.vercel.app
```

می‌توانید این لینک را با دیگران به اشتراک بگذارید!

## به‌روزرسانی سایت

هر بار که تغییراتی در کد ایجاد کنید و به GitHub push کنید، Vercel به صورت خودکار سایت را rebuild و deploy می‌کند.

```bash
git add .
git commit -m "توضیحات تغییرات"
git push
```

---

## پشتیبانی

اگر مشکلی پیش آمد:
- لاگ‌های build را در داشبورد Vercel بررسی کنید
- مطمئن شوید که `npm run build` در local بدون خطا اجرا می‌شود
- [مستندات Vercel](https://vercel.com/docs) را مطالعه کنید

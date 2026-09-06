# Fluent — مدرس الإنجليزي الذكي (English AI Tutor)

تطبيق ويب كامل يعمل كـ English Conversation Partner + IELTS Coach + Grammar Tutor، بواجهة HTML/CSS/JS ونسخة Backend بسيطة تحمي مفتاح الـ API.

## 📁 هيكل المشروع

```
project/
├── index.html          ← الواجهة (الصفحة الرئيسية)
├── style.css           ← التصميم (Light/Dark mode متجاوب)
├── api.js              ← طبقة اتصال الواجهة بالـ Backend (لا تحتوي أي مفتاح API)
├── app.js              ← منطق التطبيق كامل (المحادثة، IELTS، التصحيح، المفردات، الصوت)
├── server/
│   ├── server.js        ← Backend بسيط (Node/Express) يستدعي Anthropic API
│   ├── package.json
│   └── .env.example     ← مكان وضع مفتاح الـ API
└── README.md
```

**لماذا يوجد Backend منفصل؟**
تشغيل مفتاح AI API مباشرة من كود الواجهة (المتصفح) غير آمن أبدًا — أي شخص يفتح Developer Tools سيرى المفتاح ويستطيع استخدامه على حسابك. لذلك الواجهة (`api.js`) لا تكلّم إلا `server/server.js`، وهذا الأخير هو الوحيد الذي يحمل المفتاح الحقيقي.

## 🚀 التشغيل

### 1) شغّل الـ Backend
```bash
cd server
npm install
cp .env.example .env
```
افتح ملف `.env` وضع مفتاحك:
```
ANTHROPIC_API_KEY=sk-ant-...
```
ثم شغّل الخادم:
```bash
npm start
```
سيعمل على `http://localhost:3001`.

### 2) افتح الواجهة
افتح `index.html` مباشرة في المتصفح، أو قدّمه عبر أي static server بسيط (مثلاً `npx serve .` من مجلد المشروع الرئيسي). الواجهة تتواصل تلقائيًا مع `http://localhost:3001/api/...` (معرّف داخل `api.js` عبر `BASE_URL`).

> إذا نشرت الواجهة والـ Backend على نطاقات مختلفة في الإنتاج، عدّل `window.FLUENT_BACKEND_URL` في `index.html` قبل تحميل `api.js`، أو غيّر `BASE_URL` مباشرة داخل `api.js`.

## 🔑 أين أضع API key؟
**فقط** في `server/.env` (لا يوضع أبدًا داخل `app.js` أو `api.js` أو أي كود يعمل في المتصفح). هذا الملف مستثنى من git افتراضيًا — لا ترفعه لأي مستودع عام.

## 🔄 تبديل مزود الذكاء الاصطناعي
كل التفاصيل الخاصة بـ Anthropic موجودة في دالة واحدة فقط: `callModel()` داخل `server/server.js`. لاستخدام OpenAI أو أي مزود آخر، عدّل هذه الدالة فقط — الواجهة والـ routes لا تحتاج أي تغيير.

## 🔍 خاصية الأخبار / البحث على الويب
في وضع "News Discussion"، تستدعي الواجهة `/api/search` قبل إرسال الرسالة للنموذج. حاليًا هذا الـ endpoint في `server.js` **غير مفعّل** (placeholder واضح) ويرجع `available:false`، وبناءً عليه يوضّح البوت في الـ System Prompt أنه لا يعرف شيئًا حديثًا بدل اختلاق أخبار. لتفعيله فعليًا:
- اربط أي مزود بحث (Bing/Serper/Anthropic web_search tool...) داخل دالة `/api/search` في `server.js` — المكان محدد بالتعليقات داخل الملف.

## ✅ الميزات المطبّقة
- محادثة طبيعية مستمرة السياق داخل الجلسة، مع 8 أوضاع: Free Conversation, IELTS Speaking, Debate, News Discussion, Job Interview, Daily English, Vocabulary Practice, Grammar Practice.
- IELTS Mock كامل (Part 1/2/3) + تقرير Bands منفصل (Fluency, Lexical, Grammar, Pronunciation) + Overall estimated band مع توضيح أنه تقدير، وأيضًا شرح ونصائح لرفع المستوى — تظهر في تبويب "Session Report".
- تصحيح فوري أو مؤجل لنهاية الجلسة (زر Immediate / At the end في الشريط الجانبي)، مع نوع الخطأ، الجملة الأصلية، التصحيح، والشرح.
- تتبع الأخطاء المتكررة تلقائيًا في تبويب "My Mistakes".
- اقتراحات مفردات بمستوى IELTS مع زر "Add to Vocabulary" وقائمة مراجعة.
- مستوى اللغة A2–C2 أو Auto-detect.
- صوت: زر Microphone (Web Speech API للتعرف على الكلام)، Text-to-Speech لسماع الرد، زر Replay، وشريط لسرعة الصوت. إذا كان المتصفح لا يدعم هذه الميزات تظهر رسالة واضحة بدل تعطل التطبيق.
- حفظ محلي (localStorage): المفردات، الأخطاء المتكررة، عدد الجلسات، وتقديرات IELTS السابقة — تُحمَّل تلقائيًا عند فتح التطبيق من جديد. زر "Reset saved data" لمسحها.
- Dark / Light mode، وتصميم متجاوب مع الجوال والآيباد والكمبيوتر.

## ⚠️ ملاحظات صادقة (لا ندّعي أكثر من الواقع)
- تحليل النطق (Pronunciation) الحقيقي بالصوت غير مدعوم تقنيًا من متصفح عادي — تقييم الـ Pronunciation ضمن IELTS Report هو تقدير النموذج بناءً على النص المكتوب/المنقول من كلامك، وليس تحليلاً صوتيًا فعليًا. موضّح هذا داخل الكود ويمكن لاحقًا ربط API متخصص لتحليل النطق.
- ميزة الأخبار تحتاج منك ربط مزود بحث حقيقي كما هو موضّح أعلاه؛ بدونها البوت يصرّح بذلك بدل اختلاق معلومات.
- درجات IELTS كلها **تقديرية** وليست رسمية — هذا موضّح للمستخدم داخل الواجهة نفسها.

# גרסת תצוגה של גרסה 2

`build_preview.py` בונה עותק מסומן של הענף `claude/v2-explanations`, ותהליך הפרסום של האתר (`.github/workflows/pages.yml` בענף ברירת המחדל) מוסיף אותו לאתר תחת **`/preview/`**, כלומר `eva.medicom.vip/preview/`.

- **גרסה 1 נשארת בכתובת הרגילה.** שלב התצוגה הוא "ניסיון בלבד" (`continue-on-error`): אם הבנייה נכשלת, האתר הרגיל מתפרסם כרגיל בלי תצוגה, וגם אין תצוגה חלקית.
- **ההתקדמות נפרדת.** התצוגה יושבת על אותו דומיין, ולכן כל מזהה שיכול להתנגש משנה שם (`road26` הופך ל־`road26pv`): מפתח ההתקדמות, סימוני התמונות ושמות ה־cache של ה־service worker. הבנייה נכשלת אם נשאר איזשהו מזהה שלא שונה.
- **סימון ברור:** פס כתום בראש כל מסך עם קוד הקומיט, כותרת שמתחילה ב"[תצוגה]", `noindex`, והאפליקציה המותקנת נקראת "26 תצוגה".
- **עדכון אוטומטי:** דחיפה לענף `claude/v2-explanations` מפעילה את תהליך הפרסום של ענף ברירת המחדל (`workflow_dispatch`), והוא בונה מחדש את התצוגה מהקומיט האחרון.
- **בדיקה עצמית:** בכל דחיפה לענף גרסה 2 רץ שלב `preview-selftest` שבונה את התצוגה בתיקייה זמנית ומריץ את כל הבדיקות.
- **בנייה מקומית:** `python3 preview/build_preview.py --src . --out /tmp/preview` (לא משנה את עץ המקור).
- **העלאה לאתר הרגיל:** ממזגים את `claude/v2-explanations` לענף ברירת המחדל. אחרי המיזוג מסירים משם את שלב "Add the v2 preview" מ־`pages.yml` (או משאירים אותו, והוא פשוט ידלג).

## בדיקת הפרדה מקומית

```bash
# האתר הרגיל בשורש + התצוגה ב־/preview/ (כמו שתהליך הפרסום מרכיב אותם)
mkdir -p /tmp/combo && git archive <ענף-ברירת-המחדל> | tar -x -C /tmp/v1 && (cd /tmp/v1 && python3 tools/build_sw.py \
  && cp -r index.html manifest.webmanifest sw.js css js fonts img /tmp/combo/ && mkdir -p /tmp/combo/data && cp data/questions.json data/units.json /tmp/combo/data/)
python3 preview/build_preview.py --src . --out /tmp/combo/preview
npx http-server /tmp/combo -p 8125 -c-1 &
NODE_PATH=$(npm root -g) node tests/e2e/preview.mjs http://localhost:8125
```

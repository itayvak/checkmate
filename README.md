# Check Mate

אפליקציה לבדיקה שוטפת של תר"צים ומבחנים בקוד.
לאחר העלאת הסורסים של חניכים, ניתן להריץ אותם בצורה אוטומטית ולקבל תוצאות על ההרצה, וניתן לג'נרט הערות על הקוד בצורה אוטומטית.

יצירת סקריפט בדיקה אוטומטית וג'ינרוט הערות נעשה בעזרת AI.

## דרישות

1. ניתן להריץ את האפליקציה מקומית, או על מכונה וירטואלית.
2. יש ליצור חשבון בGemini ולקבל API Key על מנת שהאפליקציה תוכל לשלוח בקשות לAI.

הערה: שימוש בAPI עם המפתח יכול לגרום להוצאות כספיות, על גבול הכמה שקלים. שווה לקחת את זה בחשבון אבל, לכן גם תצטרכו להכניס כרטיס אשראי בקבלת API Key.

## הרצה על מכונה בעזרת Docker

על מנת להריץ את האפליקציה על מכונת לינוקס, יש להריץ עליה את הפקודה הזו:

```bash
git clone https://github.com/itayvak/checkmate.git checkmate && cd checkmate && chmod +x deploy.sh && ./deploy.sh
```

הפקודה תעשה את כל מה שצריך, ולאחר מכן האתר אמור לעלות לכם בפורט 5000!

ניתן גם להוסיף את הפרמטרים הבאים (אופציונלי):

- --image_name
- --port
- --data_dir

## הרצה מקומית (פיתוח)

אפשר גם להריץ את האפליקציה מקומית בעזרת פיתון במקום Docker. למטרות פיתוח או בדיקה.

1. התקנת תלויות:

```bash
pip install -r requirements.txt
```

2. הרצה:

```bash
python app/main.py
```

3. פתיחה בדפדפן:

`http://localhost:5000`

## הרצת Frontend (React)

ה-frontend החדש הוא ב-`front/` (Vite + React). בזמן פיתוח:

1. פתח מסוף נוסף והריץ:

```bash
cd front
npm install
npm run dev
```

2. השאר את Flask רץ על `http://localhost:5000`.

3. פתח את:

`http://localhost:5173/`

ה-React משתמש ב-`/api/...` מול ה-backend של Flask (באמצעות פרוקסי של Vite), וה-`/projects/<id>` workspace עדיין נטען כעמוד שרת.

## מבנה קצר של הפרויקט

- `app/__init__.py` - יצירת אפליקציית Flask ורישום Blueprints.
- `app/routes/main/` - ניתוב ראשי (`/`, `/healthz`).
- `app/routes/projects/` - תהליכי עבודה של פרויקטים (חלוקה ל-`index/comments/annotations/sources/checker/runs/settings`).
- `app/db.py` - שכבת SQLite ושמירת נתוני פרויקטים/סשנים.
- `templates/` - תבניות ה-UI.
- `app/main.py` - נקודת כניסה לפיתוח מקומי (`python app/main.py`).
- `run.py` - נשאר קיים כרפיד עבור הרצה מקומית (`python run.py`).
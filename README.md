# Check Mate

Check Mate היא אפליקציית Flask לניהול ובדיקה של הגשות סטודנטים ב-Python.  
האפליקציה מאפשרת למרצה להעלות מטלה ופתרון מודל, להריץ Checker על מספר קבצים, ולקבל משוב/אנוטציות בעזרת Google Gemini.

## מה האפליקציה עושה

- יצירת פרויקטים לכל מטלה בנפרד.
- העלאת קובץ מטלה (`.md`) ופתרון מודל (`.py`).
- העלאת הגשות סטודנטים והרצה מרוכזת של Checker.
- שמירת תוצאות הרצה והיסטוריית סשנים במסד נתונים SQLite.
- יצירת/שיפור משובים להערכה באמצעות Gemini.

## הרצה מקומית (פיתוח)

1. התקנת תלויות:

```bash
pip install -r requirements.txt
```

2. הרצה:

```bash
python run.py
```

3. פתיחה בדפדפן:

`http://localhost:5000`

## פריסה עם Docker

### התקנה מהירה בעזרת סקריפט ההתקנה (מומלץ)

```bash
git clone https://github.com/itayvak/checkmate.git checkmate && cd checkmate && chmod +x deploy.sh && ./deploy.sh
```

דוגמה עם פרמטרים מפורשים:

```bash
git clone https://github.com/itayvak/checkmate.git checkmate && cd checkmate && chmod +x deploy.sh && ./deploy.sh --image_name checkmate --port 5000 --data_dir /opt/checkmate-data
```

### בניית Image

```bash
docker build -t checkmate .
```

### הרצה עם מסד נתונים קבוע (Persistent Volume)

```bash
docker run --name checkmate \
  -p 5000:5000 \
  -v checkmate-data:/data \
  -e CHECKMATE_DATA_DIR=/data \
  --restart unless-stopped \
  checkmate
```

## מבנה קצר של הפרויקט

- `app/__init__.py` - יצירת אפליקציית Flask ורישום Blueprints.
- `app/routes_main.py` - ניתוב ראשי (`/`, `/healthz`).
- `app/routes_projects.py` - תהליכי עבודה של פרויקטים, העלאות והרצות.
- `app/db.py` - שכבת SQLite ושמירת נתוני פרויקטים/סשנים.
- `templates/` - תבניות ה-UI.
- `run.py` - נקודת כניסה לפיתוח מקומי.
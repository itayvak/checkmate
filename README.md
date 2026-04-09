[![Build Status](https://ci.itayvak.com/api/badges/itayvak/checkmate/status.svg?ref=refs/heads/main)](https://ci.itayvak.com/itayvak/checkmate)
# Check Mate

אפליקציה לבדיקה שוטפת של תר"צים ומבחנים בקוד.
לאחר העלאת הסורסים של חניכים, ניתן להריץ אותם בצורה אוטומטית ולקבל תוצאות על ההרצה, וניתן לג'נרט הערות על הקוד בצורה אוטומטית.

יצירת סקריפט בדיקה אוטומטית וג'ינרוט הערות נעשה בעזרת AI.

## פריסה
על מנת לפרוס את האפליקציה על מכונה וירטואלית, תעשו:
1. לפתוח מכונת Windows חדשה
2. להתחבר למכונה עם mstsc
3. לפתוח Powershell על המכונה במצב Administrator
4. להריץ את הפקודה הבאה:
```powershell
Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/itayvak/checkmate/main/scripts/windows/install.ps1' -OutFile "$env:TEMP\checkmate-install.ps1" -UseBasicParsing; & "$env:TEMP\checkmate-install.ps1" -RepoUrl 'https://github.com/itayvak/checkmate.git'
```

### למה אי אפשר בלינוקס??
חובה להריץ את האפליקציה הזאת על ווינדוס בשל העובדה שכל הסורסים שהחניכים כותבים נכתבים על ווינדוס בעצמם.

כחלק מהפעולות של האפליקציה, היא מריצה סורסים של חניכים וככה בודקת בצורה אוטומטית שהם מימשו את הדרישות. בגלל שהחניכים כותבים את
הסקריפטים שלהם בהנחה שהוא רץ על עמדת ווינדוס, הסקריפט לא יכול לרוץ על מערכת הפעלה אחרת.

לדוגמא, כל הנתיבים בסקריפטים יהיו בפורמט של ווינדוס. עוד דוגמא, במדרגה 1 של IT ממש צריך לכתוב סקריפט שעורך ערכים בRegistry של ווינדוס.

לכן, בשביל שהפיצר של הבדיקה אוטומטית יעבוד חייב להריץ את זה על ווינדוס.

בשביל זה יש סקריפט הרצה מאוד נוח ופשוט :)

## פיתוח מקומי

בשביל להריץ את האפליקציה על המחשב שלך, קודם כל צריך לדאוג שמותקן על המחשב:
- python
- git
- nodeJS

לאחר מכן, בשביל להריץ את האפליקציה:
1. לעשות Clone למחשב שלכם
2. להתקין את הספריות Python הדרושות:
```bash
cd back
pip install -r requirements.txt
```
3. להתקין את הספריות NPM הדרושות:
```bash
cd front
npm install
```
4. עכשיו ניתן להריץ את שתי חלקי האפליקציה. נתחיל בלהריץ את הbackend:
```bash
cd back
python main.py
```
5. נפתח Terminal חדש ובו נריץ את הfrontend:
```bash
cd front
npm run dev
```
וזהו! ניתן לגשת לאפליקציה בlocalhost:3000.

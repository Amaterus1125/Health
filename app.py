from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import json
from datetime import datetime

from run import sheet_to_engine
from engine import recommend, check
from meals import recommend_meals

# just some imports for the pdf making , work flawlessly emo
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

app = FastAPI(title="Nutrition Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HISTORY_FILE = "user_history.json"

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_history(history):
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)

class UserSurveyRequest(BaseModel):
    name: str
    age: int
    sex: str                  
    height: float             
    weight: float             
    activity: float           
    goal: str                 
    diet: str                 
    water_level: Optional[str] = "moderate"
    allergies: Optional[List[str]] = []
    dislikes: Optional[List[str]] = []
    jain: Optional[bool] = False
    protein_level: Optional[str] = "optimum"
    include_supplements: Optional[bool] = False

def calculate_sheet_from_survey(survey: UserSurveyRequest) -> dict:
    sex_lower = survey.sex.lower()
    is_male = (sex_lower == "male")
    
    s_val = 5 if is_male else -161
    bmr = 10 * survey.weight + 6.25 * survey.height - 5 * survey.age + s_val
    tdee = bmr * survey.activity
    
    goal_map = {"lose": -400, "maintain": 0, "gain": 400}
    adjustment = goal_map.get(survey.goal.lower(), 0)
    target = tdee + adjustment
    min_floor = 1500 if is_male else 1200
    target = max(target, min_floor)
    
    fat_target = target * 0.30 / 9
    fat_min = target * 0.20 / 9
    
    w = survey.weight
    prot_min = w * 0.8
    prot_opt = w * 1.6
    prot_max = w * 2.2
    
    carbs_opt = (target - (prot_opt * 4) - (fat_target * 9)) / 4
    carbs_min = (target - (prot_min * 4) - (fat_target * 9)) / 4
    carbs_max = (target - (prot_max * 4) - (fat_target * 9)) / 4
    
    fiber_val = 14 * target / 1000

    diet_map = {
        "vegetarian": "vegetarian",
        "non-vegetarian": "nonveg",
        "vegan": "vegan",
        "eggetarian": "egg"
    }
    eng_diet = diet_map.get(survey.diet.lower(), "vegetarian")

    return {
        "inputs": {
            "age": survey.age,
            "sex": sex_lower,
            "height_cm": survey.height,
            "weight_kg": survey.weight,
            "activity_factor": survey.activity,
            "goal": survey.goal.lower(),
            "water_level": survey.water_level
        },
        "energy": {
            "bmr": round(bmr),
            "tdee": round(tdee),
            "target_calories": round(target)
        },
        "fat": {
            "min_g": round(fat_min),
            "target_g": round(fat_target),
            "saturated_g": round(fat_target / 3),
            "unsaturated_g": round(fat_target * 2 / 3)
        },
        "fiber_g": round(fiber_val),
        "protein": {
            "minimum": {"g": round(prot_min), "kcal": round(prot_min * 4)},
            "optimum": {"g": round(prot_opt), "kcal": round(prot_opt * 4)},
            "maximum": {"g": round(prot_max), "kcal": round(prot_max * 4)}
        },
        "carbs_g": {
            "minimum": round(carbs_min),
            "optimum": round(carbs_opt),
            "maximum": round(carbs_max)
        },
        "water_ml": {
            "normal": round(survey.weight * 35),
            "moderate": round(survey.weight * 45),
            "extreme": round(survey.weight * 55)
        },
        "micronutrients": {
            "vitamin_a_ug": 900 if is_male else 700, "vitamin_c_mg": 90 if is_male else 75,
            "vitamin_d_ug": 15, "vitamin_e_mg": 15, "vitamin_k_ug": 120 if is_male else 90,
            "b1_mg": 1.2 if is_male else 1.1, "b2_mg": 1.3 if is_male else 1.1,
            "b3_mg": 16 if is_male else 14, "b6_mg": 1.3, "b12_ug": 2.4, "folate_ug": 400,
            "calcium_mg": 1000, "iron_mg": 8 if is_male else 18, "magnesium_mg": 400 if is_male else 310,
            "zinc_mg": 11 if is_male else 8, "potassium_mg": 3400 if is_male else 2600,
            "selenium_ug": 55, "iodine_ug": 150, "sodium_limit_mg": 2300
        },
        "omega3": {"ala_g": 1.6 if is_male else 1.1, "epa_mg": 250, "dha_mg": 250},
        "preferences": {
            "diet": eng_diet,
            "allergies": survey.allergies or [],
            "dislikes": survey.dislikes or [],
            "jain": survey.jain or False
        }
    }

@app.post("/api/generate-plan")
def generate_plan(survey: UserSurveyRequest):
    try:
        raw_sheet = calculate_sheet_from_survey(survey)
        sheet = sheet_to_engine(raw_sheet, survey.protein_level)
        result = recommend_meals(sheet, include_supplements=survey.include_supplements)
        if result.get("status") != "ok":
            result = recommend(sheet, include_supplements=survey.include_supplements)
        
        # just saving date wise enteries bc people might want them hehe 
        history = load_history()
        username = survey.name.strip().lower()
        if username not in history:
            history[username] = []
        
        today_date = datetime.now().strftime("%Y-%m-%d %H:%M")
        log_entry = {
            "date": today_date,
            "goal": survey.goal,
            "target_kcal": raw_sheet["energy"]["target_calories"],
            "meals": result.get("meals", {})
        }
        # keeping the recent people logged in logged in , a real common trick , using  FAST API btw 
        history[username].insert(0, log_entry)
        save_history(history)

        return {"success": True, "sheet": raw_sheet, "plan": result, "history": history[username]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/history/{username}")
def get_user_history(username: str):
    history = load_history()
    u = username.strip().lower()
    return {"success": True, "history": history.get(u, [])}

@app.post("/api/download-pdf")
def download_pdf(survey: UserSurveyRequest):
    try:
        raw_sheet = calculate_sheet_from_survey(survey)
        sheet = sheet_to_engine(raw_sheet, survey.protein_level)
        result = recommend_meals(sheet, include_supplements=survey.include_supplements)
        if result.get("status") != "ok":
            result = recommend(sheet, include_supplements=survey.include_supplements)

        pdf_path = f"Personalized_Nutrition_{survey.name.replace(' ', '_')}.pdf"
        doc = SimpleDocTemplate(pdf_path, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(name="TitleStyle", parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor("#2e7d32"), spaceAfter=12)
        heading_style = ParagraphStyle(name="HeadingStyle", parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor("#1b5e20"), spaceBefore=10, spaceAfter=6)
        normal_style = styles['Normal']

        story.append(Paragraph(f"Personalized Nutrition & Training Plan", title_style))
        story.append(Paragraph(f"Prepared for: <b>{survey.name}</b> ({survey.age} yrs, {survey.sex}, {survey.height} cm, {survey.weight} kg) | Goal: {survey.goal}", normal_style))
        story.append(Spacer(1, 12))

        story.append(Paragraph("1. Calorie & Macro Targets", heading_style))
        energy_data = [
            ["Metric", "Value"],
            ["BMR (Mifflin-St Jeor)", f"{raw_sheet['energy']['bmr']} kcal"],
            ["TDEE (Maintenance)", f"{raw_sheet['energy']['tdee']} kcal"],
            ["Target Calories", f"{raw_sheet['energy']['target_calories']} kcal"],
            ["Protein Target", f"{raw_sheet['protein'][survey.protein_level]['g']} g"],
            ["Fat Target", f"{raw_sheet['fat']['target_g']} g"],
            ["Carbs Target", f"{raw_sheet['carbs_g'][survey.protein_level]} g"],
            ["Water Target", f"{raw_sheet['water_ml'][survey.water_level]} ml"]
        ]
        t = Table(energy_data, colWidths=[200, 250])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#c8e6c9")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#1b5e20")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0,0), (-1,0), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#c8e6c9"))
        ]))
        story.append(t)
        story.append(Spacer(1, 12))

        story.append(Paragraph("2. Recommended Daily Meal Plan", heading_style))
        if "meals" in result:
            for meal_name, meal_data in result["meals"].items():
                story.append(Paragraph(f"<b>{meal_name.upper()}</b> — {meal_data['kcal']} kcal (Protein: {meal_data['protein']}g)", normal_style))
                food_rows = [["Food Item", "Quantity", "State", "Substitutes"]]
                for f in meal_data["foods"]:
                    food_rows.append([f["name"], f"{f['grams']} g", f["state"], ", ".join(f["swaps"][:2]) if f["swaps"] else "-"])
                ft = Table(food_rows, colWidths=[150, 70, 70, 210])
                ft.setStyle(TableStyle([
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0,0), (-1,-1), 9),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ]))
                story.append(ft)
                story.append(Spacer(1, 8))

        doc.build(story)
        return FileResponse(pdf_path, media_type='application/pdf', filename=os.path.basename(pdf_path))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}

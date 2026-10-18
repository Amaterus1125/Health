# NutriFlow: Personalized Indian Nutrition Planner

NutriFlow is a food recommendation system that turns a person's body metrics, goal and dietary restrictions into a complete, portion-sized Indian meal plan. It combines a nutrition calculator, a constraint-based optimizer and a nearest-neighbour substitution model behind a FastAPI backend, with a React web interface for interaction, charts, history and PDF export.

Live application: https://health-web-goal.onrender.com
Repository: https://github.com/Amaterus1125/Health

---

## Table of Contents

1. [Features](#features)
2. [How It Works](#how-it-works)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Command Line Usage](#command-line-usage)
7. [Web Interface](#web-interface)
8. [API Reference](#api-reference)
9. [Evaluation](#evaluation)
10. [Known Limitations](#known-limitations)
11. [Roadmap](#roadmap)
12. [Disclaimer](#disclaimer)

---

## Features

- Personalized calorie, macronutrient, fibre, water and micronutrient targets from age, sex, height, weight, activity level and goal (lose, maintain, gain).
- Whole-day or meal-wise plans (breakfast, lunch, snack, dinner) with gram-level portions for each food.
- Dietary filters: vegetarian, vegan, eggetarian and non-vegetarian, plus allergens, disliked foods and Jain rules.
- Three protein tiers (minimum, optimum, maximum) that also shift the carbohydrate target.
- Optional whey protein supplement.
- Substitution suggestions for every food, chosen by nutritional similarity within the same food group.
- Automatic validation of every plan for diet, allergy and portion violations, and for calorie and protein accuracy.
- Optional user accounts by username, with a date-wise history of generated plans.
- Downloadable PDF report of the full plan.
- Interactive charts and clickable meal cards in the web interface.
- Reproducible evaluation harness that compares the optimizer against greedy and random baselines.

---

## How It Works

The system runs in four stages. Each stage lives in its own module so it can be tested and improved independently.

### 1. Nutrition calculator (`app.py`)

The calculator converts the user's profile into a nutrition sheet.

| Quantity | Method |
| --- | --- |
| Basal metabolic rate | Mifflin-St Jeor equation |
| Daily energy expenditure | BMR multiplied by the activity factor (1.2 to 1.9) |
| Calorie target | Expenditure minus 400 kcal (lose), unchanged (maintain) or plus 400 kcal (gain), with a floor of 1500 kcal for men and 1200 kcal for women |
| Fat | 30 percent of calories |
| Protein | 0.8, 1.6 or 2.2 g per kg of body weight (minimum, optimum, maximum) |
| Carbohydrates | Remaining calories after protein and fat |
| Fibre | 14 g per 1000 kcal |
| Water | 35, 45 or 55 ml per kg (normal, moderate, extreme activity) |
| Micronutrients | Sex-specific recommended intakes for vitamins and minerals |

### 2. Food filtering (`engine.py`)

The food table (`indian_foods_final.csv`) holds 189 Indian foods with per-100 g nutrient values, a food group, a diet level, allergen tags, a Jain-compatibility flag, a typical and maximum portion size, and a popularity score. Before optimization, foods are removed if they:

- exceed the user's diet level (for example, meat for a vegetarian),
- contain any of the user's allergens,
- match a disliked food name,
- are not Jain-compatible when Jain rules are on, or
- are supplements when supplements were not requested.

### 3. Constraint optimizer (`engine.py`, `meals.py`)

Plan generation is a mixed-integer linear program solved with PuLP and the CBC solver. The decision variables are the grams of each food and a binary flag for whether the food is used at all. The objective is a weighted sum of deviations from the targets: calories are matched from both sides, while protein, fibre and most micronutrients only penalize a shortfall. The objective also prefers commonly eaten foods and normal portion sizes.

Hard rules keep the plan safe and realistic:

| Rule | Value |
| --- | --- |
| Maximum distinct foods per day | 14 |
| Maximum share of calories from a single food | 35 percent |
| Minimum portion | 40 percent of the typical portion |
| Upper limits for retinol, iron, zinc and calcium | Enforced as hard caps |
| Saturated fat | At most 10 percent of calories |
| Sodium | At most 2300 mg |
| Leafy greens and vegetables | At least 200 g per day |
| Fruit | At least 100 g per day |
| Animal foods | At most 400 g per day, with a minimum for egg and non-veg diets |
| Raw and cooked versions of the same food | Never both in one plan |
| Food-group caps | For oils, nuts, dairy, pulses, cereals and others |

The meal-wise planner in `meals.py` solves the same problem with an extra meal dimension:

- Calorie shares: breakfast 25 percent, lunch 35 percent, snack 10 percent, dinner 30 percent.
- Each meal has a minimum share of the day's protein and a limit on the number of foods.
- Foods are tagged to the meals where they make sense (oats and poha at breakfast, dal and roti at lunch and dinner, fruit and nuts as snacks).
- Lunch and dinner must include a cereal base worth at least 20 percent of the meal's calories and at least 80 g of vegetables.
- If the meal-wise solve does not return an optimal result, the API falls back to the whole-day planner.

### 4. Substitution model (`engine.py`)

Each recommended food comes with up to three swaps. The swaps come from a k-nearest-neighbours search over 13 nutrient features (energy, macronutrients, fibre, iron, calcium, zinc, magnesium, potassium, vitamin A, vitamin C, folate). Nutrient values are log-transformed and standardized because they are heavily skewed, and neighbours are searched only within the same food group and the user's allowed food pool, so a swap never breaks a dietary restriction.

### Validation

After a plan is generated, `check()` flags any diet, allergy or portion violation, a calorie total that is off by more than 5 percent, and protein below 95 percent of target.

### Nutrients outside the optimizer

The food table does not hold reliable data for vitamin D, B12, E, K, other B vitamins, selenium, iodine and omega-3. These are listed in the nutrition sheet as targets but are not optimized.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Backend API | FastAPI, Uvicorn, Pydantic |
| Optimization | PuLP with the CBC solver |
| Machine learning | scikit-learn (StandardScaler, NearestNeighbors), NumPy, pandas |
| PDF export | ReportLab |
| Frontend | React 19, Vite, Recharts, Lucide icons |
| Deployment | Render (frontend and backend) |

---

## Project Structure

```
Health/
|-- app.py                   FastAPI server: calculator, plan, history and PDF endpoints
|-- engine.py                Food filtering, whole-day optimizer, KNN substitutes, validation
|-- meals.py                 Meal-wise optimizer (breakfast, lunch, snack, dinner)
|-- run.py                   Command line runner and sheet-to-engine conversion
|-- evaluate.py              Evaluation harness (optimizer vs greedy vs random)
|-- sheet.json               Example nutrition sheet used by run.py
|-- indian_foods_final.csv   Food composition table (189 foods)
|-- eval_results.csv         Saved output of evaluate.py
|-- requirements.txt         Python dependencies
|-- index.html               Vite entry point
|-- src/                     React application (App.jsx and styles)
|-- public/                  Static assets
|-- package.json             Frontend dependencies and scripts
|-- vite.config.js           Vite configuration
`-- eslint.config.js         Lint configuration
```

---

## Getting Started

### Prerequisites

- Python 3.9 or newer
- Node.js 18 or newer and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Amaterus1125/Health.git
cd Health
```

### 2. Start the backend

Create a virtual environment, install the dependencies and run the API.

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

The API is now available at http://localhost:8000, and interactive documentation is served at http://localhost:8000/docs.

### 3. Start the frontend

In a second terminal, from the project root:

```bash
npm install
npm run dev
```

Open the address printed by Vite (usually http://localhost:5173). When the page is served from `localhost`, the frontend automatically talks to the backend on port 8000. On any other host it uses the deployed backend.

### 4. Production build of the frontend

```bash
npm run build
npm run preview
```

---

## Command Line Usage

The optimizer can be used without the web interface. `run.py` reads a nutrition sheet (see `sheet.json`) and prints the plan, the nutrient coverage and the automatic check result.

```bash
# Whole-day plan from sheet.json
python run.py

# Split into breakfast, lunch, snack and dinner
python run.py --meals

# Use a different sheet, target the maximum protein tier, allow whey, save the result
python run.py sheet.json --meals --protein maximum --supplements --out result.json
```

| Option | Meaning |
| --- | --- |
| `file` | Path to the sheet JSON (default `sheet.json`) |
| `--protein` | `minimum`, `optimum` (default) or `maximum` |
| `--meals` | Produce a meal-wise plan |
| `--supplements` | Allow whey protein in the plan |
| `--out` | Also save the full result as JSON |

The `preferences` block of the sheet controls the diet (`vegetarian`, `vegan`, `egg`, `nonveg`), allergies, dislikes, the Jain flag and optional custom meal shares.

---

## Web Interface

The interface is a two-step flow.

**Assessment form.** The user enters name, age, sex, height, weight, activity level, goal, diet, protein tier and whether to include whey. An optional "Enable Login and History" switch asks for a unique username so that past plans can be retrieved later; the username is remembered in the browser.

**Dashboard.** After generation the dashboard shows:

- Summary cards for BMR, daily expenditure, calorie target, protein, fat and water.
- Meal cards for each meal with foods, portions, cooked or raw state and swap suggestions. Clicking a card opens a detailed breakdown with the full list of substitutions.
- A macronutrient caloric split chart (protein, carbohydrates, fat) computed from the user's own targets.
- A micronutrient adequacy chart showing percentage of recommended intake.
- Clickable chart cards that open a short explanation of what is being plotted.
- A date-wise history of earlier plans for users who enabled login.
- A button to download the plan as a PDF report.

---

## API Reference

Base URL (local): `http://localhost:8000`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/generate-plan` | Calculate targets, generate a meal plan and record it in the user's history |
| POST | `/api/download-pdf` | Generate and return the plan as a PDF |
| GET | `/api/history/{username}` | Return past plans for a user |
| GET | `/health` | Service health check |

Example request body for `/api/generate-plan`:

```json
{
  "name": "Asha",
  "age": 28,
  "sex": "female",
  "height": 162,
  "weight": 60,
  "activity": 1.375,
  "goal": "maintain",
  "diet": "vegetarian",
  "water_level": "moderate",
  "allergies": ["peanut"],
  "dislikes": ["brinjal"],
  "jain": false,
  "protein_level": "optimum",
  "include_supplements": false
}
```

The response contains `success`, the calculated `sheet`, the generated `plan` (meals, nutrient totals, coverage and any nutrient gaps) and the user's `history`.

---

## Evaluation

`evaluate.py` measures how good the optimizer is rather than assuming it. It generates synthetic user profiles with a fixed random seed (42) covering ages 18 to 50, both sexes, all four diets, random allergies and dislikes, and Jain rules, then compares:

- the **optimizer** (this project's method),
- a **greedy** baseline that adds one food at a time to reduce the same weighted deviation, and
- a **random** baseline with random foods scaled to the calorie target.

Metrics include calorie error, macronutrient error, protein coverage, micronutrient adequacy, upper-limit violations, diet and allergy violations, saturated fat share, number of foods, food popularity and runtime. Methods are compared with paired Wilcoxon signed-rank tests, and per-profile results are written to `eval_results.csv`.

```bash
python evaluate.py              # 40 profiles
python evaluate.py 100          # 100 profiles
python evaluate.py 40 --meals   # also evaluate the meal-wise planner
```

The script also asserts that the calculator reproduces three worked examples from the nutrition formula guide before it runs.

---

## Known Limitations

- User history is stored in a local JSON file (`user_history.json`). This is suitable for development and demonstrations, not for multi-user production use, and the file is lost when a free hosting instance is rebuilt.
- Login is identifier-based and has no password or authentication.
- The food table covers 189 foods; plans are only as varied as the table.
- Nutrients without reliable data in the food table are not optimized (see above).
- The solver has a time limit (30 seconds for the whole-day planner, 90 seconds for the meal-wise planner). Very strict filter combinations can return no feasible plan.

---

## Roadmap

Planned work, roughly in order of priority.

**Deep learning extension.** The current system is fully classical: a calculator, an exact optimizer and a nearest-neighbour model. Because the optimizer searches the entire allowed food pool, solve time grows with the size of the food table. The planned next step is a learned layer on top of the optimizer rather than a replacement for it:

- A neural model that proposes a shortlist of promising foods for a given profile and target set, so the optimizer only solves over that subset and returns faster.
- Attention-based modelling of food combinations, so that foods that are commonly eaten together (for example, lentils with rice) are scored jointly instead of independently.
- Learning food preferences from the stored plan history, so recommendations improve with use.
- Keeping the optimizer as the final step, so every plan still passes the hard safety rules for allergies, diet, portion limits and upper intake levels.

**Product and data.**

- Replace the JSON history file with a proper database and add real authentication.
- Expand the food table with more regional dishes, composite recipes and reliable data for vitamin D, B12, omega-3 and the other nutrients not yet optimized.
- Multi-day planning with variety constraints so the same meals do not repeat.
- Feedback buttons (like, dislike, swap) that feed back into the preference model.
- Weight and progress tracking charts built on the history records.
- Cuisine and budget filters, and grocery list export.

---

## Disclaimer

NutriFlow provides general nutrition information and is not a substitute for professional medical or dietetic advice. People with medical conditions, allergies, pregnancy, or specific clinical dietary needs should consult a qualified professional before changing their diet.

---

## Author

Maintained by Harshit (GitHub: [Amaterus1125](https://github.com/Amaterus1125)).

## LICENSE 

Apache 2.0 LICENSE (see the LICENSE page for more information).

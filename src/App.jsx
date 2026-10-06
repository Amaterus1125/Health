import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

/* =========================================================
   DEFAULT USER
========================================================= */

const defaultUser = {
  id: 1,
  name: "Anubhav",
  age: 20,
  height: 175,
  weight: 68,
  activity: "Moderately Active",
  goal: "Maintain Weight",
  diet: "Vegetarian",
  mealsPerDay: 4,
  waterTarget: 8,
};

/* =========================================================
   DEFAULT MEALS
========================================================= */

const defaultMeals = [
  {
    id: 1,
    type: "Breakfast",
    time: "08:00 AM",
    name: "Paneer Moong Chilla",
    calories: 420,
    protein: 24,
    carbs: 46,
    fats: 14,
  },
  {
    id: 2,
    type: "Lunch",
    time: "01:30 PM",
    name: "Dal, Rice & Salad",
    calories: 560,
    protein: 22,
    carbs: 78,
    fats: 14,
  },
  {
    id: 3,
    type: "Snack",
    time: "05:00 PM",
    name: "Fruit & Greek Yogurt",
    calories: 220,
    protein: 14,
    carbs: 30,
    fats: 5,
  },
  {
    id: 4,
    type: "Dinner",
    time: "08:30 PM",
    name: "Paneer Tikka Bowl",
    calories: 510,
    protein: 31,
    carbs: 42,
    fats: 19,
  },
];

/* =========================================================
   WEEKLY DATA
========================================================= */

const weeklyData = [
  { day: "Mon", calories: 1860 },
  { day: "Tue", calories: 2010 },
  { day: "Wed", calories: 1940 },
  { day: "Thu", calories: 2100 },
  { day: "Fri", calories: 1880 },
  { day: "Sat", calories: 2200 },
  { day: "Sun", calories: 1980 },
];

/* =========================================================
   SAFE USER CHECK
========================================================= */

function isValidUser(user) {
  return (
    user &&
    typeof user === "object" &&
    typeof user.id !== "undefined" &&
    typeof user.name === "string" &&
    typeof user.age === "number" &&
    typeof user.height === "number" &&
    typeof user.weight === "number"
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  /* =======================================================
     THEME
  ======================================================= */

  const [darkMode, setDarkMode] = useState(true);

  /* =======================================================
     ACTIVE PAGE
  ======================================================= */

  const [activePage, setActivePage] = useState("Dashboard");

  /* =======================================================
     USERS
  ======================================================= */

  const [users, setUsers] = useState(() => {
    try {
      const savedUsers = localStorage.getItem("nutriflow_users");

      if (!savedUsers) {
        return [defaultUser];
      }

      const parsedUsers = JSON.parse(savedUsers);

      if (!Array.isArray(parsedUsers)) {
        return [defaultUser];
      }

      const validUsers = parsedUsers.filter(isValidUser);

      if (validUsers.length === 0) {
        return [defaultUser];
      }

      return validUsers;
    } catch (error) {
      console.error("Could not load users:", error);
      return [defaultUser];
    }
  });

  /* =======================================================
     ACTIVE USER
  ======================================================= */

  const [activeUserId, setActiveUserId] = useState(() => {
    try {
      const savedId = localStorage.getItem("nutriflow_active_user");

      return savedId ? Number(savedId) : 1;
    } catch {
      return 1;
    }
  });

  const activeUser =
    users.find((user) => user.id === activeUserId) || users[0];

  /* =======================================================
     MEALS
  ======================================================= */

  const [meals, setMeals] = useState(() => {
    try {
      const savedMeals = localStorage.getItem("nutriflow_meals");

      if (!savedMeals) {
        return defaultMeals;
      }

      const parsed = JSON.parse(savedMeals);

      return Array.isArray(parsed) ? parsed : defaultMeals;
    } catch {
      return defaultMeals;
    }
  });

  /* =======================================================
     WATER
  ======================================================= */

  const [waterCount, setWaterCount] = useState(5);

  /* =======================================================
     ACCOUNT MENU
  ======================================================= */

  const [showAccountMenu, setShowAccountMenu] = useState(false);

  /* =======================================================
     CREATE USER MODAL
  ======================================================= */

  const [showCreateForm, setShowCreateForm] = useState(false);

  /* =======================================================
     ADD MEAL MODAL
  ======================================================= */

  const [showMealForm, setShowMealForm] = useState(false);

  /* =======================================================
     MOBILE SIDEBAR
  ======================================================= */

  const [mobileMenu, setMobileMenu] = useState(false);

  /* =======================================================
     FORM
  ======================================================= */

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    height: "",
    weight: "",
    activity: "Sedentary",
    goal: "Maintain Weight",
    diet: "Vegetarian",
    mealsPerDay: "3",
    waterTarget: "8",
  });

  /* =======================================================
     MEAL FORM
  ======================================================= */

  const [mealForm, setMealForm] = useState({
    type: "Breakfast",
    time: "08:00 AM",
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
  });

  /* =======================================================
     SAVE USERS
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      "nutriflow_users",
      JSON.stringify(users)
    );
  }, [users]);

  /* =======================================================
     SAVE ACTIVE USER
  ======================================================= */

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem(
        "nutriflow_active_user",
        String(activeUser.id)
      );
    }
  }, [activeUser]);

  /* =======================================================
     SAVE MEALS
  ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      "nutriflow_meals",
      JSON.stringify(meals)
    );
  }, [meals]);

  /* =======================================================
     TOTAL NUTRITION
  ======================================================= */

  const totals = useMemo(() => {
    return meals.reduce(
      (total, meal) => {
        total.calories += Number(meal.calories) || 0;
        total.protein += Number(meal.protein) || 0;
        total.carbs += Number(meal.carbs) || 0;
        total.fats += Number(meal.fats) || 0;

        return total;
      },
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      }
    );
  }, [meals]);

  /* =======================================================
     CALORIE TARGET
  ======================================================= */

  const calorieTarget = useMemo(() => {
    if (!activeUser) return 2100;

    let base = 10 * activeUser.weight + 6.25 * activeUser.height - 5 * activeUser.age;

    if (activeUser.activity === "Sedentary") {
      base *= 1.2;
    } else if (activeUser.activity === "Lightly Active") {
      base *= 1.375;
    } else if (activeUser.activity === "Moderately Active") {
      base *= 1.55;
    } else {
      base *= 1.725;
    }

    if (activeUser.goal === "Lose Weight") {
      base -= 300;
    }

    if (activeUser.goal === "Gain Weight") {
      base += 300;
    }

    if (activeUser.goal === "Build Muscle") {
      base += 200;
    }

    return Math.max(1200, Math.round(base));
  }, [activeUser]);

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =======================================================
     CREATE USER
  ======================================================= */

  const createUser = (event) => {
    event.preventDefault();

    if (
      !formData.name ||
      !formData.age ||
      !formData.height ||
      !formData.weight
    ) {
      alert("Please fill all required fields.");
      return;
    }

    const newUser = {
      id: Date.now(),
      name: formData.name.trim(),
      age: Number(formData.age),
      height: Number(formData.height),
      weight: Number(formData.weight),
      activity: formData.activity,
      goal: formData.goal,
      diet: formData.diet,
      mealsPerDay: Number(formData.mealsPerDay),
      waterTarget: Number(formData.waterTarget),
    };

    setUsers((previousUsers) => [
      ...previousUsers,
      newUser,
    ]);

    setActiveUserId(newUser.id);

    setFormData({
      name: "",
      age: "",
      height: "",
      weight: "",
      activity: "Sedentary",
      goal: "Maintain Weight",
      diet: "Vegetarian",
      mealsPerDay: "3",
      waterTarget: "8",
    });

    setShowCreateForm(false);
    setShowAccountMenu(false);
    setActivePage("Dashboard");
  };

  /* =======================================================
     DELETE USER
  ======================================================= */

  const deleteUser = (userId) => {
    if (users.length === 1) {
      alert("You need at least one account.");
      return;
    }

    const updatedUsers = users.filter(
      (user) => user.id !== userId
    );

    setUsers(updatedUsers);

    if (activeUserId === userId) {
      setActiveUserId(updatedUsers[0].id);
    }
  };

  /* =======================================================
     MEAL FORM CHANGE
  ======================================================= */

  const handleMealChange = (event) => {
    const { name, value } = event.target;

    setMealForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /* =======================================================
     ADD MEAL
  ======================================================= */

  const addMeal = (event) => {
    event.preventDefault();

    if (
      !mealForm.name ||
      !mealForm.calories ||
      !mealForm.protein ||
      !mealForm.carbs ||
      !mealForm.fats
    ) {
      alert("Please fill all meal fields.");
      return;
    }

    const newMeal = {
      id: Date.now(),
      type: mealForm.type,
      time: mealForm.time,
      name: mealForm.name,
      calories: Number(mealForm.calories),
      protein: Number(mealForm.protein),
      carbs: Number(mealForm.carbs),
      fats: Number(mealForm.fats),
    };

    setMeals((previousMeals) => [
      ...previousMeals,
      newMeal,
    ]);

    setMealForm({
      type: "Breakfast",
      time: "08:00 AM",
      name: "",
      calories: "",
      protein: "",
      carbs: "",
      fats: "",
    });

    setShowMealForm(false);
  };

  /* =======================================================
     DELETE MEAL
  ======================================================= */

  const deleteMeal = (mealId) => {
    setMeals((previousMeals) =>
      previousMeals.filter((meal) => meal.id !== mealId)
    );
  };

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigate = (page) => {
    setActivePage(page);
    setMobileMenu(false);
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>

      {/* BACKGROUND */}

      <div className="food-background"></div>
      <div className="background-overlay"></div>

      {/* MOBILE OVERLAY */}

      {mobileMenu && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenu(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`sidebar glass ${
          mobileMenu ? "sidebar-open" : ""
        }`}
      >

        {/* LOGO */}

        <div className="logo-area">

          <div className="logo-icon">
            ✦
          </div>

          <div>
            <h2>HealthyMe</h2>
            <span>Daily wellness</span>
          </div>

        </div>

        {/* NAVIGATION */}

        <div className="sidebar-section">

          <p className="section-title">
            MAIN
          </p>

          <button
            className={`nav-button ${
              activePage === "Dashboard"
                ? "active"
                : ""
            }`}
            onClick={() => navigate("Dashboard")}
          >
            <span>▦</span>
            Dashboard
          </button>

          <button
            className={`nav-button ${
              activePage === "My Meals"
                ? "active"
                : ""
            }`}
            onClick={() => navigate("My Meals")}
          >
            <span>🍽</span>
            My Meals
          </button>

          <button
            className={`nav-button ${
              activePage === "Weekly Plan"
                ? "active"
                : ""
            }`}
            onClick={() => navigate("Weekly Plan")}
          >
            <span>📅</span>
            Weekly Plan
          </button>

          <button
            className={`nav-button ${
              activePage === "Progress"
                ? "active"
                : ""
            }`}
            onClick={() => navigate("Progress")}
          >
            <span>📈</span>
            Progress
          </button>

        </div>

        {/* ACCOUNT */}

        <div className="sidebar-section">

          <p className="section-title">
            ACCOUNT
          </p>

          <button
            className="account-button"
            onClick={() =>
              setShowAccountMenu(
                !showAccountMenu
              )
            }
          >

            <div className="avatar">
              {activeUser?.name
                ?.charAt(0)
                .toUpperCase()}
            </div>

            <div className="account-info">
              <strong>
                {activeUser?.name || "User"}
              </strong>

              <span>
                Current account
              </span>
            </div>

            <span className="arrow">
              {showAccountMenu ? "▲" : "▼"}
            </span>

          </button>

          {showAccountMenu && (

            <div className="account-menu glass">

              <h4>Your Accounts</h4>

              {users.map((user) => (

                <div
                  className={`user-row ${
                    activeUser?.id === user.id
                      ? "selected-user"
                      : ""
                  }`}
                  key={user.id}
                >

                  <button
                    className="user-select"
                    onClick={() => {
                      setActiveUserId(user.id);
                      setShowAccountMenu(false);
                    }}
                  >

                    <div className="small-avatar">
                      {user.name
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div>
                      <strong>
                        {user.name}
                      </strong>

                      <small>
                        {user.goal}
                      </small>
                    </div>

                  </button>

                  {users.length > 1 && (

                    <button
                      className="delete-user"
                      onClick={() =>
                        deleteUser(user.id)
                      }
                    >
                      ×
                    </button>

                  )}

                </div>

              ))}

              <button
                className="create-account-button"
                onClick={() => {
                  setShowCreateForm(true);
                  setShowAccountMenu(false);
                }}
              >
                + Create New Account
              </button>

            </div>

          )}

        </div>

        {/* LIGHT/DARK MODE */}

        <div className="theme-area">

          <button
            className="theme-button"
            onClick={() =>
              setDarkMode(!darkMode)
            }
          >
            {darkMode
              ? "☀️ Light Mode"
              : "🌙 Dark Mode"}
          </button>

        </div>

        {/* TIP */}

        <div className="sidebar-bottom">

          <div className="tip">

            <span>💡</span>

            <div>
              <strong>
                Small steps matter
              </strong>

              <p>
                Consistency is more important
                than perfection.
              </p>
            </div>

          </div>

        </div>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <main className="main-content">

        {/* MOBILE TOP BAR */}

        <div className="mobile-top glass">

          <button
            className="hamburger"
            onClick={() =>
              setMobileMenu(!mobileMenu)
            }
          >
            ☰
          </button>

          <strong>
            NutriFlow
          </strong>

        </div>

        {/* ===================================================
            DASHBOARD
        =================================================== */}

        {activePage === "Dashboard" && (

          <Dashboard
            activeUser={activeUser}
            calorieTarget={calorieTarget}
            totals={totals}
            waterCount={waterCount}
            setWaterCount={setWaterCount}
            meals={meals}
            setShowMealForm={setShowMealForm}
          />

        )}

        {/* ===================================================
            MEALS
        =================================================== */}

        {activePage === "My Meals" && (

          <MealsPage
            meals={meals}
            deleteMeal={deleteMeal}
            setShowMealForm={setShowMealForm}
            totals={totals}
          />

        )}

        {/* ===================================================
            WEEKLY
        =================================================== */}

        {activePage === "Weekly Plan" && (

          <WeeklyPage
            activeUser={activeUser}
          />

        )}

        {/* ===================================================
            PROGRESS
        =================================================== */}

        {activePage === "Progress" && (

          <ProgressPage
            calorieTarget={calorieTarget}
            totals={totals}
          />

        )}

      </main>

      {/* =====================================================
          CREATE USER MODAL
      ===================================================== */}

      {showCreateForm && (

        <div className="modal-overlay">

          <div className="create-form glass">

            <div className="form-header">

              <div>

                <span>
                  NEW ACCOUNT
                </span>

                <h2>
                  Create User Profile
                </h2>

                <p>
                  Enter basic information to
                  personalize the nutrition dashboard.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowCreateForm(false)
                }
              >
                ×
              </button>

            </div>

            <form onSubmit={createUser}>

              <div className="form-group full">

                <label>
                  Full Name *
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Enter full name"
                  required
                />

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Age *
                  </label>

                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleFormChange}
                    placeholder="20"
                    min="1"
                    max="120"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Height (cm) *
                  </label>

                  <input
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleFormChange}
                    placeholder="175"
                    min="50"
                    max="250"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Weight (kg) *
                  </label>

                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleFormChange}
                    placeholder="68"
                    min="10"
                    max="300"
                    required
                  />

                </div>

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Activity Level
                  </label>

                  <select
                    name="activity"
                    value={formData.activity}
                    onChange={handleFormChange}
                  >
                    <option>
                      Sedentary
                    </option>

                    <option>
                      Lightly Active
                    </option>

                    <option>
                      Moderately Active
                    </option>

                    <option>
                      Very Active
                    </option>
                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Nutrition Goal
                  </label>

                  <select
                    name="goal"
                    value={formData.goal}
                    onChange={handleFormChange}
                  >
                    <option>
                      Lose Weight
                    </option>

                    <option>
                      Maintain Weight
                    </option>

                    <option>
                      Gain Weight
                    </option>

                    <option>
                      Build Muscle
                    </option>
                  </select>

                </div>

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Diet Preference
                  </label>

                  <select
                    name="diet"
                    value={formData.diet}
                    onChange={handleFormChange}
                  >
                    <option>
                      Vegetarian
                    </option>

                    <option>
                      Non-Vegetarian
                    </option>

                    <option>
                      Vegan
                    </option>

                    <option>
                      Eggetarian
                    </option>
                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Meals Per Day
                  </label>

                  <select
                    name="mealsPerDay"
                    value={formData.mealsPerDay}
                    onChange={handleFormChange}
                  >
                    <option value="2">
                      2 meals
                    </option>

                    <option value="3">
                      3 meals
                    </option>

                    <option value="4">
                      4 meals
                    </option>

                    <option value="5">
                      5 meals
                    </option>

                    <option value="6">
                      6 meals
                    </option>
                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Water Target
                  </label>

                  <select
                    name="waterTarget"
                    value={formData.waterTarget}
                    onChange={handleFormChange}
                  >
                    <option value="6">
                      6 glasses
                    </option>

                    <option value="7">
                      7 glasses
                    </option>

                    <option value="8">
                      8 glasses
                    </option>

                    <option value="9">
                      9 glasses
                    </option>

                    <option value="10">
                      10 glasses
                    </option>
                  </select>

                </div>

              </div>

              <div className="form-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowCreateForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-button"
                >
                  Create Account →
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          ADD MEAL MODAL
      ===================================================== */}

      {showMealForm && (

        <div className="modal-overlay">

          <div className="create-form glass meal-form">

            <div className="form-header">

              <div>

                <span>
                  ADD FOOD
                </span>

                <h2>
                  Add a Meal
                </h2>

                <p>
                  Add today's food and nutrition values.
                </p>

              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowMealForm(false)
                }
              >
                ×
              </button>

            </div>

            <form onSubmit={addMeal}>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Meal Type
                  </label>

                  <select
                    name="type"
                    value={mealForm.type}
                    onChange={handleMealChange}
                  >
                    <option>
                      Breakfast
                    </option>

                    <option>
                      Lunch
                    </option>

                    <option>
                      Snack
                    </option>

                    <option>
                      Dinner
                    </option>
                  </select>

                </div>

                <div className="form-group">

                  <label>
                    Time
                  </label>

                  <input
                    type="text"
                    name="time"
                    value={mealForm.time}
                    onChange={handleMealChange}
                    placeholder="08:00 AM"
                  />

                </div>

              </div>

              <div className="form-group full">

                <label>
                  Food / Meal Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={mealForm.name}
                  onChange={handleMealChange}
                  placeholder="e.g. Vegetable Oats"
                  required
                />

              </div>

              <div className="form-row">

                <div className="form-group">

                  <label>
                    Calories
                  </label>

                  <input
                    type="number"
                    name="calories"
                    value={mealForm.calories}
                    onChange={handleMealChange}
                    placeholder="350"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Protein (g)
                  </label>

                  <input
                    type="number"
                    name="protein"
                    value={mealForm.protein}
                    onChange={handleMealChange}
                    placeholder="20"
                    required
                  />

                </div>

                <div className="form-group">

                  <label>
                    Carbs (g)
                  </label>

                  <input
                    type="number"
                    name="carbs"
                    value={mealForm.carbs}
                    onChange={handleMealChange}
                    placeholder="45"
                    required
                  />

                </div>

              </div>

              <div className="form-row single-row">

                <div className="form-group">

                  <label>
                    Fats (g)
                  </label>

                  <input
                    type="number"
                    name="fats"
                    value={mealForm.fats}
                    onChange={handleMealChange}
                    placeholder="12"
                    required
                  />

                </div>

              </div>

              <div className="form-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() =>
                    setShowMealForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="submit-button"
                >
                  Add Meal →
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  activeUser,
  calorieTarget,
  totals,
  waterCount,
  setWaterCount,
  meals,
  setShowMealForm,
}) {
  const caloriePercent = Math.min(
    100,
    Math.round(
      (totals.calories / calorieTarget) * 100
    )
  );

  return (
    <>
      <header className="top-header glass">

        <div>

          <span className="eyebrow">
            YOUR DAILY WELLNESS
          </span>

          <h1>
            Good morning, {activeUser.name} 👋
          </h1>

          <p>
            Here's your nutrition overview for today.
          </p>

        </div>

        <div className="profile-mini">

          <div className="avatar">
            {activeUser.name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {activeUser.name}
            </strong>

            <span>
              {activeUser.diet}
            </span>
          </div>

        </div>

      </header>

      {/* USER INFO */}

      <section className="user-info-grid">

        <InfoCard
          title="AGE"
          value={activeUser.age}
          unit="years"
        />

        <InfoCard
          title="HEIGHT"
          value={activeUser.height}
          unit="cm"
        />

        <InfoCard
          title="WEIGHT"
          value={activeUser.weight}
          unit="kg"
        />

        <InfoCard
          title="ACTIVITY"
          value={activeUser.activity}
        />

        <InfoCard
          title="GOAL"
          value={activeUser.goal}
        />

        <InfoCard
          title="DIET"
          value={activeUser.diet}
        />

      </section>

      {/* MAIN CARDS */}

      <section className="dashboard-grid">

        {/* ENERGY */}

        <div className="energy-card glass">

          <div className="card-heading">

            <div>
              <span>
                TODAY'S ENERGY
              </span>

              <h2>
                {totals.calories} /{" "}
                {calorieTarget} kcal
              </h2>
            </div>

            <span className="energy-icon">
              🔥
            </span>

          </div>

          <div
            className="progress-circle"
            style={{
              "--progress": `${caloriePercent}%`,
            }}
          >

            <div className="circle-inner">

              <strong>
                {caloriePercent}%
              </strong>

              <span>
                consumed
              </span>

            </div>

          </div>

          <p className="remaining">

            <strong>
              {Math.max(
                0,
                calorieTarget - totals.calories
              )}{" "}
              kcal
            </strong>{" "}
            remaining

          </p>

        </div>

        {/* MACROS */}

        <div className="macro-card glass">

          <div className="card-heading">

            <div>

              <span>
                MACRONUTRIENTS
              </span>

              <h2>
                Today's balance
              </h2>

            </div>

          </div>

          <Macro
            name="Protein"
            value={`${totals.protein}g`}
            target="125g"
            percent={Math.min(
              100,
              (totals.protein / 125) * 100
            )}
          />

          <Macro
            name="Carbs"
            value={`${totals.carbs}g`}
            target="250g"
            percent={Math.min(
              100,
              (totals.carbs / 250) * 100
            )}
          />

          <Macro
            name="Fats"
            value={`${totals.fats}g`}
            target="70g"
            percent={Math.min(
              100,
              (totals.fats / 70) * 100
            )}
          />

        </div>

        {/* WATER */}

        <div className="hydration-card glass">

          <div className="card-heading">

            <div>

              <span>
                HYDRATION
              </span>

              <h2>
                {waterCount} /{" "}
                {activeUser.waterTarget} glasses
              </h2>

            </div>

            <span className="water-icon">
              💧
            </span>

          </div>

          <div className="water-glasses">

            {Array.from(
              {
                length: activeUser.waterTarget,
              },
              (_, index) => {

                const glassNumber =
                  index + 1;

                return (
                  <button
                    key={glassNumber}
                    className={`water-glass ${
                      glassNumber <= waterCount
                        ? "filled"
                        : ""
                    }`}
                    onClick={() =>
                      setWaterCount(
                        glassNumber ===
                          waterCount
                          ? glassNumber - 1
                          : glassNumber
                      )
                    }
                  >
                    💧
                  </button>
                );

              }
            )}

          </div>

          <button
            className="primary-button"
            onClick={() =>
              setWaterCount(
                Math.min(
                  waterCount + 1,
                  activeUser.waterTarget
                )
              )
            }
          >
            + Add Glass
          </button>

        </div>

      </section>

      {/* MEALS */}

      <section className="section-heading">

        <div>

          <span>
            TODAY
          </span>

          <h2>
            Today's meals
          </h2>

        </div>

        <button
          className="outline-button"
          onClick={() =>
            setShowMealForm(true)
          }
        >
          + Add Food
        </button>

      </section>

      <section className="meals-list">

        {meals.map((meal) => (

          <div
            className="meal-card glass"
            key={meal.id}
          >

            <div className="meal-icon">
              {meal.type === "Breakfast"
                ? "🥣"
                : meal.type === "Lunch"
                ? "🍛"
                : meal.type === "Snack"
                ? "🍎"
                : "🍽️"}
            </div>

            <div className="meal-main">

              <span>
                {meal.type} · {meal.time}
              </span>

              <h3>
                {meal.name}
              </h3>

            </div>

            <div className="meal-nutrition">

              <strong>
                {meal.calories}
              </strong>

              <span>
                kcal
              </span>

            </div>

          </div>

        ))}

      </section>

      {/* SUGGESTIONS */}

      <section className="section-heading">

        <div>

          <span>
            SMART INSIGHTS
          </span>

          <h2>
            Suggestions for you
          </h2>

        </div>

      </section>

      <section className="suggestion-grid">

        <Suggestion
          icon="🥬"
          title="Add more greens"
          text="Try adding leafy vegetables to your next meal."
        />

        <Suggestion
          icon="🥛"
          title="Calcium boost"
          text="Yogurt, paneer or fortified milk can help."
        />

        <Suggestion
          icon="💪"
          title="Protein top-up"
          text="Consider a protein-rich snack today."
        />

      </section>
    </>
  );
}

/* =========================================================
   MEALS PAGE
========================================================= */

function MealsPage({
  meals,
  deleteMeal,
  setShowMealForm,
  totals,
}) {
  return (
    <>
      <header className="page-header glass">

        <div>

          <span>
            NUTRITION
          </span>

          <h1>
            My Meals 🍽️
          </h1>

          <p>
            Manage your food and daily nutrition.
          </p>

        </div>

        <button
          className="primary-button"
          onClick={() =>
            setShowMealForm(true)
          }
        >
          + Add Meal
        </button>

      </header>

      <section className="meal-summary-grid">

        <InfoCard
          title="CALORIES"
          value={totals.calories}
          unit="kcal"
        />

        <InfoCard
          title="PROTEIN"
          value={totals.protein}
          unit="g"
        />

        <InfoCard
          title="CARBS"
          value={totals.carbs}
          unit="g"
        />

        <InfoCard
          title="FATS"
          value={totals.fats}
          unit="g"
        />

      </section>

      <section className="full-meals-list">

        {meals.map((meal) => (

          <div
            className="large-meal-card glass"
            key={meal.id}
          >

            <div className="large-meal-left">

              <div className="meal-icon large">
                {meal.type === "Breakfast"
                  ? "🥣"
                  : meal.type === "Lunch"
                  ? "🍛"
                  : meal.type === "Snack"
                  ? "🍎"
                  : "🍽️"}
              </div>

              <div>

                <span>
                  {meal.type} · {meal.time}
                </span>

                <h2>
                  {meal.name}
                </h2>

              </div>

            </div>

            <div className="meal-values">

              <div>
                <strong>
                  {meal.calories}
                </strong>
                <span>kcal</span>
              </div>

              <div>
                <strong>
                  {meal.protein}g
                </strong>
                <span>protein</span>
              </div>

              <div>
                <strong>
                  {meal.carbs}g
                </strong>
                <span>carbs</span>
              </div>

              <div>
                <strong>
                  {meal.fats}g
                </strong>
                <span>fat</span>
              </div>

            </div>

            <button
              className="delete-meal"
              onClick={() =>
                deleteMeal(meal.id)
              }
            >
              🗑
            </button>

          </div>

        ))}

      </section>
    </>
  );
}

/* =========================================================
   WEEKLY PAGE
========================================================= */

function WeeklyPage({ activeUser }) {
  const [selectedDay, setSelectedDay] =
    useState("Monday");

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const plan = {
    Monday: [
      "Paneer Moong Chilla",
      "Dal, Rice & Salad",
      "Fruit & Yogurt",
      "Paneer Tikka Bowl",
    ],

    Tuesday: [
      "Vegetable Poha",
      "Rajma Rice",
      "Fruit Bowl",
      "Tofu Stir Fry",
    ],

    Wednesday: [
      "Oats & Banana",
      "Chole Rice",
      "Greek Yogurt",
      "Paneer Wrap",
    ],

    Thursday: [
      "Besan Chilla",
      "Dal Khichdi",
      "Nuts & Fruit",
      "Vegetable Paneer Bowl",
    ],

    Friday: [
      "Idli & Sambar",
      "Rajma Rice",
      "Yogurt",
      "Paneer Tikka",
    ],

    Saturday: [
      "Stuffed Paratha",
      "Dal & Roti",
      "Fruit Smoothie",
      "Tofu Bowl",
    ],

    Sunday: [
      "Vegetable Upma",
      "Paneer Rice Bowl",
      "Greek Yogurt",
      "Dal & Roti",
    ],
  };

  return (
    <>
      <header className="page-header glass">

        <div>

          <span>
            WEEKLY NUTRITION
          </span>

          <h1>
            Weekly Plan 📅
          </h1>

          <p>
            Personalized plan for{" "}
            {activeUser.name}.
          </p>

        </div>

      </header>

      <div className="day-selector glass">

        {days.map((day) => (

          <button
            key={day}
            className={
              selectedDay === day
                ? "day-button active"
                : "day-button"
            }
            onClick={() =>
              setSelectedDay(day)
            }
          >
            {day.slice(0, 3)}
          </button>

        ))}

      </div>

      <section className="weekly-plan glass">

        <div className="weekly-plan-header">

          <div>

            <span>
              {selectedDay.toUpperCase()}
            </span>

            <h2>
              Your meals
            </h2>

          </div>

          <div className="plan-calories">
            ~2,100 kcal
          </div>

        </div>

        <div className="weekly-meals">

          {plan[selectedDay].map(
            (meal, index) => (

              <div
                className="weekly-meal"
                key={`${selectedDay}-${meal}`}
              >

                <div className="meal-number">
                  {index + 1}
                </div>

                <div>

                  <span>
                    {index === 0
                      ? "Breakfast"
                      : index === 1
                      ? "Lunch"
                      : index === 2
                      ? "Snack"
                      : "Dinner"}
                  </span>

                  <h3>
                    {meal}
                  </h3>

                </div>

                <span className="meal-arrow">
                  →
                </span>

              </div>

            )
          )}

        </div>

      </section>
    </>
  );
}

/* =========================================================
   PROGRESS PAGE
========================================================= */

function ProgressPage({
  calorieTarget,
  totals,
}) {
    /* =========================================================
     PROGRESS MACRONUTRIENTS
  ========================================================= */

  const macroProgress = [
    {
      name: "Protein",
      value: Number(totals.protein) || 0,
      target: 125,
      unit: "g",
      icon: "🥩",
      color: "macro-protein",
    },
    {
      name: "Carbohydrates",
      value: Number(totals.carbs) || 0,
      target: 250,
      unit: "g",
      icon: "🌾",
      color: "macro-carbs",
    },
    {
      name: "Fats",
      value: Number(totals.fats) || 0,
      target: 70,
      unit: "g",
      icon: "🥑",
      color: "macro-fats",
    },
    {
      name: "Fiber",
      value: 34.25,
      target: 30,
      unit: "g",
      icon: "🥦",
      color: "macro-fiber",
    },
  ];

  /* =========================================================
     PROGRESS MICRONUTRIENTS
  ========================================================= */

  const microProgress = [
    {
      name: "Calcium",
      value: 1140,
      target: 1000,
      unit: "mg",
      icon: "🦴",
    },
    {
      name: "Iron",
      value: 8.1,
      target: 8,
      unit: "mg",
      icon: "🩸",
    },
    {
      name: "Zinc",
      value: 3.8,
      target: 11,
      unit: "mg",
      icon: "⚡",
    },
    {
      name: "Magnesium",
      value: 280,
      target: 420,
      unit: "mg",
      icon: "💪",
    },
    {
      name: "Potassium",
      value: 3650,
      target: 3500,
      unit: "mg",
      icon: "🍌",
    },
    {
      name: "Vitamin C",
      value: 330,
      target: 90,
      unit: "mg",
      icon: "🍊",
    },
    {
      name: "Vitamin A",
      value: 1440,
      target: 900,
      unit: "mcg",
      icon: "🥕",
    },
    {
      name: "Folate",
      value: 530,
      target: 400,
      unit: "mcg",
      icon: "🥬",
    },
    {
      name: "Vitamin B12",
      value: 3.6,
      target: 2.4,
      unit: "mcg",
      icon: "💊",
    },
    {
      name: "Vitamin D",
      value: 1,
      target: 15,
      unit: "mcg",
      icon: "☀️",
    },
    {
      name: "Omega-3",
      value: 2.45,
      target: 1.6,
      unit: "g",
      icon: "🐟",
    },
  ];
  const maxCalories = Math.max(
    calorieTarget,
    ...weeklyData.map(
      (item) => item.calories
    )
  );

  return (
    <>
      <header className="page-header glass">

        <div>

          <span>
            YOUR JOURNEY
          </span>

          <h1>
            Progress 📈
          </h1>

          <p>
            See how your nutrition is progressing.
          </p>

        </div>

      </header>

      <section className="progress-summary">

        <div className="progress-stat glass">

          <span>
            TODAY
          </span>

          <strong>
            {totals.calories}
          </strong>

          <small>
            kcal consumed
          </small>

        </div>

        <div className="progress-stat glass">

          <span>
            TARGET
          </span>

          <strong>
            {calorieTarget}
          </strong>

          <small>
            kcal target
          </small>

        </div>

        <div className="progress-stat glass">

          <span>
            PROTEIN
          </span>

          <strong>
            {totals.protein}g
          </strong>

          <small>
            consumed
          </small>

        </div>

        <div className="progress-stat glass">

          <span>
            CONSISTENCY
          </span>

          <strong>
            6
          </strong>

          <small>
            days this week
          </small>

        </div>

      </section>

      <section className="chart-card glass">

        <div className="section-heading no-margin">

          <div>

            <span>
              LAST 7 DAYS
            </span>

            <h2>
              Calorie intake
            </h2>

          </div>

          <span className="chart-target">
            Target: {calorieTarget} kcal
          </span>

        </div>

        <div className="bar-chart">

          {weeklyData.map((item) => {

            const height =
              (item.calories /
                maxCalories) *
              100;

            return (
              <div
                className="bar-column"
                key={item.day}
              >

                <span className="bar-value">
                  {item.calories}
                </span>

                <div className="bar-area">

                  <div
                    className="bar"
                    style={{
                      height: `${height}%`,
                    }}
                  />

                </div>

                <span className="bar-day">
                  {item.day}
                </span>

              </div>
            );

          })}

        </div>

      </section>

      <section className="progress-details">

        <div className="glass detail-card">

          <span>
            PROTEIN
          </span>

          <h2>
            {totals.protein}g
          </h2>

          <div className="detail-progress">
            <div
              style={{
                width: `${Math.min(
                  100,
                  (totals.protein / 125) *
                    100
                )}%`,
              }}
            />
          </div>

          <small>
            125g daily target
          </small>

        </div>

        <div className="glass detail-card">

          <span>
            CARBOHYDRATES
          </span>

          <h2>
            {totals.carbs}g
          </h2>

          <div className="detail-progress">
            <div
              style={{
                width: `${Math.min(
                  100,
                  (totals.carbs / 250) *
                    100
                )}%`,
              }}
            />
          </div>

          <small>
            250g daily target
          </small>

        </div>

        <div className="glass detail-card">

          <span>
            FATS
          </span>

          <h2>
            {totals.fats}g
          </h2>

          <div className="detail-progress">
            <div
              style={{
                width: `${Math.min(
                  100,
                  (totals.fats / 70) *
                    100
                )}%`,
              }}
            />
          </div>

          <small>
            70g daily target
          </small>

        </div>

      </section>
            {/* =====================================================
          MACRONUTRIENTS
      ===================================================== */}

      <section className="nutrition-progress-section">

        <div className="nutrition-section-heading">

          <div>
            <span>MACRONUTRIENTS</span>
            <h2>Daily macro balance</h2>
          </div>

          <div className="nutrition-count">
            4 nutrients
          </div>

        </div>


        <div className="macro-progress-grid">

          {macroProgress.map((macro) => {

            const percentage = Math.round(
              (macro.value / macro.target) * 100
            );

            const displayPercentage =
              Math.min(percentage, 100);

            return (

              <div
                className="macro-progress-card glass"
                key={macro.name}
              >

                <div className="macro-card-header">

                  <div
                    className={`macro-progress-icon ${macro.color}`}
                  >
                    {macro.icon}
                  </div>

                  <div>

                    <span className="macro-card-label">
                      {macro.name}
                    </span>

                    <h3>
                      {macro.value}
                      <small>{macro.unit}</small>
                    </h3>

                  </div>

                </div>


                <div className="macro-target-row">

                  <span>
                    Target: {macro.target}{macro.unit}
                  </span>

                  <strong>
                    {percentage}%
                  </strong>

                </div>


                <div className="macro-progress-track">

                  <div
                    className={`macro-progress-fill ${macro.color}`}
                    style={{
                      width: `${displayPercentage}%`,
                    }}
                  />

                </div>


                <div className="macro-bottom-text">

                  {macro.value >= macro.target ? (
                    <span className="nutrition-good">
                      ✓ Target reached
                    </span>
                  ) : (
                    <span>
                      {(macro.target - macro.value).toFixed(1)}
                      {macro.unit} remaining
                    </span>
                  )}

                </div>

              </div>

            );

          })}

        </div>

      </section>


      {/* =====================================================
          MICRONUTRIENTS
      ===================================================== */}

      <section className="nutrition-progress-section micro-section">

        <div className="nutrition-section-heading">

          <div>
            <span>MICRONUTRIENTS</span>
            <h2>Vitamins & minerals</h2>
          </div>

          <div className="nutrition-count">
            {microProgress.length} nutrients
          </div>

        </div>


        <div className="micro-progress-grid">

          {microProgress.map((micro) => {

            const percentage = Math.round(
              (micro.value / micro.target) * 100
            );

            let status = "Good";
            let statusClass = "micro-good";

            if (percentage < 50) {
              status = "Low";
              statusClass = "micro-low";
            } else if (percentage >= 100) {
              status = "Excellent";
              statusClass = "micro-excellent";
            }

            return (

              <div
                className="micro-progress-card glass"
                key={micro.name}
              >

                <div className="micro-card-top">

                  <div className="micro-progress-icon">
                    {micro.icon}
                  </div>

                  <div>

                    <h3>
                      {micro.name}
                    </h3>

                    <span
                      className={`micro-status ${statusClass}`}
                    >
                      {status}
                    </span>

                  </div>

                </div>


                <div className="micro-main-value">

                  <strong>
                    {micro.value}
                  </strong>

                  <span>
                    {micro.unit}
                  </span>

                </div>


                <div className="micro-target-row">

                  <span>
                    Daily target
                  </span>

                  <strong>
                    {micro.target} {micro.unit}
                  </strong>

                </div>


                <div className="micro-progress-track">

                  <div
                    className={`micro-progress-fill ${statusClass}`}
                    style={{
                      width: `${Math.min(
                        percentage,
                        100
                      )}%`,
                    }}
                  />

                </div>


                <div className="micro-bottom-row">

                  <span>
                    Daily coverage
                  </span>

                  <strong>
                    {percentage}%
                  </strong>

                </div>

              </div>

            );

          })}

        </div>

      </section>
    </>
  );
}

/* =========================================================
   INFO CARD
========================================================= */

function InfoCard({
  title,
  value,
  unit,
}) {
  return (
    <div className="info-card glass">

      <span>
        {title}
      </span>

      <strong>
        {value}
      </strong>

      {unit && (
        <small>
          {unit}
        </small>
      )}

    </div>
  );
}

/* =========================================================
   MACRO
========================================================= */

function Macro({
  name,
  value,
  target,
  percent,
}) {
  return (
    <div className="macro-row">

      <div className="macro-top">

        <span>
          {name}
        </span>

        <strong>
          {value} / {target}
        </strong>

      </div>

      <div className="macro-track">

        <div
          className="macro-fill"
          style={{
            width: `${percent}%`,
          }}
        />

      </div>

    </div>
  );
}

/* =========================================================
   SUGGESTION
========================================================= */

function Suggestion({
  icon,
  title,
  text,
}) {
  return (
    <div className="suggestion-card glass">

      <div className="suggestion-icon">
        {icon}
      </div>

      <div>

        <h3>
          {title}
        </h3>

        <p>
          {text}
        </p>

      </div>

    </div>
  );
}

export default App;
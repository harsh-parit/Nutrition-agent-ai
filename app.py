"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          IBM Watsonx.ai — AI Nutrition Agent (Flask Backend)                ║
║          Powered by Granite Models | Built for Health & Wellness            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Main Flask application — handles all API routes and Watsonx.ai model calls.
To customize agent behavior, scroll to the AGENT_INSTRUCTIONS section below.
"""

import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─── Load environment variables ──────────────────────────────────────────────
load_dotenv()

# ─── Flask app setup ─────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-me-in-production")
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════════
#  AGENT INSTRUCTIONS — Customize the Nutrition Agent behavior here
#  ─────────────────────────────────────────────────────────────────────────────
#  This is your central control panel. Change any setting to reshape how
#  the agent thinks, speaks, and recommends.
# ══════════════════════════════════════════════════════════════════════════════

AGENT_INSTRUCTIONS = {

    # ── Identity & Tone ───────────────────────────────────────────────────────
    "agent_name": "NutriAI",
    "persona": (
        "You are NutriAI, a warm, knowledgeable, and encouraging AI nutrition expert. "
        "You speak in a friendly yet professional tone — like a trusted dietitian who "
        "genuinely cares about the user's wellbeing. You are supportive, non-judgmental, "
        "and motivating. You celebrate small wins and offer practical, achievable advice."
    ),

    # ── Diet Specializations ──────────────────────────────────────────────────
    # Options: "balanced", "vegetarian", "vegan", "keto", "diabetic-friendly",
    #          "heart-healthy", "weight-loss", "muscle-gain", "ayurvedic"
    "diet_specialization": "balanced",

    # ── Indian Food Preferences ───────────────────────────────────────────────
    "indian_food_preferences": {
        "enabled": True,
        "preferred_cuisines": ["North Indian", "South Indian", "Bengali", "Gujarati", "Punjabi"],
        "staple_foods": ["dal", "roti", "rice", "sabzi", "idli", "dosa", "poha", "upma", "khichdi"],
        "healthy_indian_snacks": ["roasted chana", "makhana", "sprouts chaat", "fruit chaat", "buttermilk"],
        "spices_to_highlight": ["turmeric", "cumin", "coriander", "ginger", "garlic", "fenugreek"],
        "avoid": [],  # e.g., ["onion", "garlic"] for Jain diet
        "prioritize_local_seasonal": True,
    },

    # ── Response Style ────────────────────────────────────────────────────────
    "response_style": {
        "use_emojis": True,               # Include relevant food/health emojis
        "use_bullet_points": True,        # Format lists with bullets
        "include_calorie_counts": True,   # Always mention approximate calories
        "include_portion_sizes": True,    # Specify serving sizes
        "language_simplicity": "simple",  # "simple" | "technical" | "mixed"
        "max_response_length": "medium",  # "short" | "medium" | "detailed"
    },

    # ── Nutrition Philosophy ──────────────────────────────────────────────────
    "nutrition_philosophy": (
        "Focus on whole foods, balanced macronutrients, and sustainable habits. "
        "Emphasize the importance of hydration, fiber, and micronutrients. "
        "Promote mindful eating over restrictive dieting. "
        "Whenever possible, suggest affordable, locally available Indian ingredients."
    ),

    # ── Safety Rules (IMPORTANT — do not remove) ─────────────────────────────
    "safety_rules": [
        "Always recommend consulting a qualified doctor or registered dietitian for medical conditions.",
        "Never diagnose medical conditions or prescribe medications.",
        "Flag eating disorders (anorexia, bulimia) with compassion and professional help resources.",
        "Do not recommend extremely low-calorie diets (below 1200 kcal/day for adults) without medical supervision.",
        "Always consider allergies when they are mentioned by the user.",
        "For children under 12 and pregnant/lactating women, always add a note to consult a pediatrician/OB-GYN.",
        "Do not make absolute health claims — use phrases like 'may help', 'research suggests', 'generally considered'.",
    ],

    # ── Family Profile Defaults ───────────────────────────────────────────────
    "family_profile_defaults": {
        "elderly_adjustments": "Lower sodium, higher calcium & vitamin D, softer textures",
        "children_adjustments": "Higher calcium, iron, zinc; colorful fun presentations",
        "pregnancy_adjustments": "Folate, iron, DHA emphasis; avoid raw foods",
        "diabetic_adjustments": "Low GI foods, fiber-rich, controlled portions, no added sugar",
        "hypertension_adjustments": "DASH diet principles, low sodium, potassium-rich foods",
    },

    # ── Meal Planning Preferences ─────────────────────────────────────────────
    "meal_planning": {
        "meals_per_day": 5,   # 3 main + 2 snacks
        "include_recipes": True,
        "prep_time_preference": "quick",   # "quick" (<30 min) | "moderate" | "elaborate"
        "budget_conscious": True,          # Suggest economical options
        "seasonal_eating": True,
    },

    # ── Watsonx Model Parameters ──────────────────────────────────────────────
    "model_params": {
        "model_id": "ibm/granite-8b-code-instruct",   # Granite chat model
        "max_new_tokens": 1024,
        "temperature": 0.7,
        "top_p": 0.9,
        "top_k": 50,
        "repetition_penalty": 1.1,
    },
}

# ══════════════════════════════════════════════════════════════════════════════
#  END OF AGENT INSTRUCTIONS
# ══════════════════════════════════════════════════════════════════════════════


# ─── IBM Watsonx.ai Client Setup ──────────────────────────────────────────────
def get_watsonx_model():
    """Initialize and return Watsonx.ai ModelInference instance."""
    try:
        credentials = Credentials(
            url=os.getenv("WATSONX_URL", "https://au-syd.ml.cloud.ibm.com"),
            api_key=os.getenv("IBM_API_KEY"),
        )
        params = {
            GenParams.MAX_NEW_TOKENS: AGENT_INSTRUCTIONS["model_params"]["max_new_tokens"],
            GenParams.TEMPERATURE:    AGENT_INSTRUCTIONS["model_params"]["temperature"],
            GenParams.TOP_P:          AGENT_INSTRUCTIONS["model_params"]["top_p"],
            GenParams.TOP_K:          AGENT_INSTRUCTIONS["model_params"]["top_k"],
            GenParams.REPETITION_PENALTY: AGENT_INSTRUCTIONS["model_params"]["repetition_penalty"],
        }
        model = ModelInference(
            model_id=AGENT_INSTRUCTIONS["model_params"]["model_id"],
            params=params,
            credentials=credentials,
            project_id=os.getenv("WATSONX_PROJECT_ID"),
        )
        return model
    except Exception as e:
        logger.error(f"Watsonx.ai initialization error: {e}")
        return None


def build_system_prompt():
    """Build the system prompt from AGENT_INSTRUCTIONS."""
    inst = AGENT_INSTRUCTIONS
    indian = inst["indian_food_preferences"]
    safety = "\n".join(f"- {rule}" for rule in inst["safety_rules"])
    avoid_str = ", ".join(indian["avoid"]) if indian["avoid"] else "none"

    return f"""{inst['persona']}

NUTRITION PHILOSOPHY:
{inst['nutrition_philosophy']}

DIET SPECIALIZATION: {inst['diet_specialization']}

INDIAN FOOD CONTEXT:
- Preferred cuisines: {', '.join(indian['preferred_cuisines'])}
- Staple foods to include: {', '.join(indian['staple_foods'])}
- Healthy snack suggestions: {', '.join(indian['healthy_indian_snacks'])}
- Key spices to highlight: {', '.join(indian['spices_to_highlight'])}
- Ingredients to avoid: {avoid_str}
- Prioritize local & seasonal ingredients: {indian['prioritize_local_seasonal']}

RESPONSE FORMATTING:
- Use emojis: {inst['response_style']['use_emojis']}
- Use bullet points: {inst['response_style']['use_bullet_points']}
- Include calorie counts: {inst['response_style']['include_calorie_counts']}
- Include portion sizes: {inst['response_style']['include_portion_sizes']}
- Language style: {inst['response_style']['language_simplicity']}
- Response length: {inst['response_style']['max_response_length']}

SAFETY RULES (always follow):
{safety}

MEAL PLANNING:
- Meals per day: {inst['meal_planning']['meals_per_day']} (3 main + 2 snacks)
- Include recipes: {inst['meal_planning']['include_recipes']}
- Prep time preference: {inst['meal_planning']['prep_time_preference']}
- Budget conscious: {inst['meal_planning']['budget_conscious']}

Always respond as {inst['agent_name']}, a warm and knowledgeable nutrition expert. 
Be helpful, accurate, and encouraging. Format responses clearly with headers and bullets when appropriate."""


def query_watsonx(user_message: str, conversation_history: list, context: dict = None) -> str:
    """Send a message to Watsonx.ai and return the response."""
    model = get_watsonx_model()
    if not model:
        return "⚠️ I'm having trouble connecting to the AI service right now. Please check your IBM API credentials and try again."

    system_prompt = build_system_prompt()

    # Build context string if additional context provided
    context_str = ""
    if context:
        context_parts = []
        if context.get("bmi"):
            context_parts.append(f"User BMI: {context['bmi']} ({context.get('bmi_category', '')})")
        if context.get("goal"):
            context_parts.append(f"Health Goal: {context['goal']}")
        if context.get("age"):
            context_parts.append(f"Age: {context['age']}")
        if context.get("dietary_restrictions"):
            context_parts.append(f"Dietary Restrictions: {context['dietary_restrictions']}")
        if context.get("family_member"):
            context_parts.append(f"This advice is for: {context['family_member']}")
        if context_parts:
            context_str = "\nUSER CONTEXT:\n" + "\n".join(context_parts) + "\n"

    # Build conversation history string
    history_str = ""
    if conversation_history:
        recent = conversation_history[-6:]  # last 3 exchanges
        for msg in recent:
            role = "User" if msg["role"] == "user" else "NutriAI"
            history_str += f"{role}: {msg['content']}\n"

    # Compose full prompt
    prompt = f"""<|system|>
{system_prompt}
{context_str}
<|end|>
{history_str}
<|user|>
{user_message}
<|end|>
<|assistant|>
"""

    try:
        response = model.generate_text(prompt=prompt)
        return response.strip()
    except Exception as e:
        logger.error(f"Watsonx.ai generation error: {e}")
        return f"⚠️ Sorry, I encountered an error generating your response. Please try again. (Error: {str(e)[:100]})"


# ─── Utility Functions ────────────────────────────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    """Calculate BMI and return result with category."""
    if height_cm <= 0 or weight_kg <= 0:
        return {"error": "Invalid measurements"}
    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)
    if bmi < 18.5:
        category, color, advice = "Underweight", "#3b82f6", "Focus on nutrient-dense foods to gain healthy weight."
    elif bmi < 25:
        category, color, advice = "Normal Weight", "#22c55e", "Great! Maintain your healthy lifestyle."
    elif bmi < 30:
        category, color, advice = "Overweight", "#f59e0b", "Gradual weight loss through diet and activity is recommended."
    else:
        category, color, advice = "Obese", "#ef4444", "Consult a healthcare provider for a personalized weight management plan."
    return {"bmi": bmi, "category": category, "color": color, "advice": advice}


def calculate_tdee(weight_kg: float, height_cm: float, age: int, gender: str, activity: str) -> dict:
    """Calculate Total Daily Energy Expenditure (TDEE) using Mifflin-St Jeor equation."""
    if gender.lower() == "male":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }
    multiplier = activity_multipliers.get(activity, 1.55)
    tdee = round(bmr * multiplier)
    return {
        "bmr": round(bmr),
        "tdee": tdee,
        "weight_loss": tdee - 500,
        "weight_gain": tdee + 500,
        "maintenance": tdee,
    }


# ─── Flask Routes ─────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html", agent_name=AGENT_INSTRUCTIONS["agent_name"])


@app.route("/api/chat", methods=["POST"])
def chat():
    """Handle chat messages and return AI responses."""
    data = request.get_json()
    user_message = data.get("message", "").strip()
    conversation_history = data.get("history", [])
    user_context = data.get("context", {})

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Get AI response
    response = query_watsonx(user_message, conversation_history, user_context)

    return jsonify({
        "response": response,
        "timestamp": datetime.now().isoformat(),
        "agent": AGENT_INSTRUCTIONS["agent_name"],
    })


@app.route("/api/bmi", methods=["POST"])
def bmi_calculator():
    """Calculate BMI and return results."""
    data = request.get_json()
    try:
        weight = float(data.get("weight", 0))
        height = float(data.get("height", 0))
        result = calculate_bmi(weight, height)
        return jsonify(result)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid input values"}), 400


@app.route("/api/tdee", methods=["POST"])
def tdee_calculator():
    """Calculate TDEE and caloric needs."""
    data = request.get_json()
    try:
        weight = float(data.get("weight", 0))
        height = float(data.get("height", 0))
        age = int(data.get("age", 25))
        gender = data.get("gender", "male")
        activity = data.get("activity", "moderate")
        result = calculate_tdee(weight, height, age, gender, activity)
        return jsonify(result)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid input values"}), 400


@app.route("/api/meal-plan", methods=["POST"])
def generate_meal_plan():
    """Generate a personalized meal plan via Watsonx.ai."""
    data = request.get_json()
    calories = data.get("calories", 2000)
    goal = data.get("goal", "maintenance")
    dietary_restrictions = data.get("dietary_restrictions", "none")
    duration = data.get("duration", "1 day")
    family_member = data.get("family_member", "")

    member_context = f" for {family_member}" if family_member else ""
    prompt = (
        f"Create a detailed {duration} meal plan{member_context} with approximately {calories} calories/day. "
        f"Goal: {goal}. Dietary restrictions: {dietary_restrictions}. "
        f"Include breakfast, lunch, dinner, and 2 snacks with calorie counts and brief preparation notes. "
        f"Prioritize Indian foods and ingredients. Format with clear sections."
    )

    response = query_watsonx(prompt, [], {"goal": goal, "dietary_restrictions": dietary_restrictions})
    return jsonify({"meal_plan": response, "calories_target": calories})


@app.route("/api/analyze-food", methods=["POST"])
def analyze_food():
    """Analyze nutritional content of a food item."""
    data = request.get_json()
    food_item = data.get("food_item", "")
    portion = data.get("portion", "1 serving")

    if not food_item:
        return jsonify({"error": "No food item provided"}), 400

    prompt = (
        f"Provide a detailed nutritional analysis of {portion} of {food_item}. "
        f"Include: calories, protein, carbohydrates, fat, fiber, key vitamins and minerals. "
        f"Also mention if it's a good source of any particular nutrient and suggest healthier alternatives if applicable. "
        f"Use a structured format with clear sections."
    )

    response = query_watsonx(prompt, [])
    return jsonify({"analysis": response, "food_item": food_item})


@app.route("/api/family-recommendations", methods=["POST"])
def family_recommendations():
    """Generate nutrition recommendations for a family member."""
    data = request.get_json()
    member_type = data.get("member_type", "adult")  # child, adult, elderly, pregnant
    age = data.get("age", 30)
    health_conditions = data.get("health_conditions", "none")
    name = data.get("name", "Family Member")

    adjustments = AGENT_INSTRUCTIONS["family_profile_defaults"]
    special_notes = {
        "elderly": adjustments["elderly_adjustments"],
        "child": adjustments["children_adjustments"],
        "pregnant": adjustments["pregnancy_adjustments"],
        "diabetic": adjustments["diabetic_adjustments"],
        "hypertension": adjustments["hypertension_adjustments"],
    }.get(member_type, "Standard balanced nutrition")

    prompt = (
        f"Create personalized nutrition recommendations for {name}, a {age}-year-old {member_type}. "
        f"Health conditions: {health_conditions}. "
        f"Special dietary considerations: {special_notes}. "
        f"Include: daily nutrient requirements, recommended foods, foods to avoid, "
        f"sample meal ideas, and practical tips. Use Indian food examples where possible."
    )

    response = query_watsonx(prompt, [], {"age": age, "family_member": name})
    return jsonify({"recommendations": response, "member": name})


@app.route("/api/quick-tips", methods=["GET"])
def quick_tips():
    """Get daily nutrition tips."""
    tips = [
        "💧 Start your day with a glass of warm water with lemon — it aids digestion and boosts metabolism.",
        "🌿 Add a pinch of turmeric to your milk or dal — it's a powerful anti-inflammatory.",
        "🥗 Fill half your plate with colorful vegetables at every meal for maximum micronutrients.",
        "🫘 Soak legumes overnight before cooking — it reduces cooking time and improves digestibility.",
        "🍎 Eat seasonal fruits — they are more nutritious and economical than imported varieties.",
        "🌾 Switch to whole grain roti or rice for more fiber, vitamins, and sustained energy.",
        "🧘 Practice mindful eating — chew slowly and avoid screens during meals.",
        "⏰ Maintain consistent meal timings to regulate your body's metabolic rhythm.",
        "🥛 Include a source of probiotics daily — dahi (yogurt), lassi, or kanji are excellent choices.",
        "🫚 Use cold-pressed mustard oil or coconut oil for cooking — they have better nutritional profiles.",
    ]
    import random
    return jsonify({"tips": random.sample(tips, min(3, len(tips)))})


@app.route("/api/agent-info", methods=["GET"])
def agent_info():
    """Return public agent configuration info."""
    return jsonify({
        "name": AGENT_INSTRUCTIONS["agent_name"],
        "diet_specialization": AGENT_INSTRUCTIONS["diet_specialization"],
        "indian_food_enabled": AGENT_INSTRUCTIONS["indian_food_preferences"]["enabled"],
        "meals_per_day": AGENT_INSTRUCTIONS["meal_planning"]["meals_per_day"],
        "model": AGENT_INSTRUCTIONS["model_params"]["model_id"],
    })


@app.route("/health")
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


# ─── Run Application ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    logger.info(f"🥗 NutriAI Agent starting on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=debug)

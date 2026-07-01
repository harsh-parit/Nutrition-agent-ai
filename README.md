# 🥗 NutriAI — IBM Watsonx.ai Nutrition Agent

> An AI-powered nutrition advisor built with **Python Flask** and **IBM Watsonx.ai (Granite models)** — featuring a modern responsive web UI with chat, meal planning, BMI calculator, food analyzer, and family nutrition profiles.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **AI Chat** | Real-time nutrition Q&A powered by IBM Granite models |
| 📅 **Meal Planner** | AI-generated personalized meal plans (1/3/7 days) |
| ⚖️ **BMI Calculator** | BMI + TDEE with visual gauge and calorie breakdown |
| 🔍 **Food Analyzer** | Nutritional analysis of any food item |
| 👨‍👩‍👧 **Family Profiles** | Personalized plans for every family member |
| 🇮🇳 **Indian Food Focus** | Optimized for Indian cuisine and ingredients |
| 🌙 **Dark Mode** | Full dark/light theme toggle |
| 📱 **Responsive** | Mobile-first Bootstrap 5 design |

---

## 🚀 Quick Start

### 1. Clone / Download
```bash
# If using git
git clone <your-repo-url>
cd nutrition_agent
```

### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure IBM Credentials

Edit the `.env` file with your IBM Cloud credentials:

```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=change-me-to-a-random-string
```

**Getting your IBM credentials:**
1. 🔑 **API Key**: Go to [IBM Cloud IAM](https://cloud.ibm.com/iam/apikeys) → Create API Key
2. 🆔 **Project ID**: Open [IBM Watsonx.ai](https://dataplatform.cloud.ibm.com/wx) → Your Project → Settings → Project ID
3. 🌐 **URL**: Use `https://us-south.ml.cloud.ibm.com` (Dallas) or your region's URL

### 5. Run the Application
```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🎛️ Customizing Agent Behavior

The `AGENT_INSTRUCTIONS` dictionary in [`app.py`](app.py) is your **central control panel**:

```python
AGENT_INSTRUCTIONS = {
    # Change the agent's name and personality
    "agent_name": "NutriAI",
    "persona": "You are NutriAI, a warm and knowledgeable nutrition expert...",

    # Switch diet specialization
    # Options: "balanced", "vegetarian", "vegan", "keto", "diabetic-friendly",
    #          "heart-healthy", "weight-loss", "muscle-gain", "ayurvedic"
    "diet_specialization": "balanced",

    # Toggle Indian food preferences
    "indian_food_preferences": {
        "enabled": True,
        "preferred_cuisines": ["North Indian", "South Indian", ...],
        "avoid": [],  # e.g., ["onion", "garlic"] for Jain diet
    },

    # Adjust response style
    "response_style": {
        "use_emojis": True,
        "language_simplicity": "simple",  # "simple" | "technical" | "mixed"
        "max_response_length": "medium",  # "short" | "medium" | "detailed"
    },

    # Safety guardrails (recommended to keep)
    "safety_rules": [...],

    # Watsonx model parameters
    "model_params": {
        "model_id": "ibm/granite-13b-chat-v2",
        "max_new_tokens": 1024,
        "temperature": 0.7,
    },
}
```

---

## 📁 Project Structure

```
nutrition_agent/
├── app.py                   # Flask backend + AGENT_INSTRUCTIONS
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (your API keys)
├── .env.example             # Template for .env
├── README.md                # This file
├── templates/
│   └── index.html           # Main HTML frontend
└── static/
    ├── css/
    │   └── style.css        # Styles (dark mode, animations, responsive)
    └── js/
        └── app.js           # Frontend JavaScript
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Main application page |
| `POST` | `/api/chat` | Send message to AI agent |
| `POST` | `/api/bmi` | Calculate BMI |
| `POST` | `/api/tdee` | Calculate TDEE / caloric needs |
| `POST` | `/api/meal-plan` | Generate personalized meal plan |
| `POST` | `/api/analyze-food` | Analyze food nutrition |
| `POST` | `/api/family-recommendations` | Get family member recommendations |
| `GET` | `/api/quick-tips` | Get daily nutrition tips |
| `GET` | `/api/agent-info` | Agent configuration info |
| `GET` | `/health` | Health check |

### Example API call:
```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What should I eat for breakfast?", "history": []}'
```

---

## ☁️ Deployment

### Option 1: IBM Cloud Code Engine

```bash
# Build and push Docker image
docker build -t nutriai-agent .
docker tag nutriai-agent icr.io/<namespace>/nutriai-agent:latest
docker push icr.io/<namespace>/nutriai-agent:latest

# Deploy to Code Engine
ibmcloud ce application create \
  --name nutriai-agent \
  --image icr.io/<namespace>/nutriai-agent:latest \
  --env-from-secret nutriai-secrets \
  --port 5000
```

### Option 2: Gunicorn (Production)

```bash
# Install gunicorn (already in requirements.txt)
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option 3: Docker

Create a `Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutriai-agent .
docker run -p 5000:5000 --env-file .env nutriai-agent
```

### Option 4: Railway / Render / Heroku

1. Push to GitHub
2. Connect your repo to Railway/Render
3. Add environment variables in dashboard:
   - `IBM_API_KEY`
   - `WATSONX_PROJECT_ID`
   - `WATSONX_URL`
   - `FLASK_SECRET_KEY`
4. Deploy!

---

## 🔒 Security Best Practices

- ✅ API keys stored in `.env` (never commit this file)
- ✅ `.env` is in `.gitignore`
- ✅ CORS enabled via Flask-CORS
- ✅ Input validation on all API endpoints
- ✅ HTML escaping in JavaScript frontend
- 🔧 In production: set `FLASK_DEBUG=False`
- 🔧 In production: use a strong random `FLASK_SECRET_KEY`

---

## 🧪 Troubleshooting

| Issue | Solution |
|---|---|
| `401 Unauthorized` from Watsonx | Check `IBM_API_KEY` in `.env` |
| `Project not found` error | Verify `WATSONX_PROJECT_ID` |
| `Module not found` errors | Run `pip install -r requirements.txt` |
| Frontend not loading | Ensure `templates/` and `static/` directories exist |
| Empty AI responses | Check model quota in IBM Watsonx.ai dashboard |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI Model** | IBM Watsonx.ai + Granite 13B Chat |
| **Backend** | Python 3.11 + Flask 3.0 |
| **Frontend** | HTML5 + Bootstrap 5.3 + Vanilla JS |
| **Icons** | Bootstrap Icons 1.11 |
| **Fonts** | Inter + Poppins (Google Fonts) |
| **Deployment** | Gunicorn / Docker / IBM Code Engine |

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

*Built with ❤️ using IBM Watsonx.ai and Granite models*

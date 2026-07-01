/**
 * ============================================================
 *  NutriAI — IBM Watsonx.ai Nutrition Agent
 *  Frontend JavaScript | Chat, Dashboard, BMI, Meal Plan, Family
 * ============================================================
 */

'use strict';

// ─── App State ──────────────────────────────────────────────
const AppState = {
    currentSection: 'dashboard',
    chatHistory: [],
    chatCount: 0,
    familyMembers: [],
    bmiData: null,
    tdeeData: null,
    theme: localStorage.getItem('nutriai-theme') || 'light',
};

// ─── DOM Ready ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initChatInput();
    loadTips();
    loadAgentInfo();
});

// ══════════════════════════════════════════════════════════════
//  THEME MANAGEMENT
// ══════════════════════════════════════════════════════════════

function initTheme() {
    applyTheme(AppState.theme);
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (theme === 'dark') {
        icon.className = 'bi bi-sun-fill';
        icon.title = 'Switch to light mode';
    } else {
        icon.className = 'bi bi-moon-stars-fill';
        icon.title = 'Switch to dark mode';
    }
    AppState.theme = theme;
    localStorage.setItem('nutriai-theme', theme);
}

function toggleTheme() {
    applyTheme(AppState.theme === 'light' ? 'dark' : 'light');
}

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════

function initNavigation() {
    document.querySelectorAll('.nav-pill').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) switchSection(section);
        });
    });
}

function switchSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));

    // Remove active from all nav items
    document.querySelectorAll('.nav-pill').forEach(l => l.classList.remove('active'));

    // Show target section
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.add('active');

    // Activate nav link
    const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');

    AppState.currentSection = sectionId;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile navbar if open
    const navCollapse = document.getElementById('navbarNav');
    if (navCollapse.classList.contains('show')) {
        navCollapse.classList.remove('show');
    }
}

// ══════════════════════════════════════════════════════════════
//  DAILY TIPS
// ══════════════════════════════════════════════════════════════

async function loadTips() {
    const container = document.getElementById('tipsContainer');
    container.innerHTML = '<div class="tip-loading"><div class="spinner-grow spinner-grow-sm text-success me-2"></div>Loading tips...</div>';

    try {
        const res = await fetch('/api/quick-tips');
        const data = await res.json();
        const tips = data.tips || [];

        container.innerHTML = tips.map(tip =>
            `<div class="tip-card">${tip}</div>`
        ).join('');
    } catch (err) {
        container.innerHTML = '<div class="tip-card">🌿 Eat a rainbow of vegetables every day for optimal health!</div>';
    }
}

// ══════════════════════════════════════════════════════════════
//  AGENT INFO
// ══════════════════════════════════════════════════════════════

async function loadAgentInfo() {
    try {
        const res = await fetch('/api/agent-info');
        const data = await res.json();
        // Update status badge
        const statusText = document.querySelector('.status-text');
        if (statusText && data.name) {
            statusText.textContent = `${data.name} Online`;
        }
    } catch (e) {
        // silently fail
    }
}

// ══════════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════════

function initChatInput() {
    const textarea = document.getElementById('chatInput');
    const charCount = document.getElementById('charCount');
    const MAX = 500;

    textarea.addEventListener('input', () => {
        // Auto-resize
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';

        // Char count
        const len = textarea.value.length;
        charCount.textContent = `${len}/${MAX}`;
        charCount.style.color = len > MAX * 0.9 ? 'var(--warning)' : '';
    });

    // Enter to send (Shift+Enter for newline)
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function getUserContext() {
    return {
        goal: document.getElementById('chatGoal')?.value || '',
        age: document.getElementById('chatAge')?.value || '',
        gender: document.getElementById('chatGender')?.value || '',
        dietary_restrictions: document.getElementById('chatRestrictions')?.value || '',
        bmi: AppState.bmiData?.bmi || null,
        bmi_category: AppState.bmiData?.category || null,
    };
}

async function sendMessage() {
    const textarea = document.getElementById('chatInput');
    const message = textarea.value.trim();
    if (!message) return;

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    // Append user message
    appendMessage('user', message);
    textarea.value = '';
    textarea.style.height = 'auto';
    document.getElementById('charCount').textContent = '0/500';

    // Increment chat count
    AppState.chatCount++;
    AppState.chatHistory.push({ role: 'user', content: message });
    updateDashStats();

    // Show typing indicator
    const typingId = showTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: AppState.chatHistory.slice(-10),
                context: getUserContext(),
            }),
        });

        const data = await res.json();
        removeTypingIndicator(typingId);

        if (data.response) {
            const formattedResponse = formatMarkdown(data.response);
            appendMessage('bot', formattedResponse, true);
            AppState.chatHistory.push({ role: 'assistant', content: data.response });
        } else {
            appendMessage('bot', '⚠️ Sorry, I couldn\'t generate a response. Please try again.');
        }
    } catch (err) {
        removeTypingIndicator(typingId);
        appendMessage('bot', '⚠️ Connection error. Please check that the Flask server is running and try again.');
    }

    sendBtn.disabled = false;
    textarea.focus();
}

function appendMessage(role, content, isHtml = false) {
    const container = document.getElementById('chatMessages');
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const label = role === 'bot' ? 'NutriAI' : 'You';

    const avatarIcon = role === 'bot'
        ? '<i class="bi bi-robot"></i>'
        : '<i class="bi bi-person-fill"></i>';

    const msgDiv = document.createElement('div');
    msgDiv.className = `message message-${role}`;
    msgDiv.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-bubble">
            <div class="message-content ${role === 'bot' ? 'ai-response' : ''}">
                ${isHtml ? content : escapeHtml(content).replace(/\n/g, '<br>')}
            </div>
            <div class="message-time">${label} • ${now}</div>
        </div>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'message message-bot typing-indicator';
    div.innerHTML = `
        <div class="message-avatar"><i class="bi bi-robot"></i></div>
        <div class="message-bubble">
            <div class="message-content">
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function clearChat() {
    AppState.chatHistory = [];
    const container = document.getElementById('chatMessages');
    container.innerHTML = `
        <div class="message message-bot">
            <div class="message-avatar"><i class="bi bi-robot"></i></div>
            <div class="message-bubble">
                <div class="message-content">
                    <p>🥗 <strong>Chat cleared!</strong> I'm ready to help you again. What nutrition questions do you have?</p>
                </div>
                <div class="message-time">NutriAI • Just now</div>
            </div>
        </div>
    `;
    showToast('Chat history cleared', 'info');
}

function quickChat(message) {
    switchSection('chat');
    setTimeout(() => {
        document.getElementById('chatInput').value = message;
        sendMessage();
    }, 300);
}

function usePrompt(prompt) {
    document.getElementById('chatInput').value = prompt;
    document.getElementById('chatInput').focus();
    // Trigger resize
    const e = new Event('input');
    document.getElementById('chatInput').dispatchEvent(e);
}

// ══════════════════════════════════════════════════════════════
//  MEAL PLAN
// ══════════════════════════════════════════════════════════════

function updateCalorieDisplay() {
    const val = document.getElementById('mealCalories').value;
    document.getElementById('calorieDisplay').textContent = val;
}

async function generateMealPlan() {
    const btn = document.getElementById('generateMealBtn');
    const output = document.getElementById('mealPlanOutput');

    const calories = document.getElementById('mealCalories').value;
    const goal = document.getElementById('mealGoal').value;
    const duration = document.getElementById('mealDuration').value;
    const familyMember = document.getElementById('mealFamilyMember').value;

    // Collect dietary restrictions
    const restrictions = Array.from(document.querySelectorAll('.diet-check:checked'))
        .map(cb => cb.value).join(', ') || 'none';

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';

    output.innerHTML = `
        <div class="text-center py-5">
            <div class="loading-spinner mx-auto mb-3" style="width:40px;height:40px"></div>
            <div style="color:var(--text-muted);font-size:14px">
                NutriAI is creating your personalized meal plan...<br>
                <small>Powered by IBM Watsonx.ai & Granite</small>
            </div>
        </div>
    `;

    try {
        const res = await fetch('/api/meal-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ calories, goal, dietary_restrictions: restrictions, duration, family_member: familyMember }),
        });

        const data = await res.json();

        if (data.meal_plan) {
            const formatted = formatMarkdown(data.meal_plan);
            output.innerHTML = `
                <div class="meal-plan-content ai-response">${formatted}</div>
            `;
            document.getElementById('copyMealPlanBtn').style.display = 'flex';
            showToast('Meal plan generated!', 'success');
        } else {
            output.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle empty-icon text-warning"></i><p>Could not generate meal plan. Please check your API configuration.</p></div>';
        }
    } catch (err) {
        output.innerHTML = '<div class="empty-state"><i class="bi bi-wifi-off empty-icon text-danger"></i><p>Connection error. Please ensure the Flask server is running.</p></div>';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-magic me-2"></i>Generate Meal Plan';
}

function copyMealPlan() {
    const content = document.querySelector('.meal-plan-content');
    if (content) {
        const text = content.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Meal plan copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Could not copy to clipboard', 'error');
        });
    }
}

// ══════════════════════════════════════════════════════════════
//  BMI & TDEE CALCULATOR
// ══════════════════════════════════════════════════════════════

async function calculateBMI() {
    const weight = parseFloat(document.getElementById('bmiWeight').value);
    const height = parseFloat(document.getElementById('bmiHeight').value);
    const age = parseInt(document.getElementById('bmiAge').value);
    const gender = document.getElementById('bmiGender').value;
    const activity = document.getElementById('bmiActivity').value;

    if (!weight || !height || weight <= 0 || height <= 0) {
        showToast('Please enter valid weight and height', 'error');
        return;
    }

    showLoading('Calculating your BMI & caloric needs...');

    try {
        // BMI calculation
        const bmiRes = await fetch('/api/bmi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight, height }),
        });
        const bmiData = await bmiRes.json();

        // TDEE calculation
        const tdeeRes = await fetch('/api/tdee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight, height, age: age || 25, gender, activity }),
        });
        const tdeeData = await tdeeRes.json();

        AppState.bmiData = bmiData;
        AppState.tdeeData = tdeeData;

        displayBMIResults(bmiData, tdeeData);
        updateDashStats();

    } catch (err) {
        showToast('Error calculating BMI. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function displayBMIResults(bmi, tdee) {
    // Show results, hide empty state
    document.getElementById('bmiResults').classList.remove('d-none');
    document.getElementById('bmiEmptyState').classList.add('d-none');

    // Update BMI display
    document.getElementById('bmiValue').textContent = bmi.bmi;
    const categoryEl = document.getElementById('bmiCategory');
    categoryEl.textContent = bmi.category;

    // Style category badge
    const colorMap = {
        'Underweight': { bg: 'var(--accent-light)', color: 'var(--accent)' },
        'Normal Weight': { bg: 'var(--success-light)', color: 'var(--success)' },
        'Overweight': { bg: 'var(--warning-light)', color: 'var(--warning)' },
        'Obese': { bg: 'var(--danger-light)', color: 'var(--danger)' },
    };
    const style = colorMap[bmi.category] || colorMap['Normal Weight'];
    categoryEl.style.background = style.bg;
    categoryEl.style.color = style.color;

    document.getElementById('bmiAdvice').textContent = bmi.advice;

    // Rotate needle
    const needleAngle = bmiToNeedleAngle(bmi.bmi);
    document.getElementById('bmiNeedle').setAttribute('transform', `rotate(${needleAngle}, 100, 100)`);

    // Update TDEE
    if (tdee) {
        document.getElementById('tdee-bmr').textContent     = `${tdee.bmr} kcal`;
        document.getElementById('tdee-maintain').textContent = `${tdee.maintenance} kcal`;
        document.getElementById('tdee-loss').textContent    = `${tdee.weight_loss} kcal`;
        document.getElementById('tdee-gain').textContent    = `${tdee.weight_gain} kcal`;
    }

    showToast('BMI calculated successfully!', 'success');
}

function bmiToNeedleAngle(bmi) {
    // Map BMI 10–40 to rotation angle -80 to +80 degrees
    const minBMI = 10, maxBMI = 40;
    const minAngle = -80, maxAngle = 80;
    const clamped = Math.min(Math.max(bmi, minBMI), maxBMI);
    return minAngle + ((clamped - minBMI) / (maxBMI - minBMI)) * (maxAngle - minAngle);
}

function updateDashStats() {
    document.getElementById('dashChats').textContent = AppState.chatCount;
    document.getElementById('dashFamily').textContent = `${AppState.familyMembers.length} Added`;

    if (AppState.bmiData) {
        document.getElementById('dashBmi').textContent = `${AppState.bmiData.bmi} (${AppState.bmiData.category.split(' ')[0]})`;
    }
    if (AppState.tdeeData) {
        document.getElementById('dashCalories').textContent = `${AppState.tdeeData.maintenance} kcal`;
    }
}

// ══════════════════════════════════════════════════════════════
//  FAMILY PROFILES
// ══════════════════════════════════════════════════════════════

async function addFamilyMember() {
    const name = document.getElementById('familyName').value.trim();
    const age = document.getElementById('familyAge').value;
    const type = document.getElementById('familyType').value;
    const health = document.getElementById('familyHealth').value.trim();

    if (!name) {
        showToast('Please enter a name for the family member', 'error');
        return;
    }

    const member = { id: Date.now(), name, age, type, health };
    AppState.familyMembers.push(member);
    updateDashStats();

    // Render member card with loading state
    renderFamilyMember(member, true);

    // Clear form
    document.getElementById('familyName').value = '';
    document.getElementById('familyAge').value = '';
    document.getElementById('familyHealth').value = '';

    showToast(`${name} added to family profiles!`, 'success');

    // Fetch recommendations
    try {
        const res = await fetch('/api/family-recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, age, member_type: type, health_conditions: health || 'none' }),
        });
        const data = await res.json();

        const recEl = document.getElementById(`recommendations-${member.id}`);
        if (recEl && data.recommendations) {
            recEl.classList.remove('loading');
            recEl.innerHTML = formatMarkdown(data.recommendations);
        }
    } catch (err) {
        const recEl = document.getElementById(`recommendations-${member.id}`);
        if (recEl) {
            recEl.classList.remove('loading');
            recEl.innerHTML = '⚠️ Could not load recommendations. Please check API configuration.';
        }
    }
}

function renderFamilyMember(member, loadingRecs = false) {
    const container = document.getElementById('familyMembersList');

    // Remove empty state
    const emptyCard = container.querySelector('.empty-state-card');
    if (emptyCard) emptyCard.remove();

    const avatarClass = getMemberAvatarClass(member.type);
    const avatarIcon = getMemberIcon(member.type);
    const typeBadge = member.type.charAt(0).toUpperCase() + member.type.slice(1);

    const card = document.createElement('div');
    card.className = 'family-member-card';
    card.id = `member-${member.id}`;
    card.innerHTML = `
        <div class="family-member-header">
            <div class="member-avatar ${avatarClass}">${avatarIcon}</div>
            <div class="flex-grow-1">
                <div class="member-name">${escapeHtml(member.name)}</div>
                <div class="member-meta">
                    ${member.age ? `Age ${member.age} •` : ''} ${typeBadge}
                    ${member.health ? ` • ${escapeHtml(member.health)}` : ''}
                </div>
            </div>
            <button class="btn btn-sm btn-ghost" onclick="removeFamilyMember(${member.id})">
                <i class="bi bi-trash3"></i>
            </button>
        </div>
        <div class="member-recommendations ai-response ${loadingRecs ? 'loading' : ''}" id="recommendations-${member.id}">
            ${loadingRecs
                ? '<div class="d-flex align-items-center gap-2"><div class="spinner-grow spinner-grow-sm"></div>Loading personalized recommendations...</div>'
                : ''}
        </div>
        <div class="mt-2 d-flex gap-2">
            <button class="btn btn-sm btn-ghost" onclick="generateFamilyMealPlan('${escapeHtml(member.name)}', '${member.type}')">
                <i class="bi bi-calendar3 me-1"></i>Get Meal Plan
            </button>
            <button class="btn btn-sm btn-ghost" onclick="chatWithContext('${escapeHtml(member.name)}', '${member.type}')">
                <i class="bi bi-chat-dots me-1"></i>Ask About ${escapeHtml(member.name)}
            </button>
        </div>
    `;

    container.appendChild(card);
}

function removeFamilyMember(id) {
    AppState.familyMembers = AppState.familyMembers.filter(m => m.id !== id);
    const card = document.getElementById(`member-${id}`);
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        card.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            card.remove();
            if (AppState.familyMembers.length === 0) {
                document.getElementById('familyMembersList').innerHTML = `
                    <div class="empty-state-card">
                        <i class="bi bi-people empty-icon"></i>
                        <p>Add your family members to get personalized nutrition recommendations for each one</p>
                    </div>
                `;
            }
        }, 300);
    }
    updateDashStats();
    showToast('Family member removed', 'info');
}

function generateFamilyMealPlan(name, type) {
    switchSection('meal-plan');
    setTimeout(() => {
        document.getElementById('mealFamilyMember').value = `${name} (${type})`;
        showToast(`Switched to meal planner for ${name}`, 'info');
    }, 300);
}

function chatWithContext(name, type) {
    switchSection('chat');
    setTimeout(() => {
        document.getElementById('chatInput').value = `Give me nutrition advice for ${name}, who is a ${type}`;
        sendMessage();
    }, 400);
}

function getMemberAvatarClass(type) {
    const map = {
        child: 'member-type-child',
        elderly: 'member-type-elderly',
        pregnant: 'member-type-pregnant',
        diabetic: 'member-type-diabetic',
        adult: 'member-type-adult',
    };
    return map[type] || 'member-type-default';
}

function getMemberIcon(type) {
    const map = {
        child: '<i class="bi bi-emoji-smile"></i>',
        elderly: '<i class="bi bi-person-fill"></i>',
        pregnant: '<i class="bi bi-heart-fill"></i>',
        diabetic: '<i class="bi bi-activity"></i>',
        adult: '<i class="bi bi-person-fill"></i>',
        hypertension: '<i class="bi bi-heart-pulse-fill"></i>',
    };
    return map[type] || '<i class="bi bi-person-fill"></i>';
}

// ══════════════════════════════════════════════════════════════
//  FOOD ANALYZER
// ══════════════════════════════════════════════════════════════

async function analyzeFood() {
    const foodItem = document.getElementById('foodItem').value.trim();
    const portion = document.getElementById('foodPortion').value.trim() || '1 serving';

    if (!foodItem) {
        showToast('Please enter a food item to analyze', 'error');
        return;
    }

    const btn = document.getElementById('analyzeFoodBtn');
    const output = document.getElementById('foodAnalysisOutput');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...';

    output.innerHTML = `
        <div class="text-center py-5">
            <div class="loading-spinner mx-auto mb-3" style="width:40px;height:40px"></div>
            <div style="color:var(--text-muted);font-size:14px">
                Analyzing nutritional content of <strong>${escapeHtml(foodItem)}</strong>...
            </div>
        </div>
    `;

    try {
        const res = await fetch('/api/analyze-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ food_item: foodItem, portion }),
        });

        const data = await res.json();

        if (data.analysis) {
            output.innerHTML = `
                <div class="d-flex align-items-center gap-2 mb-3 pb-3" style="border-bottom: 1px solid var(--border)">
                    <i class="bi bi-egg-fried fs-4 text-warning"></i>
                    <div>
                        <div style="font-weight:700;font-size:15px">${escapeHtml(foodItem)}</div>
                        <div style="font-size:12px;color:var(--text-muted)">Portion: ${escapeHtml(portion)}</div>
                    </div>
                </div>
                <div class="analysis-content ai-response">${formatMarkdown(data.analysis)}</div>
            `;
            showToast(`Analysis complete for ${foodItem}!`, 'success');
        } else {
            output.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle empty-icon text-warning"></i><p>Could not analyze this food item. Please try again.</p></div>';
        }
    } catch (err) {
        output.innerHTML = '<div class="empty-state"><i class="bi bi-wifi-off empty-icon text-danger"></i><p>Connection error. Please ensure the Flask server is running.</p></div>';
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-search-heart me-2"></i>Analyze Nutrition';
}

function quickAnalyze(food, portion) {
    document.getElementById('foodItem').value = food;
    document.getElementById('foodPortion').value = portion;
    analyzeFood();
}

// ══════════════════════════════════════════════════════════════
//  MARKDOWN FORMATTER
// ══════════════════════════════════════════════════════════════

function formatMarkdown(text) {
    if (!text) return '';

    return text
        // Headers (must come before bold/italic to avoid conflicts)
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic: only single * not preceded/followed by * (avoids list items)
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Unordered lists (lines starting with - or *)
        .replace(/^[ \t]*[-\*] (.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^[ \t]*\d+\. (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, match => `<ul>${match}</ul>`)
        // Horizontal rules
        .replace(/^---+$/gm, '<hr style="border-color:var(--border);margin:12px 0">')
        // Double newlines become paragraph breaks
        .replace(/\n{2,}/g, '</p><p>')
        // Single newlines become <br>
        .replace(/\n/g, '<br>')
        // Wrap runs of plain text (not already inside an HTML tag) in <p>
        .replace(/^(?!<[a-z])(.*\S.*)$/gm, '<p>$1</p>')
        // Clean up empty paragraphs
        .replace(/<p>\s*<\/p>/g, '');
}

// ══════════════════════════════════════════════════════════════
//  LOADING OVERLAY
// ══════════════════════════════════════════════════════════════

function showLoading(text = 'NutriAI is thinking...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('visible');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('visible');
}

// ══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const iconMap = {
        success: '<i class="bi bi-check-circle-fill" style="color:var(--success)"></i>',
        error:   '<i class="bi bi-x-circle-fill" style="color:var(--danger)"></i>',
        info:    '<i class="bi bi-info-circle-fill" style="color:var(--accent)"></i>',
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `${iconMap[type] || iconMap.info} ${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 3200);
}

// ══════════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════════

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

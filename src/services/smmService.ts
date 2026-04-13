import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const CLUB_CONTEXT = `
Black Bear Dojo — клуб кіокушинкай карате в Києві.
Це серйозний клуб із дисципліною, бренд побудований на реальній тренерській експертизі Ігоря Котляревського (3 дан, МС, 20+ років у спорті).
Позиціювання: сильний, дисциплінований, сучасний, експертний, структурний.
ЦА: Батьки (4-7, 8-12, підлітки), тренери, спортсмени.
Болі батьків: відсутність дисципліни, сором'язливість, гаджети, хаос, потреба у безпечному але сильному середовищі.
Болі тренерів: банальні підходи, нестача системності, слабка фізпідготовка.
Болі спортсменів: слабка вибуховість, швидкість, помилки у підготовці.
`;

export const generateSMMStrategy = async (history: any[]) => {
  const prompt = `
    ${CLUB_CONTEXT}
    
    Історія останніх постів та їх результатів:
    ${JSON.stringify(history.slice(0, 5))}
    
    Дій як професійна SMM-агенція. Проаналізуй контекст та історію.
    Надай тижневу стратегію українською мовою.
    
    Поверни ТІЛЬКИ JSON:
    {
      "strategy_text": "Головний меседж тижня",
      "patterns": ["3 патерни, що зараз працюють"],
      "blind_spots": ["2 сліпі зони, яких треба уникати"],
      "swot": {
        "strengths": ["..."],
        "weaknesses": ["..."],
        "opportunities": ["..."],
        "threats": ["..."]
      }
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  const text = response.text || "";
  const cleanText = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleanText);
};

export const generateContentOptions = async (params: any, history: any[]) => {
  const prompt = `
    ${CLUB_CONTEXT}
    
    Запит користувача:
    Ціль: ${params.goal}
    Аудиторія: ${params.audience}
    Формат: ${params.format}
    Тема: ${params.topic || 'Загальна'}
    Складність: ${params.complexity || 'Середня'}
    AI/Higgsfield: ${params.useAI ? 'Так' : 'Ні'}
    
    Історія попередніх виборів:
    ${JSON.stringify(history.slice(0, 10))}
    
    Дій як професійна SMM-агенція. Згенеруй 3 найкращі варіанти контенту.
    Оціни кожну тему за шкалою 0-100 (Topic Score = Audience Fit * 0.2 + Pain Relevance * 0.2 + Growth Potential * 0.15 + Save Potential * 0.1 + Share Potential * 0.1 + Engagement Potential * 0.1 + Brand Fit * 0.1 + Production Simplicity * 0.03 + Novelty * 0.02).
    
    Поверни ТІЛЬКИ JSON масив з 3 об'єктів:
    [
      {
        "title": "Назва теми",
        "audience": "ЦА",
        "pain": "Який біль зачіпає",
        "reason": "Чому це перспективно",
        "expected_effect": "Підписка/Залучення/Збереження/Пересилання",
        "score": 95,
        "scoring_details": { "relevance": 90, "viral": 85, "difficulty": 70, "brand": 95 },
        "production_pack": {
          "hook": "Хук (0-3с)",
          "script": "Повний сценарій",
          "visual_execution": "Що показати в кадрі",
          "on_screen_text": "Текст на екрані",
          "caption": "Підпис до посту",
          "cta": "Заклик до дії",
          "cover_idea": "Ідея для обкладинки",
          "higgsfield_prompt": "English prompt for Higgsfield AI video"
        }
      }
    ]
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  });

  const text = response.text || "";
  const cleanText = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleanText);
};

export const analyzeAccount = async (posts: any[], insights: any[] = []) => {
  const prompt = `
    ${CLUB_CONTEXT}
    
    Дані про останні публікації (Media):
    ${JSON.stringify(posts.slice(0, 20))}
    
    Дані про охоплення та залученість (Insights):
    ${JSON.stringify(insights)}
    
    Дій як провідний SMM-стратег. Проаналізуй Instagram акаунт клубу на основі цих реальних даних. 
    Вияви сильні та слабкі сторони, рубрики яких не вистачає, та надай стратегічні рекомендації для росту.
    
    Зверни увагу на:
    1. Якість контенту та залученість (лайки, коментарі).
    2. Відповідність бренду Black Bear Dojo (дисципліна, експертність).
    3. Прогалини в контент-плані (наприклад, мало відгуків, мало бекстейджу, мало експертних порад).
    
    Поверни ТІЛЬКИ JSON:
    {
      "strengths": ["3-5 сильних сторін"],
      "weaknesses": ["3-5 слабких сторін"],
      "missing_content": ["3-5 типів контенту, яких бракує"],
      "adjacent_opportunities": ["Суміжні ніші або тренди для впровадження"],
      "recommendations": ["5 конкретних кроків для покращення показників"]
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: prompt
  });

  const text = response.text || "";
  const cleanText = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleanText);
};

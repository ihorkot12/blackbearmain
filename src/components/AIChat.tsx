import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

type Message = { id: string; role: 'user' | 'model'; text: string };

export const AIChat = ({ content }: { content: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const location = window.location.pathname;

  // Initial message based on context
  useEffect(() => {
    let initialText = 'Вітаю! 👋 Я онлайн-помічник Black Bear Dojo. Бачу, ви цікавитесь тренуваннями. Підказати вам розклад чи деталі щодо пробного заняття?';
    
    if (location.includes('kids-4-7')) {
      initialText = 'Вітаю! 👋 Бачу, ви розглядаєте карате для малечі 4-7 років. У нас якраз зараз іде набір у молодшу групу. Хочете дізнатись, як проходять перші тренування?';
    } else if (location.includes('juniors-7-12')) {
      initialText = 'Доброго дня! 👋 Цікавитесь групою для школярів 7-12 років? Це чудовий вік, щоб почати шлях у карате. Розповісти про наші змагання та систему поясів?';
    } else if (location.includes('teens-12-plus')) {
      initialText = 'Привіт! 👋 Шукаєш круте заняття для себе або дитини 12+ років? Карате Кіокушинкай — це не просто спорт, це справжній виклик. Хочеш дізнатись про нашу старшу групу та змагання?';
    } else if (location.includes('personal-training')) {
      initialText = 'Вітаю! 👋 Цікавитесь персональними тренуваннями? Це найшвидший шлях до результату. Підказати вільні години чи розповісти про переваги індивідуального підходу?';
    } else if (location.includes('women-karate')) {
      initialText = 'Вітаю! 👋 Шукаєте ідеальний спорт для себе? Карате — це про естетику, впевненість та зняття стресу. Я розповім, чому це краще за бокс для дівчат!';
    }

    setMessages([{ id: '1', role: 'model', text: initialText }]);
  }, [location]);

  const dynamicSystemInstruction = `Ти — професійний менеджер з продажу та "клоузер" клубу кіокушинкай карате "Black Bear Dojo" у Києві.
Твоя мета: не просто відповідати на запитання, а ЗАКРИВАТИ клієнта на запис на БЕЗКОШТОВНЕ пробне тренування.
Поточна сторінка користувача: ${location}

АЛГОРИТМ ПРОДАЖУ:
1. Встановлення контакту: Привітайся енергійно та позитивно.
2. Виявлення потреб: Запитай про вік дитини (або дорослого) та мету занять (дисципліна, самозахист, спорт).
3. Презентація рішення: Розкажи, як карате вирішить їхній запит (наприклад, "Карате допоможе вашій дитині стати впевненішою та відірве від телефону").
4. Робота з запереченнями: Якщо кажуть "дорого" — нагадай про цінність та безкоштовне перше заняття. Якщо "далеко" — уточни локацію.
5. Закриття (Call to Action): Завжди пропонуй записатися на конкретний час або просто залишити заявку прямо зараз.

ФАКТИ ПРО КЛУБ:
- Назва: Black Bear Dojo.
- Телефон: ${content?.contact_phone || "095 475 65 00"}
- Email: ${content?.contact_email || "info@blackbeardojo.com"}
- Вікові групи: 4-6 років, 7-12 років, 13+ та дорослі.
- Спеціальна група для жінок: Карате для естетики та самооборони (краще за бокс).
- Вартість: 2500 грн/місяць (8-12 тренувань).
- Перше тренування — БЕЗКОШТОВНЕ.
- Переваги: Офіційна федерація, атестації на пояси, змагання, літні табори, професійне татамі.

ПРАВИЛА СПІЛКУВАННЯ:
1. Будь впевненим, але не нав'язливим. Використовуй "ми", "наш клуб", "наші чемпіони".
2. Тексти мають бути короткими (2-4 речення), щоб клієнту було легко читати.
3. Коли клієнт готовий або ти відчуваєш, що час запропонувати запис, ОБОВ'ЯЗКОВО додай у кінці повідомлення: [SIGNUP_BUTTON]
4. Якщо запитують про розклад — кажи, що розклад залежить від вікової групи, і запропонуй уточнити вік, щоб дати точний час.
5. Мова: тільки українська.`;

  // Proactive "Interest" detection
  useEffect(() => {
    const handleTrigger = () => {
      if (!isOpen && !hasInteracted) {
        setIsOpen(true);
      }
    };

    // 1. Trigger on scroll depth
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0 && scrolled / maxScroll > 0.45) {
        handleTrigger();
        window.removeEventListener('scroll', handleScroll);
      }
    };

    // 2. Trigger on intent (hovering over CTA buttons)
    const ctaButtons = document.querySelectorAll('button, a[href="#contact"]');
    const hoverListeners: any[] = [];
    
    ctaButtons.forEach(btn => {
      const listener = () => {
        // Only trigger if they hover for a bit (intent)
        setTimeout(() => {
          if (btn.matches(':hover')) handleTrigger();
        }, 1200);
      };
      btn.addEventListener('mouseenter', listener);
      hoverListeners.push({ btn, listener });
    });

    // 3. Trigger on time spent on key sections
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          // If they stay on Schedule or Contact for 5 seconds, they are interested
          setTimeout(() => {
            if (entry.isIntersecting) handleTrigger();
          }, 5000);
        }
      });
    }, { threshold: 0.5 });

    const sections = ['schedule', 'contact', 'pain-points'].map(id => document.getElementById(id)).filter(Boolean);
    sections.forEach(s => observer.observe(s!));

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      hoverListeners.forEach(({ btn, listener }) => btn.removeEventListener('mouseenter', listener));
      observer.disconnect();
    };
  }, [isOpen, hasInteracted]);

  // Initialize Gemini API
  useEffect(() => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Gemini API key is missing");
      return;
    }
    try {
      const ai = new GoogleGenAI({ apiKey });
      chatRef.current = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: dynamicSystemInstruction,
          temperature: 0.7,
        }
      });
    } catch (e) {
      console.error("Failed to initialize Gemini", e);
    }
  }, [dynamicSystemInstruction]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatRef.current) return;

    const userText = input.trim();
    setInput('');
    setHasInteracted(true);
    
    const newUserMsg: Message = { id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, role: 'user', text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userText });
      const modelMsg: Message = { id: `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, role: 'model', text: response.text };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Вибачте, сталася помилка з\'єднання. Будь ласка, зателефонуйте нам або залиште заявку у формі на сайті.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageText = (text: string) => {
    if (text.includes('[SIGNUP_BUTTON]')) {
      const cleanText = text.replace('[SIGNUP_BUTTON]', '').trim();
      return (
        <div className="space-y-3">
          <div>{cleanText}</div>
          <button 
            onClick={() => {
              setIsOpen(false);
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full bg-red-600 text-white text-xs font-bold uppercase tracking-widest py-2.5 rounded-lg hover:bg-red-500 transition-colors shadow-[0_4px_12px_rgba(220,38,38,0.3)] flex items-center justify-center gap-2"
          >
            Записатися на пробне
          </button>
        </div>
      );
    }
    return text;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-[350px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] flex flex-col mb-4 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-zinc-900 border-b border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider">Помічник Dojo</h3>
                  <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">Онлайн</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsOpen(false); setHasInteracted(true); }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-zinc-800 text-white rounded-br-sm' 
                        : 'bg-red-950/50 border border-red-900/30 text-zinc-200 rounded-bl-sm'
                    }`}
                  >
                    {renderMessageText(msg.text)}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-red-950/50 border border-red-900/30 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-zinc-900 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напишіть повідомлення..."
                className="flex-1 bg-black border border-white/10 rounded-full px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 transition-colors shrink-0"
              >
                <Send size={16} className="ml-0.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setIsOpen(!isOpen); setHasInteracted(true); }}
        className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_40px_rgba(220,38,38,0.6)] transition-shadow relative"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X size={24} className="text-white" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageCircle size={24} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && !hasInteracted && (
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-zinc-950"
          />
        )}
      </motion.button>
    </div>
  );
};

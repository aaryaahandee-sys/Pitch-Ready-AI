import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  Target, 
  Globe, 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Zap, 
  History, 
  Key, 
  LogOut, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  Lightbulb, 
  Brain, 
  ArrowRight,
  Upload,
  Send,
  Loader2,
  ShieldCheck,
  BarChart3,
  PlayCircle
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Screen = 'landing' | 'login' | 'pitch' | 'app';
type Tab = 'evaluation' | 'interview' | 'insights' | 'signals' | 'scenarios' | 'practice' | 'journey';

interface StartupData {
  pitch: string;
  website: string;
  stage: string;
  targetVC: string;
  vcLink: string;
}

interface Message {
  role: 'ai' | 'user';
  text: string;
}

interface EvaluationReport {
  scores: {
    problemClarity: number;
    marketOpportunity: number;
    tractionStrength: number;
    businessModel: number;
    differentiation: number;
    founderCredibility: number;
  };
  decision: 'Reject' | 'Maybe' | 'Interested';
  confidence: string;
  reason: string;
  strengths: string[];
  weaknesses: string[];
  missing: string[];
  improvements: string[];
  redFlags: string[];
  objections: string[];
  mistakes: string[];
  stageInsights: string;
  followups: string[];
  dealBreakers: string[];
  marketPositioning: { saturation: string; strength: string; explanation: string };
  bestFitInvestors: { type: string; reason: string }[];
  insightSummary: { impressed: string[]; concerns: string[]; fixNow: string[] };
  multiVCSimulation: { type: string; decision: string; concern: string; liked: string }[];
  signalAnalysis: {
    positive: { signal: string; explanation: string }[];
    weak: { signal: string; explanation: string }[];
  };
  benchmarking: { area: string; level: string }[];
  actionPlan: { nextSteps: string[]; recommendations: string };
  perspectiveGap: {
    [key: string]: { founder: string; investor: string; gap: 'High' | 'Med' | 'Low' };
  };
  signalInterpretation: { signal: string; interpretation: string; type: 'warning' | 'success' | 'info' }[];
  decisionAccountability: {
    why: string;
    assumptions: string[];
    risks: string[];
    changeTriggers: string[];
  };
  founderReadiness: { clarity: number; thinking: number; execution: number; feedback: string };
  externalSignals: { momentum: 'Rising' | 'Stable' | 'Declining'; interest: 'High' | 'Medium' | 'Low'; trends: string[] };
  realWorldReadiness: { level: string; explanation: string };
  pitchSimulation: { outcome: string; explanation: string };
  timeToFunding: { timeline: string; basis: string };
  founderActionRoadmap: { action: string; priority: 'High' | 'Med' | 'Low' }[];
  investorPsychology: { excitement: string[]; doubt: string[]; rejectionReasons: string[] };
  investmentStory: { oneLineSummary: string; biggestStrength: string; biggestWeakness: string; verdict: string };
}

interface HistoryItem {
  date: string;
  startupName: string;
  avgScore: number;
  report: EvaluationReport;
}

// --- Constants ---
const EVAL_STEPS = [
  { field: 'problem', question: "What specific problem are you solving, and how big is the pain point?" },
  { field: 'customer', question: "Who is your target customer? Be specific about the segment." },
  { field: 'traction', question: "What traction do you have so far? (Users, revenue, pilots, growth rates)" },
  { field: 'businessModel', question: "How do you make money? What are your unit economics?" },
  { field: 'timing', question: "Why is now the right time for this solution? What has changed in the market?" },
  { field: 'differentiation', question: "What makes you 10x better than existing alternatives?" }
];

// --- App Component ---
export default function App() {
  // State
  const [screen, setScreen] = useState<Screen>('landing');
  const [activeTab, setActiveTab] = useState<Tab>('evaluation');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('geminiApiKey') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [startupData, setStartupData] = useState<StartupData>({
    pitch: '',
    website: '',
    stage: 'Idea',
    targetVC: '',
    vcLink: ''
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [evalStep, setEvalStep] = useState(-1); // -1: not started, 0-5: evaluation steps, 6: complete
  const [evalAnswers, setEvalAnswers] = useState<Record<string, string>>({});
  
  const [interviewStep, setInterviewStep] = useState(0);
  const [isInterviewMode, setIsInterviewMode] = useState(false);
  
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(
    JSON.parse(localStorage.getItem('evaluationHistory') || '[]')
  );
  
  const [practicePitch, setPracticePitch] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<any>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  
  const [scenarioResult, setScenarioResult] = useState<any>(null);
  const [isSimulatingScenario, setIsSimulatingScenario] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Effects
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    localStorage.setItem('evaluationHistory', JSON.stringify(history));
  }, [history]);

  // --- Helpers ---
  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('geminiApiKey', key);
    setShowApiKeyModal(false);
  };

  const logout = () => {
    localStorage.removeItem('userName');
    setUserName('');
    setScreen('landing');
  };

  const addMessage = (role: 'ai' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const getAI = () => {
    if (!apiKey) {
      setShowApiKeyModal(true);
      return null;
    }
    return new GoogleGenAI({ apiKey });
  };

  // --- Logic ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      localStorage.setItem('userName', userName);
      setScreen('pitch');
    }
  };

  const startEvaluation = () => {
    if (!apiKey) return setShowApiKeyModal(true);
    setEvalStep(0);
    addMessage('ai', EVAL_STEPS[0].question);
  };

  const handleChatSubmit = async (text: string) => {
    if (!text.trim()) return;
    addMessage('user', text);
    
    if (evalStep >= 0 && evalStep < EVAL_STEPS.length) {
      const currentField = EVAL_STEPS[evalStep].field;
      setEvalAnswers(prev => ({ ...prev, [currentField]: text }));
      
      const nextStep = evalStep + 1;
      setEvalStep(nextStep);
      
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        if (nextStep < EVAL_STEPS.length) {
          addMessage('ai', EVAL_STEPS[nextStep].question);
        } else {
          addMessage('ai', "I have enough information to form an investment thesis. You can now generate the full report in the Insights tab.");
        }
      }, 800);
    } else if (isInterviewMode) {
      handleInterviewResponse(text);
    } else {
      // General Chat
      handleGeneralChat(text);
    }
  };

  const handleGeneralChat = async (text: string) => {
    const ai = getAI();
    if (!ai) return;
    
    setIsTyping(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: 'user', parts: [{ text: `You are a senior VC analyst. Context: ${startupData.pitch}. User says: ${text}` }] }
        ]
      });
      addMessage('ai', response.text || "I'm sorry, I couldn't process that.");
    } catch (err) {
      addMessage('ai', "Error connecting to AI. Please check your API key.");
    } finally {
      setIsTyping(false);
    }
  };

  const startInterview = () => {
    if (!apiKey) return setShowApiKeyModal(true);
    setIsInterviewMode(true);
    setInterviewStep(1);
    addMessage('ai', "I'm now switching to **Aggressive Partner Mode**. I will challenge every assumption you have. No more polite questions. Let's start: **Why should I care about your startup when 100 others are doing the same thing?**");
  };

  const handleInterviewResponse = async (text: string) => {
    const ai = getAI();
    if (!ai) return;
    
    const nextStep = interviewStep + 1;
    setInterviewStep(nextStep);
    
    if (nextStep > 5) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addMessage('ai', "That's enough for now. I've seen enough to make a call. You can now generate the full report to see my final decision.");
        setIsInterviewMode(false);
      }, 1000);
      return;
    }

    setIsTyping(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          { role: 'user', parts: [{ text: `You are a tough VC partner. Context: ${startupData.pitch}. User said: ${text}. This is question ${nextStep} of 5. Ask the next sharp, critical question.` }] }
        ]
      });
      addMessage('ai', response.text || "Next question...");
    } catch (err) {
      addMessage('ai', "Error connecting to AI.");
    } finally {
      setIsTyping(false);
    }
  };

  const generateReport = async () => {
    const ai = getAI();
    if (!ai) return;
    
    setIsTyping(true);
    try {
      const prompt = `
        You are a senior VC analyst evaluating a startup for ${startupData.targetVC || 'a VC'}.
        
        CONTEXT:
        Startup Pitch: ${startupData.pitch}
        Stage: ${startupData.stage}
        Target VC: ${startupData.targetVC}
        
        EVALUATION DATA:
        ${JSON.stringify(evalAnswers)}
        
        Generate a comprehensive VC intelligence report in JSON format following this schema:
        {
          "scores": { "problemClarity": 0-100, "marketOpportunity": 0-100, "tractionStrength": 0-100, "businessModel": 0-100, "differentiation": 0-100, "founderCredibility": 0-100 },
          "decision": "Reject" | "Maybe" | "Interested",
          "confidence": "X%",
          "reason": "Short explanation",
          "strengths": [], "weaknesses": [], "missing": [], "improvements": [], "redFlags": [], "objections": [], "mistakes": [], "stageInsights": "text", "followups": [], "dealBreakers": [],
          "marketPositioning": { "saturation": "Low/Med/High", "strength": "Weak/Mod/Strong", "explanation": "" },
          "bestFitInvestors": [ { "type": "", "reason": "" } ],
          "insightSummary": { "impressed": [], "concerns": [], "fixNow": [] },
          "multiVCSimulation": [ { "type": "Early-stage VC", "decision": "", "concern": "", "liked": "" }, { "type": "Growth VC", "decision": "", "concern": "", "liked": "" }, { "type": "Sector-focused VC", "decision": "", "concern": "", "liked": "" } ],
          "signalAnalysis": { "positive": [ { "signal": "", "explanation": "" } ], "weak": [ { "signal": "", "explanation": "" } ] },
          "benchmarking": [ { "area": "Traction/Market/Model", "level": "Below/Average/Above" } ],
          "actionPlan": { "nextSteps": [], "recommendations": "" },
          "perspectiveGap": { "problem": { "founder": "", "investor": "", "gap": "High/Med/Low" }, "market": { "founder": "", "investor": "", "gap": "High/Med/Low" }, "traction": { "founder": "", "investor": "", "gap": "High/Med/Low" }, "differentiation": { "founder": "", "investor": "", "gap": "High/Med/Low" } },
          "signalInterpretation": [ { "signal": "", "interpretation": "", "type": "warning/success/info" } ],
          "decisionAccountability": { "why": "", "assumptions": [], "risks": [], "changeTriggers": [] },
          "founderReadiness": { "clarity": 0-100, "thinking": 0-100, "execution": 0-100, "feedback": "" },
          "externalSignals": { "momentum": "Rising" | "Stable" | "Declining", "interest": "High" | "Medium" | "Low", "trends": [] },
          "realWorldReadiness": { "level": "", "explanation": "" },
          "pitchSimulation": { "outcome": "", "explanation": "" },
          "timeToFunding": { "timeline": "", "basis": "" },
          "founderActionRoadmap": [ { "action": "", "priority": "High" | "Med" | "Low" } ],
          "investorPsychology": { "excitement": [], "doubt": [], "rejectionReasons": [] },
          "investmentStory": { "oneLineSummary": "", "biggestStrength": "", "biggestWeakness": "", "verdict": "" }
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      
      const reportData = JSON.parse(response.text || '{}');
      setReport(reportData);
      setActiveTab('insights');
      
      // Add to history
      const avgScore = Math.round(Object.values(reportData.scores).reduce((a: any, b: any) => a + b, 0) as number / 6);
      const newHistoryItem: HistoryItem = {
        date: new Date().toISOString(),
        startupName: `${userName}'s Startup`,
        avgScore,
        report: reportData
      };
      setHistory(prev => [newHistoryItem, ...prev]);
      
    } catch (err) {
      console.error(err);
      alert("Error generating report.");
    } finally {
      setIsTyping(false);
    }
  };

  const runScenario = async (type: string) => {
    const ai = getAI();
    if (!ai || !report) return;
    
    setIsSimulatingScenario(true);
    try {
      const scenarios: any = {
        traction: "What if traction increases 3x in the next 6 months?",
        pricing: "What if the pricing model shifts from subscription to usage-based?",
        market: "What if the addressable market size grows 2x due to new regulations?",
        competitor: "What if a FAANG company enters this specific niche?"
      };
      
      const prompt = `Based on this evaluation: ${JSON.stringify(report)}. Simulate: "${scenarios[type]}". JSON: { "newScore": 0-100, "newDecision": "", "impact": "", "newRisks": [], "newOpportunities": [] }`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      
      setScenarioResult(JSON.parse(response.text || '{}'));
    } catch (err) {
      alert("Error simulating scenario.");
    } finally {
      setIsSimulatingScenario(false);
    }
  };

  const evaluatePractice = async () => {
    const ai = getAI();
    if (!ai || !practicePitch.trim()) return;
    
    setIsPracticing(true);
    try {
      const prompt = `Evaluate this 1-minute pitch: "${practicePitch}". JSON: { "clarity": 0-10, "structure": 0-10, "confidence": 0-10, "feedback": "", "tips": [] }`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      setPracticeFeedback(JSON.parse(response.text || '{}'));
    } catch (err) {
      alert("Error evaluating pitch.");
    } finally {
      setIsPracticing(false);
    }
  };

  const runDemo = (type: 'weak' | 'strong') => {
    if (!apiKey) return setShowApiKeyModal(true);
    
    if (type === 'weak') {
      setStartupData({
        pitch: "We are building a social network for pets. It's like Facebook but for dogs and cats. We don't have any users yet but we think it will be huge because people love their pets.",
        website: "http://petsocial.demo",
        stage: "Idea",
        targetVC: "Generic Ventures",
        vcLink: ""
      });
      setEvalAnswers({
        problem: "People want to share pet photos but Facebook is too cluttered.",
        customer: "Every pet owner in the world.",
        traction: "None yet, just an idea.",
        businessModel: "Advertising and selling pet food.",
        timing: "Pets are more popular than ever.",
        differentiation: "We are the only ones doing it specifically for pets."
      });
    } else {
      setStartupData({
        pitch: "We provide an AI-driven predictive maintenance platform for industrial manufacturing plants. Our software reduces downtime by 30% using proprietary sensor fusion algorithms.",
        website: "https://industriai.demo",
        stage: "Early Traction",
        targetVC: "Industrial Partners",
        vcLink: ""
      });
      setEvalAnswers({
        problem: "Unplanned downtime costs manufacturers $50B annually.",
        customer: "Fortune 500 manufacturing firms in automotive and aerospace.",
        traction: "$500k ARR, 3 pilots with major OEMs, 15% MoM growth.",
        businessModel: "SaaS subscription based on number of connected machines.",
        timing: "Industry 4.0 transition and rising energy costs are forcing efficiency.",
        differentiation: "Our algorithms are trained on 10 years of proprietary sensor data from our parent research lab."
      });
    }
    
    setScreen('app');
    setActiveTab('insights');
    generateReport();
  };

  // --- Render Sections ---
  
  const LandingScreen = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
          <ShieldCheck size={18} />
          <span>Trusted by 500+ Founders</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-text-dark">
          PitchReady <span className="text-primary">AI</span>
        </h1>
        <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
          The VC Analyst Co-Pilot that stress-tests your startup before you enter the boardroom. Get brutal feedback, market signals, and a roadmap to funding.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <button onClick={() => setScreen('login')} className="btn btn-primary text-lg px-8 py-4">
            Get Started <ArrowRight className="ml-2" size={20} />
          </button>
          <button onClick={() => runDemo('strong')} className="btn btn-outline text-lg px-8 py-4">
            <PlayCircle className="mr-2" size={20} /> Watch Demo
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="card">
            <Brain className="text-primary mb-4" size={32} />
            <h3 className="font-bold mb-2">AI Stress Test</h3>
            <p className="text-sm text-text-muted">Simulate high-pressure VC interviews with aggressive AI personas.</p>
          </div>
          <div className="card">
            <BarChart3 className="text-primary mb-4" size={32} />
            <h3 className="font-bold mb-2">Market Signals</h3>
            <p className="text-sm text-text-muted">Real-time market momentum and investor sentiment analysis.</p>
          </div>
          <div className="card">
            <Zap className="text-primary mb-4" size={32} />
            <h3 className="font-bold mb-2">Funding Roadmap</h3>
            <p className="text-sm text-text-muted">Step-by-step action plan to reach your next funding milestone.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );

  const LoginScreen = () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-2">Welcome Founder</h2>
        <p className="text-text-muted mb-6">Enter your name to start your evaluation.</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input 
              type="text" 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
              placeholder="John Doe"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full py-3">
            Continue
          </button>
        </form>
      </motion.div>
    </div>
  );

  const PitchScreen = () => (
    <div className="min-h-screen p-6 md:p-12 max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Your Startup Profile</h2>
          <button onClick={() => setScreen('landing')} className="text-text-muted hover:text-text-dark">
            <LogOut size={20} />
          </button>
        </div>
        
        <div className="card space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-1">Startup Stage</label>
              <select 
                value={startupData.stage}
                onChange={(e) => setStartupData({...startupData, stage: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none"
              >
                <option>Idea</option>
                <option>MVP</option>
                <option>Early Traction</option>
                <option>Scaling</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target VC (Optional)</label>
              <input 
                type="text" 
                value={startupData.targetVC}
                onChange={(e) => setStartupData({...startupData, targetVC: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none"
                placeholder="e.g. Sequoia, a16z"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Your Pitch / Elevator Pitch</label>
            <textarea 
              value={startupData.pitch}
              onChange={(e) => setStartupData({...startupData, pitch: e.target.value})}
              className="w-full h-40 px-4 py-2 rounded-lg border border-gray-200 outline-none resize-none"
              placeholder="Describe what you're building, the problem, and your traction..."
            />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Website URL</label>
              <input 
                type="url" 
                value={startupData.website}
                onChange={(e) => setStartupData({...startupData, website: e.target.value})}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none"
                placeholder="https://mystartup.com"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Upload Pitch Deck (Text Only)</label>
              <div className="relative">
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setStartupData({...startupData, pitch: ev.target?.result as string});
                      reader.readAsText(file);
                    }
                  }}
                />
                <div className="w-full px-4 py-2 rounded-lg border border-dashed border-gray-300 text-center text-sm text-text-muted">
                  <Upload size={16} className="inline mr-2" /> Click to upload .txt
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              if (startupData.pitch.length < 50) return alert("Please provide a more detailed pitch.");
              setScreen('app');
              setMessages([{ role: 'ai', text: `Hi ${userName}, I've reviewed your pitch. Ready to be challenged? Click "Start Evaluation" to begin.` }]);
            }}
            className="btn btn-primary w-full py-4 text-lg"
          >
            Enter Analyst Room
          </button>
        </div>
      </motion.div>
    </div>
  );

  const AppHeader = () => (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">P</div>
          <span>PitchReady</span>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Analyst Online</span>
          </div>
          <div className="h-4 w-px bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{userName}</span>
            <button onClick={() => setScreen('pitch')} className="p-2 hover:bg-gray-100 rounded-lg text-text-muted">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
        <nav className="flex gap-8">
          {[
            { id: 'evaluation', label: 'Evaluation', icon: MessageSquare },
            { id: 'interview', label: 'Interview', icon: Zap },
            { id: 'insights', label: 'Insights', icon: BarChart3, disabled: !report },
            { id: 'signals', label: 'Signals', icon: TrendingUp, disabled: !report },
            { id: 'scenarios', label: 'Scenarios', icon: Target, disabled: !report },
            { id: 'practice', label: 'Practice', icon: PlayCircle },
            { id: 'journey', label: 'Journey', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id as Tab)}
              disabled={tab.disabled}
              className={cn(
                "flex items-center gap-2 py-4 border-b-2 transition-all whitespace-nowrap",
                activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-dark",
                tab.disabled && "opacity-30 cursor-not-allowed"
              )}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );

  const ChatArea = () => {
    const [input, setInput] = useState('');
    
    return (
      <div className="flex flex-col h-[calc(100vh-160px)]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-3 rounded-2xl",
                msg.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-white border border-gray-100 rounded-tl-none"
              )}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex gap-1 p-3 bg-white border border-gray-100 rounded-2xl w-16">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-150"></div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div className="p-6 bg-white border-t border-gray-100">
          <div className="flex gap-2 mb-4">
            {evalStep === -1 && (
              <button onClick={startEvaluation} className="btn btn-outline btn-sm">
                <PlayCircle size={14} className="mr-1" /> Start Evaluation
              </button>
            )}
            {!isInterviewMode && (
              <button onClick={() => setActiveTab('interview')} className="btn btn-outline btn-sm">
                <Zap size={14} className="mr-1" /> Start Interview
              </button>
            )}
            <button 
              onClick={generateReport} 
              disabled={evalStep < EVAL_STEPS.length}
              className="btn btn-primary btn-sm ml-auto"
            >
              Generate Insights
            </button>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (handleChatSubmit(input), setInput(''))}
              placeholder="Type your response..."
              className="flex-1 px-4 py-2 rounded-lg border border-gray-200 outline-none"
            />
            <button 
              onClick={() => { handleChatSubmit(input); setInput(''); }}
              className="btn btn-primary"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const InsightsTab = () => {
    if (!report) return null;
    
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Score Header */}
        <div className="card bg-gradient-to-br from-white to-light-blue border-none shadow-md text-center py-12">
          <div className="w-32 h-32 rounded-full border-8 border-primary flex items-center justify-center text-4xl font-bold text-primary mx-auto mb-6">
            {Math.round(Object.values(report.scores).reduce((a: any, b: any) => a + b, 0) as number / 6)}%
          </div>
          <h2 className="text-3xl font-bold mb-2">{userName}'s Startup Analysis</h2>
          <div className={cn(
            "inline-block px-6 py-2 rounded-full font-bold text-lg mb-4",
            report.decision === 'Interested' ? "bg-green-100 text-green-700" : 
            report.decision === 'Maybe' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          )}>
            {report.decision}
          </div>
          <p className="text-lg italic text-text-muted max-w-2xl mx-auto">"{report.investmentStory.oneLineSummary}"</p>
        </div>

        {/* Core Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card border-l-4 border-green-500">
            <h3 className="font-bold flex items-center gap-2 mb-4"><CheckCircle2 className="text-green-500" size={18} /> Strengths</h3>
            <ul className="text-sm space-y-2">
              {report.strengths.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
          <div className="card border-l-4 border-red-500">
            <h3 className="font-bold flex items-center gap-2 mb-4"><AlertCircle className="text-red-500" size={18} /> Weaknesses</h3>
            <ul className="text-sm space-y-2">
              {report.weaknesses.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
          <div className="card border-l-4 border-amber-500">
            <h3 className="font-bold flex items-center gap-2 mb-4"><HelpCircle className="text-amber-500" size={18} /> Missing Info</h3>
            <ul className="text-sm space-y-2">
              {report.missing.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
          <div className="card border-l-4 border-primary">
            <h3 className="font-bold flex items-center gap-2 mb-4"><Rocket className="text-primary" size={18} /> Improvements</h3>
            <ul className="text-sm space-y-2">
              {report.improvements.map((s, i) => <li key={i}>• {s}</li>)}
            </ul>
          </div>
        </div>

        {/* Scores Detail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card">
            <h3 className="font-bold text-xl mb-6">Analyst Scorecard</h3>
            <div className="space-y-4">
              {Object.entries(report.scores).map(([key, val]) => {
                const score = val as number;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-bold">{score}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-1000",
                          score >= 80 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="card">
            <h3 className="font-bold text-xl mb-6">Investment Thesis</h3>
            <p className="text-text-muted mb-6 leading-relaxed">{report.reason}</p>
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <h4 className="font-bold text-primary mb-2">What would change my mind?</h4>
              <ul className="text-sm space-y-2">
                {report.decisionAccountability.changeTriggers.map((t, i) => (
                  <li key={i} className="flex gap-2">
                    <ArrowRight size={14} className="mt-1 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Roadmap */}
        <div className="card">
          <h3 className="font-bold text-xl mb-6">Founder Action Roadmap</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {report.founderActionRoadmap.map((item, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary/20 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div>
                  <div className="font-bold mb-1">{item.action}</div>
                  <span className={cn(
                    "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded",
                    item.priority === 'High' ? "bg-red-100 text-red-700" : 
                    item.priority === 'Med' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {item.priority} Priority
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const InterviewTab = () => (
    <div className="p-6 max-w-4xl mx-auto">
      {!isInterviewMode && interviewStep === 0 ? (
        <div className="card text-center py-16">
          <Zap className="text-amber-500 mx-auto mb-6" size={64} />
          <h2 className="text-3xl font-bold mb-4">VC Interview Simulator</h2>
          <p className="text-text-muted mb-8 max-w-lg mx-auto">
            Face a high-pressure interview with a virtual VC partner. 5 sharp, critical questions to test your readiness.
          </p>
          <button onClick={startInterview} className="btn btn-warning px-10 py-4 text-lg">
            Enter the Boardroom
          </button>
        </div>
      ) : (
        <div className="flex flex-col h-[calc(100vh-200px)]">
          <div className="flex justify-between items-center mb-4">
            <div className="status-badge status-maybe">
              Question {interviewStep} of 5
            </div>
          </div>
          <ChatArea />
        </div>
      )}
    </div>
  );

  const SignalsTab = () => {
    if (!report) return null;
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="card border-t-4 border-blue-500">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-1">External Market Signals</h2>
              <p className="text-text-muted">Real-time simulation of market momentum and investor sentiment.</p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-text-muted uppercase mb-1">Market Momentum</div>
              <div className={cn(
                "px-4 py-1 rounded-full font-bold",
                report.externalSignals.momentum === 'Rising' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              )}>
                {report.externalSignals.momentum}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="font-bold flex items-center gap-2 mb-4"><TrendingUp size={18} /> Growth Trends</h3>
              <ul className="space-y-3">
                {report.externalSignals.trends.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5"></div>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h3 className="font-bold flex items-center gap-2 mb-4"><Zap size={18} /> Investor Interest</h3>
              <div className="text-4xl font-bold text-primary mb-2">{report.externalSignals.interest}</div>
              <p className="text-sm text-text-muted">Investors are currently {report.externalSignals.interest.toLowerCase()} on this category due to current market dynamics.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ScenariosTab = () => {
    if (!report) return null;
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="card border-t-4 border-amber-500">
          <h2 className="text-2xl font-bold mb-1">"What If" Scenario Simulation</h2>
          <p className="text-text-muted mb-8">Test how changes in your business model or traction impact investor decisions.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="text-xs font-bold text-text-muted uppercase mb-2">Select Scenario</div>
              {[
                { id: 'traction', label: '3x Traction Growth' },
                { id: 'pricing', label: 'Pricing Model Shift' },
                { id: 'market', label: 'Market Size Expansion' },
                { id: 'competitor', label: 'New Big Competitor' }
              ].map(s => (
                <button 
                  key={s.id}
                  onClick={() => runScenario(s.id)}
                  className="btn btn-outline w-full justify-start py-3"
                >
                  {s.label}
                </button>
              ))}
            </div>
            
            <div className="md:col-span-2 min-h-[300px] bg-gray-50 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              {isSimulatingScenario ? (
                <div className="space-y-4">
                  <Loader2 className="animate-spin text-primary mx-auto" size={48} />
                  <p className="font-medium">Simulating impact...</p>
                </div>
              ) : scenarioResult ? (
                <div className="w-full text-left">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Simulation Result</h3>
                    <div className={cn(
                      "px-4 py-1 rounded-full font-bold",
                      scenarioResult.newDecision === 'Interested' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {scenarioResult.newDecision} ({scenarioResult.newScore}%)
                    </div>
                  </div>
                  <p className="mb-6 leading-relaxed">{scenarioResult.impact}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-green-600 uppercase mb-2">New Opportunities</h4>
                      <ul className="text-sm space-y-1">
                        {scenarioResult.newOpportunities.map((o: string, i: number) => <li key={i}>• {o}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-red-600 uppercase mb-2">New Risks</h4>
                      <ul className="text-sm space-y-1">
                        {scenarioResult.newRisks.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-text-muted">Select a scenario to simulate the impact on your investment readiness.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PracticeTab = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-1">Practice Your Pitch</h2>
        <p className="text-text-muted mb-6">Give your 1-minute elevator pitch. We'll evaluate your clarity, structure, and confidence.</p>
        
        <textarea 
          value={practicePitch}
          onChange={(e) => setPracticePitch(e.target.value)}
          className="w-full h-48 p-4 rounded-xl border border-gray-200 outline-none resize-none mb-4"
          placeholder="Type or paste your 1-minute pitch here..."
        />
        
        <button 
          onClick={evaluatePractice}
          disabled={isPracticing || !practicePitch.trim()}
          className="btn btn-primary w-full py-4"
        >
          {isPracticing ? <Loader2 className="animate-spin" /> : "Evaluate Pitch"}
        </button>

        {practiceFeedback && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 p-6 bg-gray-50 rounded-2xl border-t-4 border-primary"
          >
            <h3 className="font-bold text-xl mb-6">Pitch Feedback</h3>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center">
                <div className="text-xs font-bold text-text-muted uppercase mb-1">Clarity</div>
                <div className="text-2xl font-bold text-primary">{practiceFeedback.clarity}/10</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-text-muted uppercase mb-1">Structure</div>
                <div className="text-2xl font-bold text-primary">{practiceFeedback.structure}/10</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-bold text-text-muted uppercase mb-1">Confidence</div>
                <div className="text-2xl font-bold text-primary">{practiceFeedback.confidence}/10</div>
              </div>
            </div>
            <p className="mb-6">{practiceFeedback.feedback}</p>
            <h4 className="font-bold text-sm mb-2">Tips for Improvement:</h4>
            <ul className="text-sm space-y-2">
              {practiceFeedback.tips.map((t: string, i: number) => <li key={i} className="flex gap-2"><ArrowRight size={14} className="mt-1" /> {t}</li>)}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );

  const JourneyTab = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-bold mb-1">Your Improvement Journey</h2>
        <p className="text-text-muted mb-8">Track your progress as you refine your pitch and business model.</p>
        
        {history.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            No evaluations yet. Complete your first analysis to start your journey!
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-6 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setReport(item.report); setActiveTab('insights'); }}>
                <div>
                  <div className="font-bold text-lg">{item.startupName}</div>
                  <div className="text-sm text-text-muted">{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{item.avgScore}%</div>
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Avg Score</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-bg-main">
      {screen === 'landing' && <LandingScreen />}
      {screen === 'login' && <LoginScreen />}
      {screen === 'pitch' && <PitchScreen />}
      
      {screen === 'app' && (
        <>
          <AppHeader />
          <main className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'evaluation' && <ChatArea />}
                {activeTab === 'interview' && <InterviewTab />}
                {activeTab === 'insights' && <InsightsTab />}
                {activeTab === 'signals' && <SignalsTab />}
                {activeTab === 'scenarios' && <ScenariosTab />}
                {activeTab === 'practice' && <PracticeTab />}
                {activeTab === 'journey' && <JourneyTab />}
              </motion.div>
            </AnimatePresence>
          </main>
        </>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-md"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Key size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Gemini API Key Required</h3>
                <p className="text-xs text-text-muted">To power the VC Analyst AI</p>
              </div>
            </div>
            
            <p className="text-sm mb-6 leading-relaxed">
              We use Google's Gemini 2.0 Flash to provide deep insights. Your key is stored locally in your browser and never sent to our servers.
            </p>
            
            <div className="space-y-4">
              <input 
                type="password" 
                id="api-key-input"
                defaultValue={apiKey}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Paste your API key here..."
              />
              <div className="flex gap-3">
                <button onClick={() => setShowApiKeyModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button 
                  onClick={() => {
                    const val = (document.getElementById('api-key-input') as HTMLInputElement).value;
                    if (val) saveApiKey(val);
                  }} 
                  className="btn btn-primary flex-1"
                >
                  Save Key
                </button>
              </div>
              <p className="text-[10px] text-center text-text-muted">
                Don't have a key? Get one for free at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-primary underline">Google AI Studio</a>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

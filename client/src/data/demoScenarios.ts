/**
 * Prefilled demo scenarios for the Basic splitter.
 * Used for viral demo experience — no backend.
 */

export interface DemoParticipant {
  id: string;
  name: string;
  emoji: string;
  color: string; // Tailwind gradient/background classes
}

export interface DemoExpense {
  id: string;
  description: string;
  amount: number;
  paidById: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  participants: DemoParticipant[];
  expenses: DemoExpense[];
}

function uuid() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "barcelona",
    title: "Weekend Barcelona",
    participants: [
      { id: "p1", name: "Tom", emoji: "🇳🇱", color: "from-amber-500/80 to-orange-600/80" },
      { id: "p2", name: "Maria", emoji: "🇪🇸", color: "from-red-500/80 to-rose-600/80" },
      { id: "p3", name: "Luca", emoji: "🇮🇹", color: "from-green-500/80 to-emerald-600/80" },
      { id: "p4", name: "Sophie", emoji: "🇫🇷", color: "from-blue-500/80 to-indigo-600/80" },
    ],
    expenses: [
      { id: "e1", description: "Airbnb", amount: 180, paidById: "p1" },
      { id: "e2", description: "Tapas night", amount: 52, paidById: "p2" },
      { id: "e3", description: "Uber rides", amount: 24, paidById: "p3" },
      { id: "e4", description: "Groceries", amount: 38, paidById: "p4" },
    ],
  },
  {
    id: "bbq",
    title: "BBQ Night",
    participants: [
      { id: "p1", name: "Alex", emoji: "🔥", color: "from-orange-500/80 to-amber-600/80" },
      { id: "p2", name: "Jamie", emoji: "🍖", color: "from-rose-500/80 to-pink-600/80" },
      { id: "p3", name: "Sam", emoji: "🍺", color: "from-amber-400/80 to-yellow-600/80" },
      { id: "p4", name: "Jordan", emoji: "🥗", color: "from-green-500/80 to-teal-600/80" },
    ],
    expenses: [
      { id: "e1", description: "Meat & sausages", amount: 85, paidById: "p1" },
      { id: "e2", description: "Drinks", amount: 42, paidById: "p2" },
      { id: "e3", description: "Charcoal & supplies", amount: 28, paidById: "p3" },
      { id: "e4", description: "Salads & sides", amount: 35, paidById: "p4" },
    ],
  },
  {
    id: "ski",
    title: "Ski Trip",
    participants: [
      { id: "p1", name: "Chris", emoji: "⛷️", color: "from-sky-500/80 to-blue-600/80" },
      { id: "p2", name: "Emma", emoji: "🎿", color: "from-violet-500/80 to-purple-600/80" },
      { id: "p3", name: "Leo", emoji: "🏔️", color: "from-slate-500/80 to-zinc-600/80" },
      { id: "p4", name: "Nina", emoji: "☕", color: "from-amber-500/80 to-brown-600/80" },
    ],
    expenses: [
      { id: "e1", description: "Lift passes", amount: 220, paidById: "p1" },
      { id: "e2", description: "Chalet dinner", amount: 95, paidById: "p2" },
      { id: "e3", description: "Apres-ski drinks", amount: 48, paidById: "p3" },
      { id: "e4", description: "Breakfast run", amount: 32, paidById: "p4" },
    ],
  },
  {
    id: "birthday",
    title: "Birthday Party",
    participants: [
      { id: "p1", name: "Mia", emoji: "🎂", color: "from-pink-500/80 to-rose-600/80" },
      { id: "p2", name: "Oscar", emoji: "🎈", color: "from-fuchsia-500/80 to-pink-600/80" },
      { id: "p3", name: "Lily", emoji: "🎁", color: "from-cyan-500/80 to-blue-600/80" },
      { id: "p4", name: "Noah", emoji: "🥳", color: "from-yellow-500/80 to-amber-600/80" },
    ],
    expenses: [
      { id: "e1", description: "Cake", amount: 45, paidById: "p1" },
      { id: "e2", description: "Decorations", amount: 38, paidById: "p2" },
      { id: "e3", description: "Pizza", amount: 72, paidById: "p3" },
      { id: "e4", description: "Drinks", amount: 55, paidById: "p4" },
    ],
  },
  {
    id: "roadtrip",
    title: "Roadtrip Europe",
    participants: [
      { id: "p1", name: "Finn", emoji: "🚗", color: "from-orange-500/80 to-red-600/80" },
      { id: "p2", name: "Zara", emoji: "🗺️", color: "from-teal-500/80 to-cyan-600/80" },
      { id: "p3", name: "Kai", emoji: "⛽", color: "from-lime-500/80 to-green-600/80" },
      { id: "p4", name: "Eva", emoji: "🛣️", color: "from-indigo-500/80 to-violet-600/80" },
    ],
    expenses: [
      { id: "e1", description: "Fuel", amount: 180, paidById: "p1" },
      { id: "e2", description: "Hotels", amount: 340, paidById: "p2" },
      { id: "e3", description: "Tolls & parking", amount: 65, paidById: "p3" },
      { id: "e4", description: "Food & snacks", amount: 92, paidById: "p4" },
    ],
  },
];

const COLORS = [
  "from-amber-500/80 to-orange-600/80",
  "from-red-500/80 to-rose-600/80",
  "from-green-500/80 to-emerald-600/80",
  "from-blue-500/80 to-indigo-600/80",
  "from-violet-500/80 to-purple-600/80",
];

export function scenarioToState(scenario: DemoScenario) {
  const idMap: Record<string, string> = {};
  scenario.participants.forEach((p) => {
    idMap[p.id] = uuid();
  });
  return {
    participants: scenario.participants.map((p, i) => ({
      id: idMap[p.id],
      name: `${p.name} ${p.emoji}`,
      color: p.color || COLORS[i % COLORS.length],
    })),
    expenses: scenario.expenses.map((e) => ({
      id: uuid(),
      description: e.description,
      amount: e.amount,
      paidById: idMap[e.paidById] ?? Object.values(idMap)[0],
    })),
    title: scenario.title,
  };
}

export function getDefaultScenario() {
  return scenarioToState(DEMO_SCENARIOS[0]);
}

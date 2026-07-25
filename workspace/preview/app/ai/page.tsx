import Link from "next/link";

export default function AILearningPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Hero */}
      <section className="text-center mb-16 animate-fade-in-up">
        <div className="inline-block px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-white text-sm font-medium mb-4">
          AI Обучение
        </div>
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Освойте искусственный интеллект
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          От основ машинного обучения до продвинутых нейросетей.
          Практические курсы, реальные проекты и сообщество энтузиастов.
        </p>
        <div className="flex justify-center gap-4 mt-8">
          <Link
            href="#courses"
            className="px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors font-medium"
          >
            Начать обучение
          </Link>
          <Link
            href="#"
            className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:shadow-md transition-shadow font-medium"
          >
            Тест-драйв
          </Link>
        </div>
      </section>

      {/* Курсы */}
      <section id="courses" className="mb-16 animate-fade-in-up">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
          Популярные курсы
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {courses.map((course, idx) => (
            <CourseCard key={idx} {...course} delay={idx * 0.1} />
          ))}
        </div>
      </section>

      {/* Практика */}
      <section className="mb-16 animate-fade-in-up">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
          Практические задания
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tasks.map((task, idx) => (
            <TaskCard key={idx} {...task} delay={idx * 0.1} />
          ))}
        </div>
      </section>

      {/* Сообщество */}
      <section className="animate-fade-in-up">
        <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">
          Сообщество
        </h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <p className="text-gray-500 text-lg mb-4">
            Присоединяйтесь к тысячам студентов и профессионалов.
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {["📘", "💬", "🎙️", "🤝"].map((emoji) => (
              <span key={emoji} className="text-3xl">{emoji}</span>
            ))}
          </div>
          <p className="text-gray-400 mt-4 text-sm">
            Discord · Telegram · YouTube · Хакатоны
          </p>
        </div>
      </section>

      {/* Сниппет кода для вдохновения */}
      <section className="mt-16 animate-fade-in-up">
        <div className="bg-gray-900 rounded-2xl p-6 overflow-x-auto">
          <pre className="text-green-400 text-sm leading-relaxed">
{`# Пример: обучение нейросети на PyTorch
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(784, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

for epoch in range(10):
    # training loop
    pass`}
          </pre>
        </div>
      </section>
    </div>
  );
}

const courses = [
  {
    icon: "🤖",
    title: "Введение в ML",
    desc: "Линейная регрессия, деревья решений, основы Python.",
  },
  {
    icon: "🧠",
    title: "Глубокое обучение",
    desc: "Свёрточные и рекуррентные сети, трансформеры.",
  },
  {
    icon: "📊",
    title: "Data Science",
    desc: "Pandas, визуализация, работа с реальными датасетами.",
  },
];

const tasks = [
  { icon: "📝", title: "Классификация" },
  { icon: "🔢", title: "Регрессия" },
  { icon: "📷", title: "Компьютерное зрение" },
  { icon: "🗣️", title: "NLP" },
];

function CourseCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 transition hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function TaskCard({
  icon,
  title,
  delay,
}: {
  icon: string;
  title: string;
  delay: number;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center transition hover:shadow-lg animate-fade-in-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h4 className="font-semibold text-gray-800">{title}</h4>
    </div>
  );
}

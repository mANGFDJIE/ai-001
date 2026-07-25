import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 md:py-32">
        <h1
          className="text-4xl md:text-6xl font-extrabold mb-4"
          style={{
            background: 'linear-gradient(90deg,#7c3aed,#3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Искусственный Интеллект для всех
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl">
          Откройте возможности AI: обработка естественного языка, компьютерное зрение, аналитика данных и многое другое.
        </p>
        <a
          href="/ai-course"
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3 px-8 rounded-full transition-colors duration-300 shadow-lg"
        >
          Начать обучение
        </a>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 grid gap-8 md:grid-cols-3">
        <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-colors">
          <h3 className="text-xl font-semibold mb-2">Натуральный язык</h3>
          <p className="text-gray-300">
            Генерация текста, ответы на вопросы, резюме статей — всё без усилий.
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-colors">
          <h3 className="text-xl font-semibold mb-2">Компьютерное зрение</h3>
          <p className="text-gray-300">
            Распознавание объектов, анализ изображений, генерация описаний.
          </p>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700 transition-colors">
          <h3 className="text-xl font-semibold mb-2">Аналитика данных</h3>
          <p className="text-gray-300">
            Предсказательные модели, визуализация, оптимизация процессов.
          </p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-6 py-20 bg-gray-900">
        <h2 className="text-2xl font-semibold text-center mb-12">Что говорят пользователи</h2>
        <div className="grid gap-8 md:grid-cols-2">
          <blockquote className="bg-gray-800 rounded-xl p-6 text-gray-300">
            <p className="mb-4">
              «С помощью этой платформы я смог ускорить разработку AI‑моделей в 3 раза».
            </p>
            <cite className="block text-right font-medium">– А. Иванов, Data Scientist</cite>
          </blockquote>
          <blockquote className="bg-gray-800 rounded-xl p-6 text-gray-300">
            <p className="mb-4">
              «Интуитивно понятные интерфейсы и богатый набор инструментов делают обучение простым и увлекательным».
            </p>
            <cite className="block text-right font-medium">– Е. Петрова, ML Engineer</cite>
          </blockquote>
        </div>
      </section>

      {/* Call to Action */}
      <section className="flex flex-col items-center justify-center text-center py-20">
        <h3 className="text-3xl font-bold mb-4">Готовы вывести свой проект на новый уровень?</h3>
        <a
          href="/login"
          className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-3 px-10 rounded-full transition-colors duration-300 shadow-lg"
        >
          Зарегистрироваться
        </a>
      </section>
    </main>
  );
}

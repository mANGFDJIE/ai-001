import React from 'react';

const AiLandingPage = () => (
  <div className="min-h-screen bg-gray-900 text-white font-sans">
    {/* Хедер */}
    <header className="bg-gray-800 p-6 text-center">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
        Освой ИИ с нуля
      </h1>
      <p className="mt-4 text-lg text-gray-300">5 практических уроков для начинающих</p>
    </header>

    {/* Основной контент */}
    <section className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Уроки */}
      {[
        { title: 'Введение в ИИ', description: 'Что такое искусственный интеллект и как он работает' },
        { title: 'Обучающие модели', description: 'Основы обучения нейросетей и моделей' },
        { title: 'Обработка данных', description: 'Работа с датасетами и подготовка данных' },
        { title: 'Создание своих проектов', description: 'Практика построения собственных решений' },
        { title: 'Будущее ИИ', description: 'Тенденции развития и этика' },
      ].map((lesson, index) => (
        <div key={index} className="bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-2xl font-semibold mb-2">{lesson.title}</h2>
          <p className="text-gray-300">{lesson.description}</p>
        </div>
      ))}
    </section>

    {/* CTA */}
    <section className="bg-gradient-to-r from-purple-600 via-pink-500 to-red-500 p-8 text-center">
      <h3 className="text-3xl font-bold mb-4">Готовы начать?</h3>
      <button className="bg-white text-gray-900 px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition">
        Записаться на курс
      </button>
    </section>

    {/* Подвал */}
    <footer className="bg-gray-800 p-4 text-center text-gray-400">
      &copy; 2023 AI Academy. Все права защищены.
    </footer>
  </div>
);

export default AiLandingPage;

'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AILearnPage() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const courses = [
    {
      id: 1,
      title: 'Машинное обучение',
      description: 'Основы ML, алгоритмы и практические кейсы',
      progress: 65,
      icon: '🤖',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 2,
      title: 'Нейронные сети',
      description: 'Deep Learning, CNN, RNN и трансформеры',
      progress: 42,
      icon: '🧠',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 3,
      title: 'NLP & ChatGPT',
      description: 'Обработка языка, промпт-инжиниринг',
      progress: 78,
      icon: '💬',
      gradient: 'from-green-500 to-teal-500'
    },
    {
      id: 4,
      title: 'Computer Vision',
      description: 'Распознавание образов, детекция объектов',
      progress: 28,
      icon: '👁️',
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  const stats = [
    { label: 'Курсов пройдено', value: '12', icon: '📚' },
    { label: 'Часов обучения', value: '156', icon: '⏱️' },
    { label: 'Практических задач', value: '89', icon: '✅' },
    { label: 'Рейтинг', value: '4.9', icon: '⭐' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <nav className="border-b border-slate-800 backdrop-blur-lg bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Academy
          </Link>
          <div className="flex gap-6">
            <Link href="/dashboard" className="hover:text-purple-400 transition">Дашборд</Link>
            <Link href="/ai-learn" className="text-purple-400">Обучение</Link>
            <Link href="/profile" className="hover:text-purple-400 transition">Профиль</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-pulse">
            Изучай AI будущего
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Освой машинное обучение, нейросети и LLM с практическими проектами
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg border border-slate-700 rounded-2xl p-6 hover:scale-105 transition-transform duration-300"
            >
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {courses.map((course) => (
            <div
              key={course.id}
              onMouseEnter={() => setHoveredCard(course.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="group relative bg-gradient-to-br from-slate-800/30 to-slate-900/30 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 hover:border-purple-500/50 transition-all duration-500 overflow-hidden"
            >
              {/* Background Glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${course.gradient} opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-500`}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-6xl">{course.icon}</div>
                  <div
                    className={`px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r ${course.gradient} ${
                      hoveredCard === course.id ? 'scale-110' : ''
                    } transition-transform duration-300`}
                  >
                    {course.progress}%
                  </div>
                </div>

                <h3 className="text-2xl font-bold mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-purple-400 group-hover:to-pink-400 transition-all duration-300">
                  {course.title}
                </h3>
                <p className="text-slate-400 mb-6">{course.description}</p>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${course.gradient} transition-all duration-1000 ease-out`}
                      style={{ width: hoveredCard === course.id ? `${course.progress}%` : '0%' }}
                    />
                  </div>
                </div>

                <button
                  className={`w-full py-3 rounded-xl font-semibold bg-gradient-to-r ${course.gradient} hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 ${
                    hoveredCard === course.id ? 'scale-105' : ''
                  }`}
                >
                  Продолжить обучение →
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 bg-gradient-to-r from-purple-900/30 to-pink-900/30 backdrop-blur-lg border border-purple-500/30 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Начни карьеру в AI сегодня</h2>
          <p className="text-slate-300 mb-8 text-lg">
            Получи сертификат и доступ к эксклюзивному комьюнити разработчиков
          </p>
          <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-lg hover:scale-110 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300">
            Записаться на интенсив 🚀
          </button>
        </div>
      </section>
    </div>
  );
}

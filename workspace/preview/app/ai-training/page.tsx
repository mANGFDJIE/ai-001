'use client';

import { useState } from 'react';

export default function AITrainingPage() {
  const [activeTab, setActiveTab] = useState('courses');

  const courses = [
    {
      id: 1,
      title: 'Основы Machine Learning',
      level: 'Начинающий',
      duration: '8 недель',
      progress: 65,
      icon: '🤖',
      students: 12543
    },
    {
      id: 2,
      title: 'Deep Learning & Neural Networks',
      level: 'Продвинутый',
      duration: '12 недель',
      progress: 30,
      icon: '🧠',
      students: 8921
    },
    {
      id: 3,
      title: 'NLP и обработка текста',
      level: 'Средний',
      duration: '6 недель',
      progress: 0,
      icon: '💬',
      students: 6754
    },
    {
      id: 4,
      title: 'Computer Vision',
      level: 'Продвинутый',
      duration: '10 недель',
      progress: 45,
      icon: '👁️',
      students: 5432
    }
  ];

  const stats = [
    { label: 'Активных курсов', value: '24', icon: '📚' },
    { label: 'Студентов онлайн', value: '3.2K', icon: '👥' },
    { label: 'Часов контента', value: '450+', icon: '⏱️' },
    { label: 'Сертификатов', value: '1.8K', icon: '🏆' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 animate-pulse"></div>
        <div className="container mx-auto px-6 py-20 relative z-10">
          <div className="max-w-4xl">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
              AI Обучение
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Освойте искусственный интеллект с практическими курсами от экспертов индустрии
            </p>
            <div className="flex gap-4">
              <button className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-semibold hover:shadow-lg hover:shadow-cyan-500/50 transition-all transform hover:scale-105">
                Начать обучение
              </button>
              <button className="px-8 py-4 border border-slate-600 rounded-lg font-semibold hover:bg-slate-800 transition-all">
                Каталог курсов
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all hover:transform hover:scale-105"
            >
              <div className="text-4xl mb-3">{stat.icon}</div>
              <div className="text-3xl font-bold text-cyan-400 mb-1">{stat.value}</div>
              <div className="text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="container mx-auto px-6 py-8">
        <div className="flex gap-4 border-b border-slate-800 mb-8">
          {['courses', 'progress', 'community'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'courses' && '📚 Курсы'}
              {tab === 'progress' && '📊 Прогресс'}
              {tab === 'community' && '💬 Сообщество'}
            </button>
          ))}
        </div>

        {/* Courses Grid */}
        {activeTab === 'courses' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all hover:transform hover:translate-y-[-4px] hover:shadow-xl hover:shadow-cyan-500/20 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-5xl group-hover:scale-110 transition-transform">{course.icon}</div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                    {course.level}
                  </span>
                </div>
                
                <h3 className="text-2xl font-bold mb-3 group-hover:text-cyan-400 transition-colors">
                  {course.title}
                </h3>
                
                <div className="flex gap-4 text-slate-400 text-sm mb-4">
                  <span>⏱️ {course.duration}</span>
                  <span>👥 {course.students.toLocaleString()} студентов</span>
                </div>

                {course.progress > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Прогресс</span>
                      <span className="text-cyan-400 font-semibold">{course.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <button className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-lg font-semibold hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 transition-all group-hover:border-cyan-400">
                  {course.progress > 0 ? 'Продолжить' : 'Начать курс'}
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-8">
            <h2 className="text-3xl font-bold mb-6">Ваш прогресс</h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span>Общий прогресс обучения</span>
                  <span className="text-cyan-400 font-bold">42%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full" style={{ width: '42%' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'community' && (
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-8">
            <h2 className="text-3xl font-bold mb-6">Сообщество</h2>
            <p className="text-slate-400">Присоединяйтесь к дискуссиям и обменивайтесь опытом с коллегами</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}

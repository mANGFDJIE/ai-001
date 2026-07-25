'use client'

import { useState } from 'react'
import { ChevronRightIcon, PlayIcon, BookOpenIcon, BrainIcon, RocketIcon, StarIcon } from '@heroicons/react/24/outline'

export default function AILearningPage() {
  const [selectedCourse, setSelectedCourse] = useState(0)

  const courses = [
    {
      id: 1,
      title: "Основы машинного обучения",
      description: "Изучите фундаментальные концепции ML и алгоритмы",
      duration: "12 недель",
      level: "Начинающий",
      rating: 4.8,
      students: 15420,
      icon: BrainIcon,
      color: "from-blue-500 to-purple-600"
    },
    {
      id: 2,
      title: "Глубокое обучение с PyTorch",
      description: "Создавайте нейронные сети для решения сложных задач",
      duration: "16 недель",
      level: "Продвинутый",
      rating: 4.9,
      students: 8930,
      icon: RocketIcon,
      color: "from-purple-500 to-pink-600"
    },
    {
      id: 3,
      title: "Обработка естественного языка",
      description: "NLP, трансформеры и современные языковые модели",
      duration: "10 недель",
      level: "Средний",
      rating: 4.7,
      students: 12340,
      icon: BookOpenIcon,
      color: "from-green-500 to-teal-600"
    }
  ]

  const features = [
    "Интерактивные уроки с кодом",
    "Проекты для портфолио",
    "Менторство от экспертов",
    "Сертификация по завершении"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-3xl"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Изучай <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">AI</span>
              <br />будущего
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Станьте экспертом в области искусственного интеллекта с нашими интерактивными курсами, 
              созданными ведущими специалистами индустрии
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 shadow-lg">
                Начать обучение
              </button>
              <button className="border-2 border-white/20 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors duration-200 backdrop-blur-sm">
                <PlayIcon className="w-5 h-5 inline mr-2" />
                Смотреть демо
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { number: "50K+", label: "Студентов" },
            { number: "95%", label: "Успешность" },
            { number: "200+", label: "Проектов" }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold text-white mb-2">{stat.number}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Courses Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-4xl font-bold text-white text-center mb-12">
          Популярные курсы
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, index) => (
            <div
              key={course.id}
              className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 hover:scale-105 cursor-pointer"
              onClick={() => setSelectedCourse(index)}
            >
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${course.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <course.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{course.title}</h3>
              <p className="text-gray-400 mb-4">{course.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>{course.duration}</span>
                <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                  {course.level}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <StarIcon className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-medium">{course.rating}</span>
                  <span className="text-gray-500">({course.students})</span>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-6">
                Почему выбирают нас?
              </h2>
              <ul className="space-y-4">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-300">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full mr-3"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="w-full h-64 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl border border-white/10 flex items-center justify-center">
                <BrainIcon className="w-24 h-24 text-white/50" />
              </div>
              <div className="absolute -top-4 -right-4 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-4xl font-bold text-white mb-6">
          Готовы начать свой AI путь?
        </h2>
        <p className="text-xl text-gray-300 mb-8">
          Присоединитесь к тысячам студентов, которые уже строят будущее с AI
        </p>
        <button className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-12 py-4 rounded-xl font-semibold hover:scale-105 transition-transform duration-200 shadow-2xl">
          Начать бесплатно
        </button>
      </div>
    </div>
  )
}

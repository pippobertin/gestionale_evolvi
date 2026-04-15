'use client'

import { LucideIcon } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: LucideIcon
}

interface SecondaryTabsBarProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function SecondaryTabsBar({ tabs, activeTab, onTabChange }: SecondaryTabsBarProps) {
  return (
    <div className="border-b border-gray-200 mb-4">
      <div className="flex space-x-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-2 px-3 border-b-2 text-xs font-medium flex items-center space-x-1.5 transition-colors flex-shrink-0 ${
                isActive
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

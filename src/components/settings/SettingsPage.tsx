import React, { useState } from 'react';
import { MessageSquareText, Settings as SettingsIcon } from 'lucide-react';
import { MessageTemplates } from './MessageTemplates';

const tabs = [
  { id: 'templates', name: 'Templates de Mensagem', icon: MessageSquareText },
  // Adicione mais tabs conforme necessário
];

export function SettingsPage() {
  const [currentTab, setCurrentTab] = useState('templates');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center mb-8">
        <SettingsIcon className="w-6 h-6 text-gray-500 mr-3" />
        <h1 className="text-2xl font-semibold text-gray-900">Configurações</h1>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm font-medium rounded-md
                    ${currentTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 ml-8">
          {currentTab === 'templates' && <MessageTemplates />}
        </div>
      </div>
    </div>
  );
}

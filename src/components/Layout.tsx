import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, Menu, X, Settings, Building2, MessageCircle } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <h1 className="text-xl font-bold">Sistema de Cotações</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4">
          {/* Main Navigation */}
          <div className="space-y-2">
            <Link to="/quotations" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              <FileText className="w-5 h-5 mr-3" />
              Cotações
            </Link>
            <Link to="/suppliers" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              <Users className="w-5 h-5 mr-3" />
              Fornecedores
            </Link>
          </div>

          {/* Settings Section */}
          <div className="mt-8 pt-4 border-t">
            <h2 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Configurações
            </h2>
            <div className="space-y-2">
              <Link to="/settings/company" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Building2 className="w-5 h-5 mr-3" />
                Empresa
              </Link>
              <Link to="/settings/whatsapp" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                <MessageCircle className="w-5 h-5 mr-3" />
                WhatsApp
              </Link>
              <Link
                to="/settings"
                className={`${
                  location.pathname === '/settings'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
              >
                <Settings
                  className={`${
                    location.pathname === '/settings'
                      ? 'text-gray-300'
                      : 'text-gray-400 group-hover:text-gray-300'
                  } mr-3 h-6 w-6`}
                  aria-hidden="true"
                />
                Configurações
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 flex items-center h-16 bg-white border-b lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="px-4">
            <Menu className="w-6 h-6" />
          </button>
        </div>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
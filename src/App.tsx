import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthProvider';
import { AuthContext } from './contexts/auth.context';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { VehicleList } from './components/vehicles/VehicleList';
import { VehicleForm } from './components/vehicles/VehicleForm';
import { PartsList } from './components/parts/PartsList';
import { PartsForm } from './components/parts/PartsForm';
import { SupplierList } from './components/suppliers/SupplierList';
import { SupplierForm } from './components/suppliers/SupplierForm';
import QuotationsList from './pages/QuotationsList';
import { QuotationForm } from './components/quotations/QuotationForm';
import { QuotationDetails } from './components/quotations/QuotationDetails';
import { CompanyList } from './components/admin/CompanyList';
import { CompanyForm } from './components/admin/CompanyForm';
import { CompanySettings } from './components/settings/CompanySettings';
import { WhatsAppConfig } from './components/settings/WhatsAppConfig';
import { CompanyConfig } from './components/settings/CompanyConfig';
import VehicleQuotationForm from './components/VehicleQuotationForm';
import { WhatsAppSettings } from './components/settings/WhatsAppSettings';
import { Toaster } from 'react-hot-toast';
import QuotationResponse from './pages/QuotationResponse';
import CounterOfferResponse from './pages/CounterOfferResponse';
import { SettingsPage } from './components/settings/SettingsPage';
import { QuotationComparison } from './pages/QuotationComparison';
import { PurchaseOrderDetails } from './pages/PurchaseOrderDetails';

function ProtectedRoutes() {
  const { user } = React.useContext(AuthContext);
  
  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <Toaster />
        <Routes>
          <Route path="/" element={<VehicleList />} />
          <Route path="/vehicles/new" element={<VehicleForm />} />
          <Route path="/vehicles/:id" element={<VehicleForm />} />
          <Route path="/parts" element={<PartsList />} />
          <Route path="/parts/new" element={<PartsForm />} />
          <Route path="/suppliers" element={<SupplierList />} />
          <Route path="/suppliers/new" element={<SupplierForm />} />
          <Route path="/quotations" element={<QuotationsList />} />
          <Route path="/quotation/new" element={<VehicleQuotationForm />} />
          <Route path="/quotations/:id" element={<QuotationDetails />} />
          <Route path="/quotations/:id/compare" element={<QuotationComparison />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetails />} />
          <Route path="/admin/companies" element={<CompanyList />} />
          <Route path="/admin/companies/new" element={<CompanyForm />} />
          {/* Rotas de Configuração */}
          <Route path="/settings/whatsapp" element={<WhatsAppSettings />} />
          <Route path="/settings/company" element={<CompanyConfig />} />
          <Route path="/settings/company/settings" element={<CompanySettings />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/quotation-response/:id/:requestId" element={<QuotationResponse />} />
          <Route path="/counter-offer-response/:id/:requestId" element={<CounterOfferResponse />} />
          <Route path="*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
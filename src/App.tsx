import React from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { Dashboard } from "./components/Dashboard";
import { Button } from "./components/ui/button";
import { Wallet, LogIn } from "lucide-react";

function MainApp() {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Wealth Tracker</h1>
          <p className="text-gray-500 mb-8">
            Quản lý tài sản, chi tiêu và đầu tư của bạn một cách thông minh.
          </p>
          <Button onClick={signIn} className="w-full h-12 text-lg" size="lg">
            <LogIn className="w-5 h-5 mr-2" />
            Đăng nhập với Google
          </Button>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}

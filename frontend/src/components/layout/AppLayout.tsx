import React from 'react';
import { Outlet } from 'react-router-dom';
import { Drawer } from '@/components/ui/Drawer';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAppStore } from '@/stores/useAppStore';

export const AppLayout: React.FC = () => {
  const { mobileMenuOpen, setMobileMenuOpen } = useAppStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-950 text-surface-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Navigation */}
      <Drawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        side="left"
        width="sm"
        title="Navigation"
      >
        <Sidebar />
      </Drawer>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

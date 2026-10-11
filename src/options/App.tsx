import React from 'react';
import { App as PopupApp } from '../popup/App';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen app-shell flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <PopupApp />
      </div>
    </div>
  );
};

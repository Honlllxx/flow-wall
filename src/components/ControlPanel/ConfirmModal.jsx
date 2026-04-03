import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ onConfirm, onCancel }) => {
  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-gray-900 border border-white/10 p-4 rounded-xl w-3/4 shadow-2xl text-center transform scale-105 transition-transform">
        <div className="flex justify-center mb-2 text-yellow-500">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-white font-medium text-sm mb-1">Delete Item?</h3>
        <p className="text-white/50 text-[10px] mb-4">This action cannot be undone.</p>
        <div className="flex gap-2">
          <button 
            onClick={onCancel} 
            className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs text-white font-medium transition-colors shadow-lg shadow-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
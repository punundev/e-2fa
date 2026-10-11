import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { formatCode } from '../../lib/clock';
import { t } from '../../lib/i18n';

interface CodeDisplayProps {
  code: string;
  grouping?: 'grouped' | 'plain';
  onCopied?: () => void;
}

export const CodeDisplay: React.FC<CodeDisplayProps> = ({
  code,
  grouping = 'grouped',
  onCopied,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatted = formatCode(code, grouping);

  return (
    <div
      onClick={handleCopy}
      className="group relative flex items-center justify-between px-3 py-1.5 rounded-lg app-code-box cursor-pointer select-all"
      title={t('copy_code')}
    >
      <span className="font-mono text-xl font-bold tracking-wider">
        {formatted}
      </span>
      <div className="flex items-center ml-2 text-slate-400 group-hover:text-slate-200">
        {copied ? (
          <span className="flex items-center text-xs font-sans text-emerald-400 gap-1">
            <Check size={14} />
            <span>Copied</span>
          </span>
        ) : (
          <Copy size={15} className="transition-transform group-hover:scale-110" />
        )}
      </div>
    </div>
  );
};

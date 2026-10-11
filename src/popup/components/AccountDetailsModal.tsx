import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, QrCode, Copy, Check } from 'lucide-react';
import { AuthenticatorAccount } from '../../types';
import { formatOtpUri } from '../../lib/otp-uri';
import { generateQrDataUrl } from '../../lib/qr-code';
import { t } from '../../lib/i18n';

interface AccountDetailsModalProps {
  account: AuthenticatorAccount;
  onClose: () => void;
}

export const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
  account,
  onClose,
}) => {
  const [showSecret, setShowSecret] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  useEffect(() => {
    const uri = formatOtpUri(account);
    generateQrDataUrl(uri)
      .then(setQrUrl)
      .catch(() => {});
  }, [account]);

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(account.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleCopyUri = async () => {
    const uri = formatOtpUri(account);
    await navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              {t('account_details_title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="text-center">
          <h4 className="text-base font-bold text-slate-100">{account.issuer}</h4>
          <p className="text-xs text-slate-400">{account.name}</p>
        </div>

        {qrUrl && (
          <div className="flex justify-center p-3 bg-white rounded-xl mx-auto w-44 h-44 shadow-inner">
            <img src={qrUrl} alt="Provisioning QR Code" className="w-full h-full" />
          </div>
        )}

        <div className="flex flex-col gap-2 text-xs">
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400">{t('secret_key')}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={handleCopySecret}
                  className="text-slate-400 hover:text-slate-200"
                  title="Copy secret"
                >
                  {copiedSecret ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>
            <p className="font-mono text-xs text-slate-200 break-all select-all">
              {showSecret ? account.secret : '••••••••••••••••••••••••'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[10px]">{t('otp_type')}</span>
              <span className="font-semibold text-slate-200 uppercase">
                {account.type}
              </span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[10px]">{t('algorithm')}</span>
              <span className="font-semibold text-slate-200">
                {account.algorithm}
              </span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[10px]">{t('digits')}</span>
              <span className="font-semibold text-slate-200">{account.digits}</span>
            </div>
            <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[10px]">
                {account.type === 'totp' ? t('period') : t('counter')}
              </span>
              <span className="font-semibold text-slate-200">
                {account.type === 'totp' ? `${account.period}s` : `#${account.counter}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCopyUri}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            {copiedUri ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
            <span>{t('menu_copy_uri')}</span>
          </button>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

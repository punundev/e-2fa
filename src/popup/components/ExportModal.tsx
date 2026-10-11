import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { AuthenticatorAccount } from '../../types';
import { exportGoogleMigrationUris } from '../../lib/google-migration';
import { generateQrDataUrl } from '../../lib/qr-code';
import {
  createBackupBlob,
  createPlaintextJsonBlob,
  createCsvBlob,
  triggerDownload,
} from '../../lib/import-export';
import { t } from '../../lib/i18n';

interface ExportModalProps {
  accounts: AuthenticatorAccount[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ accounts, onClose }) => {
  const [activeTab, setActiveTab] = useState<'encrypted' | 'google' | 'json' | 'csv'>(
    'encrypted'
  );

  // Encrypted backup state
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  // Google migration QR state
  const [migrationUris, setMigrationUris] = useState<string[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [batchQrUrl, setBatchQrUrl] = useState<string>('');

  // Plaintext export confirmation
  const [confirmedPlaintextWarning, setConfirmedPlaintextWarning] = useState(false);
  const [includeSecretsInCsv, setIncludeSecretsInCsv] = useState(false);

  useEffect(() => {
    if (activeTab === 'google' && accounts.length > 0) {
      const uris = exportGoogleMigrationUris(accounts, 10);
      setMigrationUris(uris);
      setCurrentBatchIndex(0);
      if (uris.length > 0) {
        generateQrDataUrl(uris[0])
          .then(setBatchQrUrl)
          .catch(() => {});
      }
    }
  }, [activeTab, accounts]);

  useEffect(() => {
    if (migrationUris.length > 0 && migrationUris[currentBatchIndex]) {
      generateQrDataUrl(migrationUris[currentBatchIndex])
        .then(setBatchQrUrl)
        .catch(() => {});
    }
  }, [currentBatchIndex, migrationUris]);

  const handleDownloadEncrypted = async () => {
    setBackupStatus(null);
    if (!backupPassword) {
      setBackupStatus(t('password_empty'));
      return;
    }
    if (backupPassword !== confirmPassword) {
      setBackupStatus(t('passwords_mismatch'));
      return;
    }

    try {
      const blob = await createBackupBlob(accounts, backupPassword);
      triggerDownload(blob, `secureauth-backup-${new Date().toISOString().slice(0, 10)}.sauth`);
      setBackupStatus('SUCCESS');
    } catch (err: any) {
      setBackupStatus(err.message || 'Export failed');
    }
  };

  const handleDownloadJson = () => {
    const blob = createPlaintextJsonBlob(accounts);
    triggerDownload(blob, `secureauth-export-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleDownloadCsv = () => {
    const blob = createCsvBlob(accounts, includeSecretsInCsv);
    triggerDownload(blob, `secureauth-accounts-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl app-modal p-4 shadow-2xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">{t('export_title')}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex rounded-lg bg-slate-800/80 p-0.5 text-[11px]">
          <button
            onClick={() => setActiveTab('encrypted')}
            className={`flex-1 py-1.5 rounded-md text-center transition-colors ${
              activeTab === 'encrypted'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Encrypted (.sauth)
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-1.5 rounded-md text-center transition-colors ${
              activeTab === 'google'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Google QR
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 py-1.5 rounded-md text-center transition-colors ${
              activeTab === 'json'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-1.5 rounded-md text-center transition-colors ${
              activeTab === 'csv'
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            CSV
          </button>
        </div>

        {activeTab === 'encrypted' && (
          <div className="flex flex-col gap-2.5 text-xs py-1">
            <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-800/50 flex items-start gap-2">
              <Lock size={15} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-200 leading-relaxed">
                {t('backup_password_hint')}
              </p>
            </div>

            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('backup_password_label')}
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Choose strong backup password..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium mb-1 block">
                {t('backup_password_confirm')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {backupStatus && backupStatus !== 'SUCCESS' && (
              <p className="text-[11px] text-red-400">{backupStatus}</p>
            )}

            {backupStatus === 'SUCCESS' && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                <CheckCircle2 size={14} />
                <span>Backup generated successfully!</span>
              </div>
            )}

            <button
              onClick={handleDownloadEncrypted}
              className="mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              <Download size={14} />
              <span>{t('btn_download_backup')}</span>
            </button>
          </div>
        )}

        {activeTab === 'google' && (
          <div className="flex flex-col items-center gap-2.5 py-1 text-center text-xs">
            <p className="text-[11px] text-slate-300">
              {t('google_export_qr_desc')}
            </p>

            {batchQrUrl ? (
              <div className="p-3 bg-white rounded-xl shadow-inner w-48 h-48 flex items-center justify-center">
                <img src={batchQrUrl} alt="Google Authenticator Migration QR" className="w-full h-full" />
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-500">
                Generating QR...
              </div>
            )}

            {migrationUris.length > 1 && (
              <div className="flex items-center justify-between w-full px-4">
                <button
                  disabled={currentBatchIndex === 0}
                  onClick={() => setCurrentBatchIndex((prev) => Math.max(0, prev - 1))}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 text-slate-200"
                >
                  <ChevronLeft size={14} />
                  <span>{t('prev_batch')}</span>
                </button>
                <span className="text-[11px] text-slate-400">
                  {t('batch_indicator', {
                    current: currentBatchIndex + 1,
                    total: migrationUris.length,
                  })}
                </span>
                <button
                  disabled={currentBatchIndex === migrationUris.length - 1}
                  onClick={() =>
                    setCurrentBatchIndex((prev) =>
                      Math.min(migrationUris.length - 1, prev + 1)
                    )
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 disabled:opacity-40 text-slate-200"
                >
                  <span>{t('next_batch')}</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'json' && (
          <div className="flex flex-col gap-3 py-1 text-xs">
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 flex items-start gap-2 text-red-200">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                {t('security_warning_plaintext')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="confirmJson"
                checked={confirmedPlaintextWarning}
                onChange={(e) => setConfirmedPlaintextWarning(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <label htmlFor="confirmJson" className="text-slate-300 cursor-pointer text-[11px]">
                I understand the security risks of exporting plaintext secrets
              </label>
            </div>

            <button
              onClick={handleDownloadJson}
              disabled={!confirmedPlaintextWarning}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-medium transition-colors"
            >
              <Download size={14} />
              <span>{t('btn_download_json')}</span>
            </button>
          </div>
        )}

        {activeTab === 'csv' && (
          <div className="flex flex-col gap-3 py-1 text-xs">
            <p className="text-slate-300 text-[11px]">
              Export account list as a CSV spreadsheet. By default, secrets are excluded for security.
            </p>

            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 border border-slate-700">
              <input
                type="checkbox"
                id="includeSecrets"
                checked={includeSecretsInCsv}
                onChange={(e) => setIncludeSecretsInCsv(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <label htmlFor="includeSecrets" className="text-slate-300 cursor-pointer text-[11px]">
                Include Base32 secrets column (Not Recommended)
              </label>
            </div>

            {includeSecretsInCsv && (
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-[11px]">
                <AlertTriangle size={13} className="inline mr-1 text-amber-400" />
                Plaintext secrets will be included in the downloaded CSV file.
              </div>
            )}

            <button
              onClick={handleDownloadCsv}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              <Download size={14} />
              <span>{t('btn_download_csv')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
